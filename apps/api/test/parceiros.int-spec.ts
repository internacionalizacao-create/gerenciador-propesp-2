import { and, eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import * as s from '../src/database/schema';
import {
  atualizarParceiroSchema,
  criarParceiroSchema,
  ParceirosService,
  type CriarParceiro,
} from '../src/dominio/parceiros.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { normalizarNomeInstituicao } from '../src/database/normalizacao';
import { acessoGlobalDeTeste, criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-parceiros',
  name: 'Admin de Parceiros',
  roles: ['admin'],
  permissions: [
    'parceiro:read',
    'parceiro:create',
    'parceiro:edit',
    'parceiro:status',
    'parceiro:merge',
    'convenio:create',
    'convenio:edit',
    'convenio:status',
  ],
};

/** Estas suites verificam a linha historica (CG-027), nao o recorte (V1-016). */
const acessoAmplo = acessoGlobalDeTeste([
  'parceiro:read',
  'bolsa:read',
  'missao:read',
  'produto-missao:read',
  'convenio:read',
]);

describe('ParceirosService', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: ParceirosService;
  let paisId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new ParceirosService(ctx.db);
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ codigoIso2: 'CA', codigoIso3: 'CAN', nome: 'Canada' })
      .returning({ id: s.pais.id });
    paisId = pais.id;
  });

  it('cadastra, busca e filtra parceiro reutilizavel por rede', async () => {
    const criado = await service.criar(
      parceiroValido('Universite de Montreal', [base.redeId], {
        sigla: 'UdeM',
        paisId,
        cidade: 'Montreal',
        site: 'https://www.umontreal.ca',
        emailInstitucional: 'international@umontreal.ca',
      }),
      admin,
    );

    expect(criado).toMatchObject({
      nome: 'Universite de Montreal',
      sigla: 'UdeM',
      pais: 'Canada',
      codigoPais: 'CA',
      ativo: true,
      redes: [{ id: base.redeId, nome: 'REDE-TESTE' }],
      quantidadeContatos: 0,
      quantidadeMissoes: 0,
    });
    expect(
      await service.listar({
        busca: 'montreal',
        redeId: base.redeId,
        incluirInativos: false,
      }),
    ).toHaveLength(1);
    expect(
      await service.listar({
        busca: 'inexistente',
        incluirInativos: false,
      }),
    ).toHaveLength(0);

    const [auditoria] = await ctx.db
      .select()
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, criado.id));
    expect(auditoria).toMatchObject({
      entidadeTipo: 'INSTITUICAO',
      acao: 'CRIACAO',
      usuarioId: admin.id,
    });
  });

  it('bloqueia equivalencia inequivoca e exige confirmacao para candidato possivel', async () => {
    const original = await service.criar(
      parceiroValido('Universite de Montreal', [], {
        sigla: 'UdeM',
        site: 'https://umontreal.ca',
      }),
      admin,
    );

    await expect(
      service.criar(
        parceiroValido('Université de Montréal', [], {
          confirmarPossivelDuplicidade: true,
        }),
        admin,
      ),
    ).rejects.toMatchObject({ status: 409 });

    const possivel = parceiroValido('Centro de Estudos de Montreal', [], {
      sigla: 'UdeM',
    });
    await expect(service.criar(possivel, admin)).rejects.toMatchObject({
      status: 409,
    });
    const confirmado = await service.criar(
      { ...possivel, confirmarPossivelDuplicidade: true },
      admin,
    );
    expect(confirmado.id).not.toBe(original.id);

    const candidatos = await service.buscarCandidatos({
      nome: 'Universite de Montreal',
      sigla: 'UdeM',
    });
    expect(candidatos[0]).toMatchObject({
      id: original.id,
      classificacao: 'INEQUIVOCA',
    });
    expect(candidatos[0].motivos).toContain('MESMO_NOME_NORMALIZADO');
  });

  it('edita redes com auditoria e inativa sem apagar referencias', async () => {
    const [segundaRede] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId: base.cicloId,
        instituicaoId: base.instituicaoId,
        nome: 'REDE-DOIS',
        statusOrcamento: 'DEFINIDO',
      })
      .returning({ id: s.redeCoordenadora.id });
    const criado = await service.criar(
      parceiroValido('Instituto Canadense de Pesquisa', [base.redeId], {
        paisId,
      }),
      admin,
    );

    const atualizado = await service.atualizar(
      criado.id,
      atualizarParceiroSchema.parse({
        cidade: 'Toronto',
        redeIds: [segundaRede.id],
      }),
      admin,
    );
    expect(atualizado.cidade).toBe('Toronto');
    expect(atualizado.redes.map((rede) => rede.id)).toEqual([segundaRede.id]);

    const inativo = await service.inativar(
      criado.id,
      { justificativa: 'Cadastro nao sera mais utilizado.' },
      admin,
    );
    expect(inativo.ativo).toBe(false);
    expect(await service.listar({ incluirInativos: false })).toHaveLength(0);
    expect(await service.listar({ incluirInativos: true })).toHaveLength(1);
    await expect(
      service.atualizar(criado.id, { cidade: 'Ottawa' }, admin),
    ).rejects.toMatchObject({ status: 400 });

    const campos = await ctx.db
      .select({ campo: s.registroAuditoria.campo })
      .from(s.registroAuditoria)
      .where(
        and(
          eq(s.registroAuditoria.entidadeId, criado.id),
          eq(s.registroAuditoria.acao, 'EDICAO'),
        ),
      );
    expect(campos.map((item) => item.campo).sort()).toEqual([
      'ativo',
      'cidade',
      'redes',
    ]);
  });

  it('concilia cadastros preservando redes, contatos, missao, pessoa e documento', async () => {
    const [segundaRede] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId: base.cicloId,
        instituicaoId: base.instituicaoId,
        nome: 'REDE-DOIS',
        statusOrcamento: 'DEFINIDO',
      })
      .returning({ id: s.redeCoordenadora.id });
    const destino = await service.criar(
      parceiroValido('Universidade Canonica do Canada', [base.redeId], {
        paisId,
      }),
      admin,
    );
    const origem = await service.criar(
      parceiroValido('Canadian Canonical University', [segundaRede.id], {
        paisId,
      }),
      admin,
    );
    const contatos = await ctx.db
      .insert(s.contatoInstituicao)
      .values([
        {
          instituicaoId: destino.id,
          nome: 'Contato Canonico',
          nomeNormalizado: 'contato canonico',
          principal: true,
        },
        {
          instituicaoId: origem.id,
          nome: 'Contato da Origem',
          nomeNormalizado: 'contato da origem',
          principal: true,
        },
      ])
      .returning();
    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({
        nome: 'Pesquisadora Parceira',
        tipo: 'EXTERNO',
        instituicaoId: origem.id,
      })
      .returning();
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MIS-2027-001',
        titulo: 'Missao com parceiro duplicado',
        objetivo: 'Testar conciliacao institucional.',
        dataInicio: '2027-08-01',
        dataFim: '2027-08-05',
      })
      .returning();
    await ctx.db.insert(s.missaoParticipante).values({
      missaoId: missao.id,
      pessoaId: pessoa.id,
      papel: 'RESPONSAVEL',
      dataInicio: '2027-08-01',
      dataFim: '2027-08-05',
    });
    const [atividade] = await ctx.db
      .insert(s.atividadeMissao)
      .values({
        missaoId: missao.id,
        ordem: 1,
        tipo: 'VISITA_TECNICA',
        titulo: 'Visita ao parceiro',
        paisId,
        instituicaoId: origem.id,
        contatoInstituicaoId: contatos[1].id,
        dataInicio: '2027-08-02',
        dataFim: '2027-08-03',
      })
      .returning();
    const [anexo] = await ctx.db
      .insert(s.anexo)
      .values({
        nome: 'documento.pdf',
        mimeType: 'application/pdf',
        tamanho: 100,
        caminho: 'parceiros/documento.pdf',
        entidadeTipo: 'INSTITUICAO',
        entidadeId: origem.id,
      })
      .returning();

    const conciliado = await service.conciliar(
      origem.id,
      {
        destinoId: destino.id,
        justificativa: 'Os cadastros representam a mesma universidade.',
      },
      admin,
    );

    expect(conciliado.id).toBe(destino.id);
    expect(conciliado.redes.map((rede) => rede.id).sort()).toEqual(
      [base.redeId, segundaRede.id].sort(),
    );
    expect(conciliado.quantidadeContatos).toBe(2);
    expect(conciliado.quantidadeMissoes).toBe(1);

    const [origemDepois] = await ctx.db
      .select()
      .from(s.instituicao)
      .where(eq(s.instituicao.id, origem.id));
    expect(origemDepois).toMatchObject({
      ativo: false,
      substituidaPorId: destino.id,
    });
    const contatosDepois = await ctx.db
      .select()
      .from(s.contatoInstituicao)
      .where(eq(s.contatoInstituicao.instituicaoId, destino.id));
    expect(contatosDepois).toHaveLength(2);
    expect(contatosDepois.filter((contato) => contato.principal)).toHaveLength(
      1,
    );

    const [atividadeDepois] = await ctx.db
      .select()
      .from(s.atividadeMissao)
      .where(eq(s.atividadeMissao.id, atividade.id));
    const [pessoaDepois] = await ctx.db
      .select()
      .from(s.pessoa)
      .where(eq(s.pessoa.id, pessoa.id));
    const [anexoDepois] = await ctx.db
      .select()
      .from(s.anexo)
      .where(eq(s.anexo.id, anexo.id));
    expect(atividadeDepois.instituicaoId).toBe(destino.id);
    expect(atividadeDepois.contatoInstituicaoId).toBe(contatos[1].id);
    expect(pessoaDepois.instituicaoId).toBe(destino.id);
    expect(anexoDepois.entidadeId).toBe(destino.id);

    const auditoria = await ctx.db
      .select({
        entidadeId: s.registroAuditoria.entidadeId,
        campo: s.registroAuditoria.campo,
        justificativa: s.registroAuditoria.justificativa,
      })
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.campo, 'instituicaoConciliada'));
    expect(auditoria).toEqual([
      expect.objectContaining({
        entidadeId: destino.id,
        justificativa: 'Os cadastros representam a mesma universidade.',
      }),
    ]);
  });

  it('monta a linha historica sem duplicar missao multirrede nem multiparada', async () => {
    const parceiro = await service.criar(
      parceiroValido('Universidade do Historico', [base.redeId], { paisId }),
      admin,
    );
    const [contato] = await ctx.db
      .insert(s.contatoInstituicao)
      .values({
        instituicaoId: parceiro.id,
        nome: 'Marie Tremblay',
        nomeNormalizado: normalizarNomeInstituicao('Marie Tremblay'),
        email: 'marie@historico.ca',
        emailNormalizado: 'marie@historico.ca',
        cargo: 'Diretora de Relacoes Internacionais',
        principal: true,
      })
      .returning({ id: s.contatoInstituicao.id });

    // Segunda rede no mesmo ciclo: a missao vai pertencer as duas.
    const [outraRede] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId: base.cicloId,
        instituicaoId: base.instituicaoId,
        nome: 'REDE-PARCEIRA',
        statusOrcamento: 'DEFINIDO',
      })
      .returning({ id: s.redeCoordenadora.id });

    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MCG-900',
        titulo: 'Missao de prospeccao',
        objetivo: 'Prospectar cooperacao',
        dataInicio: '2027-03-01',
        dataFim: '2027-03-10',
        status: 'CONCLUIDA',
      })
      .returning({ id: s.missaoComite.id });
    await ctx.db.insert(s.missaoRede).values([
      { missaoId: missao.id, redeId: base.redeId },
      { missaoId: missao.id, redeId: outraRede.id },
    ]);
    // Duas paradas no MESMO parceiro: e o outro caminho de duplicacao.
    await ctx.db.insert(s.atividadeMissao).values([
      {
        missaoId: missao.id,
        ordem: 1,
        tipo: 'VISITA_TECNICA',
        titulo: 'Reuniao com a reitoria',
        paisId,
        cidade: 'Montreal',
        instituicaoId: parceiro.id,
        contatoInstituicaoId: contato.id,
        tipoRelacionamento: 'REUNIAO_INSTITUCIONAL',
        dataInicio: '2027-03-02',
        dataFim: '2027-03-03',
      },
      {
        missaoId: missao.id,
        ordem: 2,
        tipo: 'EVENTO',
        titulo: 'Painel de internacionalizacao',
        paisId,
        cidade: 'Montreal',
        instituicaoId: parceiro.id,
        eventoNome: 'Semana da Cooperacao',
        eventoTipo: 'Seminario',
        eventoSite: 'https://cooperacao.example',
        dataInicio: '2027-03-05',
        dataFim: '2027-03-06',
      },
    ]);

    const historico = await service.historico(parceiro.id, acessoAmplo);

    expect(historico.parceiro).toMatchObject({
      id: parceiro.id,
      nome: 'Universidade do Historico',
      quantidadeMissoes: 1,
    });
    expect(historico.contatos).toEqual([
      expect.objectContaining({ nome: 'Marie Tremblay', principal: true }),
    ]);
    // O ponto do criterio de aceite: uma linha por missao.
    expect(historico.missoes).toHaveLength(1);
    expect(historico.missoes[0]).toMatchObject({
      codigo: 'MCG-900',
      ciclo: '2027-2030',
      programaSlug: 'programa-teste',
      status: 'CONCLUIDA',
    });
    expect(historico.missoes[0].redes.map((rede) => rede.nome).sort()).toEqual([
      'REDE-PARCEIRA',
      'REDE-TESTE',
    ]);
    expect(
      historico.missoes[0].atividades.map((atividade) => atividade.titulo),
    ).toEqual(['Reuniao com a reitoria', 'Painel de internacionalizacao']);
    expect(historico.missoes[0].atividades[0]).toMatchObject({
      pais: 'Canada',
      contatoNome: 'Marie Tremblay',
      tipoRelacionamento: 'REUNIAO_INSTITUCIONAL',
    });
    expect(historico.eventos).toEqual([
      expect.objectContaining({
        missaoCodigo: 'MCG-900',
        nome: 'Semana da Cooperacao',
        site: 'https://cooperacao.example',
      }),
    ]);
    // Produtos e convenios existem desde a CG-056; a lista de modulos
    // pendentes fica vazia e o contrato permanece, para o proximo modulo do
    // escopo entrar por aqui sem quebrar quem ja consome a resposta.
    expect(historico.modulosPendentes).toEqual([]);
    expect(historico.convenios).toEqual([]);
    expect(historico.produtos).toEqual([]);
  });

  it('ignora missao de outro parceiro e lista documentos do proprio', async () => {
    const parceiro = await service.criar(
      parceiroValido('Universidade Observada', [base.redeId]),
      admin,
    );
    const vizinho = await service.criar(
      parceiroValido('Universidade Vizinha', [base.redeId]),
      admin,
    );
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MCG-901',
        titulo: 'Missao do vizinho',
        objetivo: 'Visitar o vizinho',
        dataInicio: '2027-04-01',
        dataFim: '2027-04-05',
      })
      .returning({ id: s.missaoComite.id });
    await ctx.db
      .insert(s.missaoRede)
      .values({ missaoId: missao.id, redeId: base.redeId });
    await ctx.db.insert(s.atividadeMissao).values({
      missaoId: missao.id,
      ordem: 1,
      tipo: 'VISITA_TECNICA',
      titulo: 'Visita ao vizinho',
      paisId,
      instituicaoId: vizinho.id,
      dataInicio: '2027-04-02',
      dataFim: '2027-04-03',
    });
    await ctx.db.insert(s.anexo).values({
      nome: 'memorando.pdf',
      mimeType: 'application/pdf',
      tamanho: 2048,
      caminho: '/anexos/memorando.pdf',
      entidadeTipo: 'INSTITUICAO',
      entidadeId: parceiro.id,
      enviadoPor: 'Admin de Parceiros',
    });

    const historico = await service.historico(parceiro.id, acessoAmplo);

    expect(historico.missoes).toEqual([]);
    expect(historico.eventos).toEqual([]);
    expect(historico.documentos).toEqual([
      expect.objectContaining({ nome: 'memorando.pdf', tamanho: 2048 }),
    ]);
    // O vizinho enxerga a propria missao, e nao o documento alheio.
    const historicoVizinho = await service.historico(vizinho.id, acessoAmplo);
    expect(historicoVizinho.missoes).toHaveLength(1);
    expect(historicoVizinho.documentos).toEqual([]);
  });

  it('nao duplica missao no historico quando a conciliacao junta dois atuantes dela', async () => {
    // O caso que a conciliacao cria sozinha: origem e destino participaram da
    // MESMA missao, cada um com sua atividade. Depois de conciliar, o destino
    // fica com duas atividades na mesma missao — e a linha historica precisa
    // continuar sendo uma so.
    const origem = await service.criar(
      parceiroValido('Universidade de Origem', [base.redeId], { paisId }),
      admin,
    );
    const destino = await service.criar(
      parceiroValido('Universidade de Destino', [base.redeId], { paisId }),
      admin,
    );

    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MCG-910',
        titulo: 'Missao com dois anfitrioes',
        objetivo: 'Visitar as duas instituicoes',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-12',
        status: 'CONCLUIDA',
      })
      .returning({ id: s.missaoComite.id });
    await ctx.db
      .insert(s.missaoRede)
      .values({ missaoId: missao.id, redeId: base.redeId });
    await ctx.db.insert(s.atividadeMissao).values([
      {
        missaoId: missao.id,
        ordem: 1,
        tipo: 'VISITA_TECNICA',
        titulo: 'Reuniao na origem',
        paisId,
        instituicaoId: origem.id,
        dataInicio: '2027-05-02',
        dataFim: '2027-05-03',
      },
      {
        missaoId: missao.id,
        ordem: 2,
        tipo: 'VISITA_TECNICA',
        titulo: 'Reuniao no destino',
        paisId,
        instituicaoId: destino.id,
        dataInicio: '2027-05-05',
        dataFim: '2027-05-06',
      },
    ]);

    // Antes de conciliar cada um enxerga a missao uma vez, com a propria parada.
    const antesOrigem = await service.historico(origem.id, acessoAmplo);
    expect(antesOrigem.missoes).toHaveLength(1);
    expect(antesOrigem.missoes[0].atividades.map((a) => a.titulo)).toEqual([
      'Reuniao na origem',
    ]);

    await service.conciliar(
      origem.id,
      {
        destinoId: destino.id,
        justificativa: 'Os dois cadastros sao a mesma universidade.',
      },
      admin,
    );

    const depoisDestino = await service.historico(destino.id, acessoAmplo);
    // O ponto do teste: duas atividades, uma unica linha de missao.
    expect(depoisDestino.missoes).toHaveLength(1);
    expect(depoisDestino.missoes[0].codigo).toBe('MCG-910');
    expect(depoisDestino.missoes[0].atividades.map((a) => a.titulo)).toEqual([
      'Reuniao na origem',
      'Reuniao no destino',
    ]);
    expect(depoisDestino.parceiro.quantidadeMissoes).toBe(1);

    // A origem continua consultavel — a interface linka para ela a partir do
    // aviso de cadastro conciliado. O que ela perde e o vinculo, nao o acesso.
    const depoisOrigem = await service.historico(origem.id, acessoAmplo);
    expect(depoisOrigem.parceiro).toMatchObject({
      ativo: false,
      substituidaPorId: destino.id,
    });
    expect(depoisOrigem.missoes).toEqual([]);
    expect(depoisOrigem.contatos).toEqual([]);
  });
  // -------------------------------------------------------------------------
  // Relacionamento institucional (BOL-030 a BOL-033)

  it('grava a origem no cadastro e nao a aceita na edicao', async () => {
    const criado = await service.criar(
      parceiroValido('Universidade do Porto', [base.redeId], {
        origemRelacionamento: 'EVENTO_INTERNACIONAL',
        origemObservacao: 'Contato no congresso de 2026.',
      }),
      admin,
    );
    expect(criado.origemRelacionamento).toBe('EVENTO_INTERNACIONAL');

    // A origem e fato historico: o schema de edicao simplesmente nao a tem, e
    // o campo enviado a mais e descartado antes de chegar ao servico.
    const editado = atualizarParceiroSchema.parse({
      cidade: 'Porto',
      origemRelacionamento: 'PROSPECCAO_INSTITUCIONAL',
    });
    expect('origemRelacionamento' in editado).toBe(false);

    await service.atualizar(criado.id, editado, admin);
    const depois = await service.detalhar(criado.id);
    expect(depois.origemRelacionamento).toBe('EVENTO_INTERNACIONAL');
    expect(depois.cidade).toBe('Porto');
  });

  it('deriva mobilidade e parceria em vez de grava-las', async () => {
    const criado = await service.criar(
      parceiroValido('Universidade de Coimbra', [base.redeId], { paisId }),
      admin,
    );

    // Recem-cadastrada: o estagio declarado e o inicial, e nenhum dos dois
    // fatos aconteceu.
    expect(criado.estagioRelacionamento).toBe('IDENTIFICADA');
    expect(criado.mobilidadeRealizada).toBe(false);
    expect(criado.parceriaFormalizada).toBe(false);

    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Bolsista do Parceiro', tipo: 'DISCENTE' })
      .returning({ id: s.pessoa.id });
    await ctx.db.insert(s.bolsaConcedida).values({
      programaId: base.programaId,
      cicloId: base.cicloId,
      ppgId: base.ppgId,
      pessoaId: pessoa.id,
      modalidadeId: base.modalidadeId,
      instituicaoDestinoId: criado.id,
      destino: 'EXTERIOR',
      nivelBeneficiario: 'DOUTORADO',
      dataInicio: '2027-03-01',
      dataFim: '2027-08-31',
      vigenciaMeses: '6.0',
      valorConcedido: '82902.20',
      fluxo: 'OUT',
    });

    // O fato passou a existir sem ninguem editar o cadastro — que e o ponto:
    // um enum gravado continuaria dizendo "apenas identificada".
    const comBolsa = await service.detalhar(criado.id);
    expect(comBolsa.mobilidadeRealizada).toBe(true);
    expect(comBolsa.estagioRelacionamento).toBe('IDENTIFICADA');
    expect(comBolsa.parceriaFormalizada).toBe(false);

    await ctx.db.insert(s.convenio).values({
      instituicaoId: criado.id,
      titulo: 'Acordo de cooperacao',
      tipoAcordo: 'INTERCAMBIO_PESQUISA',
      situacao: 'VIGENTE',
      dataAssinatura: '2027-01-15',
    });
    const comConvenio = await service.detalhar(criado.id);
    expect(comConvenio.parceriaFormalizada).toBe(true);
  });

  it('o historico traz a mobilidade uma vez, com a ponta resolvida', async () => {
    const criado = await service.criar(
      parceiroValido('Universidade de Salamanca', [base.redeId]),
      admin,
    );
    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Pessoa em Dupla Titulacao', tipo: 'DISCENTE' })
      .returning({ id: s.pessoa.id });

    // Origem **e** destino a mesma instituicao: improvavel, mas legitimo numa
    // dupla titulacao. Um `or` dentro de `join` traria a bolsa duas vezes.
    await ctx.db.insert(s.bolsaConcedida).values({
      programaId: base.programaId,
      cicloId: base.cicloId,
      ppgId: base.ppgId,
      pessoaId: pessoa.id,
      modalidadeId: base.modalidadeId,
      instituicaoDestinoId: criado.id,
      instituicaoOrigemId: criado.id,
      areaTematicaId: base.areaTematicaId,
      destino: 'EXTERIOR',
      nivelBeneficiario: 'DOUTORADO',
      dataInicio: '2027-03-01',
      dataFim: '2027-08-31',
      vigenciaMeses: '6.0',
      valorConcedido: '82902.20',
      fluxo: 'OUT',
    });

    const historico = await service.historico(criado.id, acessoAmplo);
    expect(historico.mobilidades).toHaveLength(1);
    expect(historico.mobilidades[0]).toMatchObject({
      bolsista: 'Pessoa em Dupla Titulacao',
      ponta: 'DESTINO',
      ano: 2027,
      tematicaCodigo: 'TESTE-T1',
      rede: 'REDE-TESTE',
    });

    // O vinculo derivado conta concessoes, nao pontas: a bolsa com a
    // instituicao dos dois lados e uma mobilidade so, tambem aqui.
    expect(historico.vinculos).toEqual([
      {
        rede: 'REDE-TESTE',
        tematicaCodigo: 'TESTE-T1',
        tematica: 'Área Temática de Teste',
        ppgs: ['PPGT'],
        mobilidades: 1,
      },
    ]);
  });

  it('parceiro sem mobilidade nao ganha vinculo declarado por ninguem', async () => {
    const criado = await service.criar(
      parceiroValido('Universidade de Bolonha', [base.redeId]),
      admin,
    );
    const historico = await service.historico(criado.id, acessoAmplo);
    // A rede declarada no cadastro continua la; o vinculo por tematica e PPG
    // so nasce quando uma bolsa passa pela instituicao.
    expect(historico.parceiro.redes.map((r) => r.id)).toEqual([base.redeId]);
    expect(historico.vinculos).toEqual([]);
  });
});

function parceiroValido(
  nome: string,
  redeIds: string[],
  sobrescrever: Partial<CriarParceiro> = {},
): CriarParceiro {
  return criarParceiroSchema.parse({
    nome,
    redeIds,
    // Obrigatoria desde a BOL-030: nao se cadastra parceiro sem dizer de onde
    // ele veio. Os casos que testam outra coisa usam o valor mais neutro.
    origemRelacionamento: 'PROSPECCAO_INSTITUCIONAL',
    ...sobrescrever,
  });
}
