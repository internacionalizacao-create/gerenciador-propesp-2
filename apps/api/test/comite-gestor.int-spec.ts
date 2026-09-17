import { and, eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { ComiteGestorService } from '../src/dominio/comite-gestor.service';
import { EncerramentoService } from '../src/dominio/encerramento.service';
import { ResultadosService } from '../src/dominio/resultados.service';
import {
  atualizarMissaoComiteSchema,
  criarMissaoComiteSchema,
  filtroMissoesSchema,
  MissoesComiteService,
  reaberturaMissaoSchema,
  relatarMissaoSchema,
  transicaoMissaoSchema,
  type CriarMissaoComite,
} from '../src/dominio/missoes-comite.service';
import { RecorteDeMissoes } from '../src/auth/escopo';
import * as s from '../src/database/schema';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-keycloak-sub',
  name: 'Admin de Teste',
  roles: ['admin'],
  permissions: [
    'equipe-gestao:read',
    'equipe-gestao:create',
    'equipe-gestao:edit',
    'equipe-gestao:create-pessoa',
  ],
};

describe('ComiteGestorService — equipes', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: ComiteGestorService;
  let missoes: MissoesComiteService;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new ComiteGestorService(ctx.db);
    missoes = new MissoesComiteService(ctx.db, new EncerramentoService(ctx.db));
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
  });

  it('cria pessoa reutilizavel e membro na mesma transacao', async () => {
    const membro = await service.criarMembro(
      base.cicloId,
      {
        novaPessoa: {
          nome: 'Visitante Internacional',
          email: 'visitante@example.org',
          cpf: null,
          tipo: 'EXTERNO',
          ppgId: null,
          instituicaoId: null,
        },
        pessoaId: null,
        tipoEquipe: 'COMITE_GESTOR',
        funcao: 'Articuladora institucional',
        dataInicio: '2027-01-01',
        dataFim: null,
        observacoes: null,
      },
      admin,
    );

    expect(membro.nome).toBe('Visitante Internacional');
    expect(membro.situacao).toBe('FUTURO');
    expect(membro.redes).toEqual([]);
    expect(await service.listarPessoas('visitante')).toHaveLength(1);

    const auditoria = await ctx.db.select().from(s.registroAuditoria);
    expect(auditoria.map((item) => item.entidadeTipo).sort()).toEqual([
      'MEMBRO_EQUIPE_GESTAO',
      'PESSOA',
    ]);
  });

  it('permite a pessoa nas duas equipes', async () => {
    for (const tipoEquipe of ['COMITE_GESTOR', 'ADMINISTRACAO'] as const) {
      await service.criarMembro(
        base.cicloId,
        {
          pessoaId: base.coordenadorTematicaId,
          novaPessoa: null,
          tipoEquipe,
          funcao: tipoEquipe === 'COMITE_GESTOR' ? 'Titular' : 'Apoio',
          dataInicio: '2027-01-01',
          dataFim: null,
          observacoes: null,
        },
        admin,
      );
    }

    expect(await service.listarEquipes(base.cicloId)).toHaveLength(2);
  });

  it('recusa periodos sobrepostos na mesma equipe', async () => {
    const primeiro = {
      pessoaId: base.coordenadorTematicaId,
      novaPessoa: null,
      tipoEquipe: 'COMITE_GESTOR' as const,
      funcao: 'Titular',
      dataInicio: '2027-01-01',
      dataFim: '2027-12-31',
      observacoes: null,
    };
    await service.criarMembro(base.cicloId, primeiro, admin);

    await expect(
      service.criarMembro(
        base.cicloId,
        {
          ...primeiro,
          dataInicio: '2027-06-01',
          dataFim: '2028-05-31',
        },
        admin,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('encerra vinculo e registra auditoria por campo', async () => {
    const criado = await service.criarMembro(
      base.cicloId,
      {
        pessoaId: base.coordenadorTematicaId,
        novaPessoa: null,
        tipoEquipe: 'ADMINISTRACAO',
        funcao: 'Apoio',
        dataInicio: '2027-01-01',
        dataFim: null,
        observacoes: null,
      },
      admin,
    );

    await service.atualizarMembro(
      base.cicloId,
      criado.id,
      {
        tipoEquipe: 'ADMINISTRACAO',
        funcao: 'Apoio administrativo',
        dataInicio: '2027-01-01',
        dataFim: '2027-12-31',
        observacoes: null,
      },
      admin,
    );

    const edicoes = await ctx.db
      .select({ campo: s.registroAuditoria.campo })
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.acao, 'EDICAO'));
    expect(edicoes.map((item) => item.campo).sort()).toEqual([
      'dataFim',
      'funcao',
    ]);
  });

  it('conta as missoes do ciclo por pessoa, e nao por vinculo', async () => {
    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ codigoIso2: 'PT', codigoIso3: 'PRT', nome: 'Portugal' })
      .returning({ id: s.pais.id });

    // A mesma pessoa nas duas equipes; a segunda pessoa nao viaja.
    for (const tipoEquipe of ['COMITE_GESTOR', 'ADMINISTRACAO'] as const) {
      await service.criarMembro(
        base.cicloId,
        {
          pessoaId: base.coordenadorTematicaId,
          novaPessoa: null,
          tipoEquipe,
          funcao: 'Titular',
          dataInicio: '2027-01-01',
          dataFim: null,
          observacoes: null,
        },
        admin,
      );
    }

    const semMissao = await service.criarMembro(
      base.cicloId,
      {
        pessoaId: null,
        novaPessoa: {
          nome: 'Apoio sem viagem',
          email: null,
          cpf: null,
          tipo: 'EXTERNO',
          ppgId: null,
          instituicaoId: null,
        },
        tipoEquipe: 'ADMINISTRACAO',
        funcao: 'Secretaria',
        dataInicio: '2027-01-01',
        dataFim: null,
        observacoes: null,
      },
      admin,
    );

    const missao = (titulo: string): CriarMissaoComite => ({
      titulo,
      objetivo: 'Articulacao institucional em Lisboa.',
      dataInicio: '2027-05-01',
      dataFim: '2027-05-10',
      status: 'PLANEJADA',
      observacoes: null,
      redes: [base.redeId],
      participantes: [
        {
          pessoaId: base.coordenadorTematicaId,
          novaPessoa: null,
          // Sem apontar o vinculo de proposito: contar pelo `membroEquipeId`
          // perderia justamente esta participacao.
          membroEquipeId: null,
          papel: 'RESPONSAVEL',
          observacoes: null,
        },
      ],
      atividades: [
        {
          tipo: 'ARTICULACAO',
          titulo: 'Reuniao em Lisboa',
          paisId: pais.id,
          cidade: 'Lisboa',
          instituicaoId: base.instituicaoId,
          instituicaoNome: null,
          eventoNome: null,
          dataInicio: '2027-05-02',
          dataFim: '2027-05-08',
          planejamento: null,
          observacoes: null,
        },
      ],
    });

    await missoes.criar(
      base.cicloId,
      missao('Primeira missao'),
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    await missoes.criar(
      base.cicloId,
      missao('Segunda missao'),
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    const equipes = await service.listarEquipes(base.cicloId);
    const doCoordenador = equipes.filter(
      (membro) => membro.pessoaId === base.coordenadorTematicaId,
    );

    // Dois vinculos, o mesmo numero: a pergunta e sobre a pessoa.
    expect(doCoordenador).toHaveLength(2);
    expect(doCoordenador.map((membro) => membro.missoes)).toEqual([2, 2]);

    // Zero e um fato, nao ausencia de dado.
    expect(equipes.find((membro) => membro.id === semMissao.id)?.missoes).toBe(
      0,
    );
  });

  it('nao conta missoes de outro ciclo na equipe', async () => {
    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ codigoIso2: 'ES', codigoIso3: 'ESP', nome: 'Espanha' })
      .returning({ id: s.pais.id });

    const [outro] = await ctx.db
      .insert(s.ciclo)
      .values({
        programaId: base.programaId,
        nome: '2031-2034',
        anoInicio: 2031,
        anoFim: 2034,
      })
      .returning({ id: s.ciclo.id });

    // A rede pertence ao ciclo: a missao do ciclo seguinte precisa da rede dele.
    const [redeDoOutroCiclo] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId: outro.id,
        instituicaoId: base.instituicaoId,
        nome: 'UFMG',
      })
      .returning({ id: s.redeCoordenadora.id });

    await service.criarMembro(
      base.cicloId,
      {
        pessoaId: base.coordenadorTematicaId,
        novaPessoa: null,
        tipoEquipe: 'COMITE_GESTOR',
        funcao: 'Titular',
        dataInicio: '2027-01-01',
        dataFim: null,
        observacoes: null,
      },
      admin,
    );

    await missoes.criar(
      outro.id,
      {
        titulo: 'Missao do ciclo seguinte',
        objetivo: 'Nao deve aparecer na contagem do ciclo atual.',
        dataInicio: '2031-05-01',
        dataFim: '2031-05-10',
        status: 'PLANEJADA',
        observacoes: null,
        redes: [redeDoOutroCiclo.id],
        participantes: [
          {
            pessoaId: base.coordenadorTematicaId,
            novaPessoa: null,
            membroEquipeId: null,
            papel: 'RESPONSAVEL',
            observacoes: null,
          },
        ],
        atividades: [
          {
            tipo: 'ARTICULACAO',
            titulo: 'Reuniao em Madri',
            paisId: pais.id,
            cidade: 'Madri',
            instituicaoId: base.instituicaoId,
            instituicaoNome: null,
            eventoNome: null,
            dataInicio: '2031-05-02',
            dataFim: '2031-05-08',
            planejamento: null,
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    const equipes = await service.listarEquipes(base.cicloId);
    expect(equipes).toHaveLength(1);
    expect(equipes[0].missoes).toBe(0);
  });
});

const adminMissoes: AuthUser = {
  id: 'admin-keycloak-sub',
  name: 'Admin de Teste',
  roles: ['admin'],
  permissions: [
    'missao:read',
    'missao:create',
    'missao:relato',
    'missao:confirm',
    'missao:cancel',
    'missao:close',
    'produto-missao:create',
    'produto-missao:edit',
    'produto-missao:delete',
    'produto-missao:declare',
  ],
};

describe('MissoesComiteService — criacao transacional', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: MissoesComiteService;
  let paises: { id: string }[];

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new MissoesComiteService(ctx.db, new EncerramentoService(ctx.db));
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    paises = await ctx.db
      .insert(s.pais)
      .values([
        { codigoIso2: 'FR', codigoIso3: 'FRA', nome: 'Franca' },
        { codigoIso2: 'DE', codigoIso3: 'DEU', nome: 'Alemanha' },
      ])
      .returning({ id: s.pais.id });
  });

  function missaoValida(): CriarMissaoComite {
    return {
      titulo: 'Missao de articulacao na Europa',
      objetivo: 'Consolidar acordos de cotutela com duas universidades.',
      dataInicio: '2027-03-01',
      dataFim: '2027-03-20',
      status: 'PLANEJADA',
      observacoes: null,
      redes: [base.redeId],
      participantes: [
        {
          pessoaId: base.coordenadorTematicaId,
          novaPessoa: null,
          membroEquipeId: null,
          papel: 'RESPONSAVEL',
          observacoes: null,
        },
      ],
      atividades: [
        {
          tipo: 'VISITA_TECNICA',
          titulo: 'Visita tecnica em Paris',
          paisId: paises[0].id,
          cidade: 'Paris',
          instituicaoId: base.instituicaoId,
          instituicaoNome: null,
          eventoNome: null,
          dataInicio: '2027-03-02',
          dataFim: '2027-03-06',
          planejamento: null,
          observacoes: null,
        },
        {
          tipo: 'EVENTO',
          titulo: 'Congresso em Berlim',
          paisId: paises[1].id,
          cidade: 'Berlim',
          instituicaoId: null,
          instituicaoNome: 'Freie Universitat Berlin',
          eventoNome: 'Semana da Cooperacao Internacional',
          dataInicio: '2027-03-10',
          dataFim: '2027-03-18',
          planejamento: null,
          observacoes: null,
        },
      ],
    };
  }

  it('lista paises e instituicoes ativas para o formulario', async () => {
    const referencias = await service.referencias(
      base.cicloId,
      RecorteDeMissoes.irrestrito(),
    );

    expect(referencias.paises.map((pais) => pais.nome)).toEqual([
      'Alemanha',
      'Franca',
    ]);
    expect(
      referencias.instituicoes.some(
        (instituicao) => instituicao.id === base.instituicaoId,
      ),
    ).toBe(true);
  });

  it('cria missao com roteiro em varios paises e sem qualquer dado financeiro', async () => {
    const missao = await service.criar(
      base.cicloId,
      missaoValida(),
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    expect(missao.codigo).toBe('MCG-001');
    expect(missao.participantes).toBe(1);
    expect(missao.atividades).toBe(2);

    const persistida = await ctx.db.query.missaoComite.findFirst({
      where: eq(s.missaoComite.id, missao.id),
      with: { participantes: true, atividades: true },
    });
    expect(persistida?.status).toBe('PLANEJADA');
    expect(persistida?.participantes).toHaveLength(1);
    expect(
      new Set(persistida?.atividades.map((atividade) => atividade.paisId)),
    ).toEqual(new Set(paises.map((pais) => pais.id)));
    // A ordem do roteiro segue a ordem enviada pelo formulario.
    expect(
      persistida?.atividades.map((atividade) => atividade.ordem).sort(),
    ).toEqual([1, 2]);

    // A missao nasce sem prestacao e sem lancamento financeiro.
    expect(await ctx.db.select().from(s.lancamentoExecucao)).toHaveLength(0);

    const auditoria = await ctx.db
      .select()
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeTipo, 'MISSAO_COMITE'));
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].acao).toBe('CRIACAO');
  });

  it('recusa contato que nao pertence a instituicao da atividade', async () => {
    const [outraInstituicao] = await ctx.db
      .insert(s.instituicao)
      .values({
        nome: 'Outra Universidade',
        nomeNormalizado: 'outra universidade',
        tipo: 'PARCEIRA_INTERNACIONAL',
      })
      .returning();
    const [contato] = await ctx.db
      .insert(s.contatoInstituicao)
      .values({
        instituicaoId: outraInstituicao.id,
        nome: 'Contato de Outra Universidade',
        nomeNormalizado: 'contato de outra universidade',
      })
      .returning();
    const dto = missaoValida();
    dto.atividades[0].contatoInstituicaoId = contato.id;

    await expect(
      service.criar(
        base.cicloId,
        dto,
        adminMissoes,
        RecorteDeMissoes.irrestrito(),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await ctx.db.select().from(s.missaoComite)).toHaveLength(0);
  });

  it('gera codigos sequenciais por ciclo', async () => {
    await service.criar(
      base.cicloId,
      missaoValida(),
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    const segunda = await service.criar(
      base.cicloId,
      missaoValida(),
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    expect(segunda.codigo).toBe('MCG-002');
  });

  it('cadastra pessoa nova junto da missao e a reutiliza depois', async () => {
    const dto = missaoValida();
    dto.participantes.push({
      pessoaId: null,
      novaPessoa: {
        nome: 'Convidada Externa',
        email: 'convidada@example.org',
        cpf: null,
        tipo: 'EXTERNO',
        ppgId: null,
        instituicaoId: null,
      },
      membroEquipeId: null,
      papel: 'PARTICIPANTE',
      observacoes: null,
    });

    const missao = await service.criar(
      base.cicloId,
      dto,
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    expect(missao.participantes).toBe(2);

    const [criada] = await ctx.db
      .select({ id: s.pessoa.id })
      .from(s.pessoa)
      .where(eq(s.pessoa.email, 'convidada@example.org'));
    expect(criada).toBeDefined();
  });

  it('desfaz a missao inteira quando o roteiro referencia pais inexistente', async () => {
    const dto = missaoValida();
    dto.atividades[1].paisId = '00000000-0000-4000-8000-000000000000';
    dto.participantes.push({
      pessoaId: null,
      novaPessoa: {
        nome: 'Participante Que Nao Deve Existir',
        email: 'fantasma@example.org',
        cpf: null,
        tipo: 'EXTERNO',
        ppgId: null,
        instituicaoId: null,
      },
      membroEquipeId: null,
      papel: 'APOIO',
      observacoes: null,
    });

    await expect(
      service.criar(
        base.cicloId,
        dto,
        adminMissoes,
        RecorteDeMissoes.irrestrito(),
      ),
    ).rejects.toMatchObject({ status: 404 });

    // Nada pode sobreviver ao rollback: nem missao, nem participante, nem a
    // pessoa criada no meio do caminho.
    expect(await ctx.db.select().from(s.missaoComite)).toHaveLength(0);
    expect(await ctx.db.select().from(s.missaoParticipante)).toHaveLength(0);
    expect(
      await ctx.db
        .select()
        .from(s.pessoa)
        .where(eq(s.pessoa.email, 'fantasma@example.org')),
    ).toHaveLength(0);
  });

  it('recusa vinculo de equipe que pertence a outra pessoa', async () => {
    const [outra] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Outra Pessoa', tipo: 'DOCENTE' })
      .returning({ id: s.pessoa.id });
    const [membro] = await ctx.db
      .insert(s.membroEquipeGestao)
      .values({
        cicloId: base.cicloId,
        pessoaId: outra.id,
        tipoEquipe: 'COMITE_GESTOR',
        funcao: 'Titular',
        dataInicio: '2027-01-01',
      })
      .returning({ id: s.membroEquipeGestao.id });

    const dto = missaoValida();
    dto.participantes[0].membroEquipeId = membro.id;

    await expect(
      service.criar(
        base.cicloId,
        dto,
        adminMissoes,
        RecorteDeMissoes.irrestrito(),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await ctx.db.select().from(s.missaoComite)).toHaveLength(0);
  });
});

describe('criarMissaoComiteSchema', () => {
  const valido = {
    titulo: 'Missao de teste',
    objetivo: 'Objetivo suficientemente descritivo.',
    dataInicio: '2027-03-01',
    dataFim: '2027-03-10',
    redes: ['44444444-4444-4444-8444-444444444444'],
    participantes: [
      {
        pessoaId: '11111111-1111-4111-8111-111111111111',
        papel: 'RESPONSAVEL',
      },
    ],
    atividades: [
      {
        tipo: 'EVENTO',
        titulo: 'Evento de teste',
        eventoNome: 'Evento de Teste',
        paisId: '22222222-2222-4222-8222-222222222222',
        dataInicio: '2027-03-02',
        dataFim: '2027-03-05',
      },
    ],
  };

  it('aceita um roteiro minimo e assume RASCUNHO', () => {
    const analise = criarMissaoComiteSchema.safeParse(valido);
    expect(analise.success).toBe(true);
    expect(analise.data?.status).toBe('RASCUNHO');
  });

  it('exige pelo menos um participante', () => {
    const analise = criarMissaoComiteSchema.safeParse({
      ...valido,
      participantes: [],
    });
    expect(analise.success).toBe(false);
  });

  it('exige exatamente um participante responsavel', () => {
    expect(
      criarMissaoComiteSchema.safeParse({
        ...valido,
        participantes: valido.participantes.map((participante) => ({
          ...participante,
          papel: 'PARTICIPANTE',
        })),
      }).success,
    ).toBe(false);
    expect(
      criarMissaoComiteSchema.safeParse({
        ...valido,
        participantes: [
          ...valido.participantes,
          {
            pessoaId: '55555555-5555-4555-8555-555555555555',
            papel: 'RESPONSAVEL',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('recusa participacao fora do periodo da missao', () => {
    const analise = criarMissaoComiteSchema.safeParse({
      ...valido,
      participantes: [
        {
          ...valido.participantes[0],
          dataInicio: '2027-02-28',
          dataFim: '2027-03-05',
        },
      ],
    });
    expect(analise.success).toBe(false);
  });

  it('recusa periodo invertido da missao', () => {
    const analise = criarMissaoComiteSchema.safeParse({
      ...valido,
      dataFim: '2027-02-01',
    });
    expect(analise.success).toBe(false);
  });

  it('recusa atividade fora do periodo da missao', () => {
    const analise = criarMissaoComiteSchema.safeParse({
      ...valido,
      atividades: [{ ...valido.atividades[0], dataFim: '2027-04-01' }],
    });
    expect(analise.success).toBe(false);
  });

  it('recusa a mesma pessoa duas vezes', () => {
    const analise = criarMissaoComiteSchema.safeParse({
      ...valido,
      participantes: [...valido.participantes, ...valido.participantes],
    });
    expect(analise.success).toBe(false);
  });

  it('recusa instituicao do catalogo junto com nome livre', () => {
    const analise = criarMissaoComiteSchema.safeParse({
      ...valido,
      atividades: [
        {
          ...valido.atividades[0],
          instituicaoId: '33333333-3333-4333-8333-333333333333',
          instituicaoNome: 'Universidade Livre',
        },
      ],
    });
    expect(analise.success).toBe(false);
  });

  it('exige nome quando a atividade e evento', () => {
    const analise = criarMissaoComiteSchema.safeParse({
      ...valido,
      atividades: [{ ...valido.atividades[0], eventoNome: null }],
    });
    expect(analise.success).toBe(false);
  });
});

describe('MissoesComiteService — lista e filtros', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: MissoesComiteService;
  let equipe: ComiteGestorService;
  let paises: { id: string; nome: string }[];

  const filtroPadrao = filtroMissoesSchema.parse({});

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new MissoesComiteService(ctx.db, new EncerramentoService(ctx.db));
    equipe = new ComiteGestorService(ctx.db);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  /** Tres missoes com periodos, paises e situacoes deliberadamente distintos. */
  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    paises = await ctx.db
      .insert(s.pais)
      .values([
        { codigoIso2: 'FR', codigoIso3: 'FRA', nome: 'Franca' },
        { codigoIso2: 'PT', codigoIso3: 'PRT', nome: 'Portugal' },
      ])
      .returning({ id: s.pais.id, nome: s.pais.nome });

    const [externa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Convidada Externa', tipo: 'EXTERNO' })
      .returning({ id: s.pessoa.id });

    // Somente a coordenadora integra o Comite Gestor; a convidada nao.
    await equipe.criarMembro(
      base.cicloId,
      {
        pessoaId: base.coordenadorTematicaId,
        novaPessoa: null,
        tipoEquipe: 'COMITE_GESTOR',
        funcao: 'Titular',
        dataInicio: '2027-01-01',
        dataFim: null,
        observacoes: null,
      },
      admin,
    );

    await service.criar(
      base.cicloId,
      {
        titulo: 'Missao de articulacao em Paris',
        objetivo: 'Negociar acordos de cotutela com parceiros franceses.',
        dataInicio: '2020-03-01',
        dataFim: '2020-03-10',
        status: 'PLANEJADA',
        observacoes: null,
        redes: [base.redeId],
        participantes: [
          {
            pessoaId: base.coordenadorTematicaId,
            novaPessoa: null,
            membroEquipeId: null,
            papel: 'RESPONSAVEL',
            observacoes: null,
          },
        ],
        atividades: [
          {
            tipo: 'VISITA_TECNICA',
            titulo: 'Visita a universidade parceira',
            paisId: paises[0].id,
            cidade: 'Paris',
            instituicaoId: base.instituicaoId,
            instituicaoNome: null,
            eventoNome: null,
            dataInicio: '2020-03-02',
            dataFim: '2020-03-08',
            planejamento: null,
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    await service.criar(
      base.cicloId,
      {
        titulo: 'Congresso ibero-americano',
        objetivo: 'Representar o programa no encontro anual de reitores.',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-09',
        status: 'CONFIRMADA',
        observacoes: null,
        redes: [base.redeId],
        participantes: [
          {
            pessoaId: externa.id,
            novaPessoa: null,
            membroEquipeId: null,
            papel: 'PARTICIPANTE',
            observacoes: null,
          },
        ],
        atividades: [
          {
            tipo: 'EVENTO',
            titulo: 'Mesa redonda de abertura',
            paisId: paises[1].id,
            cidade: 'Lisboa',
            instituicaoId: null,
            instituicaoNome: 'Universidade Nova de Lisboa',
            eventoNome: 'Encontro Ibero-Americano de Reitores',
            dataInicio: '2027-05-02',
            dataFim: '2027-05-08',
            planejamento: null,
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    await service.criar(
      base.cicloId,
      {
        titulo: 'Missao cancelada de prospeccao',
        objetivo: 'Prospeccao suspensa por indisponibilidade de agenda.',
        dataInicio: '2029-08-01',
        dataFim: '2029-08-05',
        status: 'RASCUNHO',
        observacoes: null,
        redes: [base.redeId],
        participantes: [
          {
            pessoaId: base.coordenadorTematicaId,
            novaPessoa: null,
            membroEquipeId: null,
            papel: 'RESPONSAVEL',
            observacoes: null,
          },
        ],
        atividades: [
          {
            tipo: 'ARTICULACAO',
            titulo: 'Reuniao de prospeccao',
            paisId: paises[0].id,
            cidade: 'Lyon',
            instituicaoId: null,
            instituicaoNome: null,
            eventoNome: null,
            dataInicio: '2029-08-02',
            dataFim: '2029-08-04',
            planejamento: null,
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
  });

  function listar(filtro: Record<string, unknown> = {}) {
    return service.listar(
      base.cicloId,
      filtroMissoesSchema.parse(filtro),
      RecorteDeMissoes.irrestrito(),
    );
  }

  it('lista todas as missoes do ciclo com contagens e paises', async () => {
    const pagina = await service.listar(
      base.cicloId,
      filtroPadrao,
      RecorteDeMissoes.irrestrito(),
    );

    expect(pagina.total).toBe(3);
    expect(pagina.paginas).toBe(1);
    // Sem filtro, a ordem padrao e o periodo mais recente primeiro.
    expect(pagina.itens.map((item) => item.codigo)).toEqual([
      'MCG-003',
      'MCG-002',
      'MCG-001',
    ]);

    const paris = pagina.itens.find((item) => item.codigo === 'MCG-001')!;
    expect(paris.participantes).toBe(1);
    expect(paris.atividades).toBe(1);
    expect(paris.paises).toEqual(['Franca']);
    // Sem prestacao a missao nao vale R$ 0,00: o valor e explicitamente nulo.
    expect(paris.valorPrestado).toBeNull();
    expect(paris.situacaoPrestacao).toBe('NAO_INICIADA');
  });

  it('calcula a situacao temporal a partir das datas', async () => {
    // Datas relativas ao dia da execucao: uma missao "em andamento" nao pode
    // depender de constante que envelhece junto com o repositorio.
    const dia = (deslocamento: number) => {
      const data = new Date();
      data.setUTCDate(data.getUTCDate() + deslocamento);
      return data.toISOString().slice(0, 10);
    };
    const emAndamento = await service.criar(
      base.cicloId,
      {
        titulo: 'Missao em curso',
        objetivo: 'Missao que atravessa a data de hoje.',
        dataInicio: dia(-3),
        dataFim: dia(3),
        status: 'CONFIRMADA',
        observacoes: null,
        redes: [base.redeId],
        participantes: [
          {
            pessoaId: base.coordenadorTematicaId,
            novaPessoa: null,
            membroEquipeId: null,
            papel: 'RESPONSAVEL',
            observacoes: null,
          },
        ],
        atividades: [
          {
            tipo: 'OUTRO',
            titulo: 'Agenda em curso',
            paisId: paises[0].id,
            cidade: null,
            instituicaoId: null,
            instituicaoNome: null,
            eventoNome: null,
            dataInicio: dia(-2),
            dataFim: dia(2),
            planejamento: null,
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    const pagina = await service.listar(
      base.cicloId,
      filtroPadrao,
      RecorteDeMissoes.irrestrito(),
    );
    const porCodigo = Object.fromEntries(
      pagina.itens.map((item) => [item.codigo, item.situacaoTemporal]),
    );
    expect(porCodigo['MCG-001']).toBe('ENCERRADA');
    expect(porCodigo[emAndamento.codigo]).toBe('EM_ANDAMENTO');
    expect(porCodigo['MCG-003']).toBe('FUTURA');

    expect(
      (await listar({ situacaoTemporal: 'EM_ANDAMENTO' })).itens.map(
        (item) => item.codigo,
      ),
    ).toEqual([emAndamento.codigo]);
    expect(
      (await listar({ situacaoTemporal: 'FUTURA' })).itens.map(
        (item) => item.codigo,
      ),
    ).toContain('MCG-003');
    expect(
      (await listar({ situacaoTemporal: 'ENCERRADA' })).itens.map(
        (item) => item.codigo,
      ),
    ).toEqual(['MCG-001']);
  });

  it('busca por codigo, titulo, instituicao e evento', async () => {
    expect((await listar({ busca: 'MCG-002' })).total).toBe(1);
    expect((await listar({ busca: 'ibero' })).total).toBe(1);
    // Instituicao do catalogo, pelo nome cadastrado na fixture.
    expect(
      (await listar({ busca: 'Universidade de Teste' })).itens[0].codigo,
    ).toBe('MCG-001');
    // Instituicao informada como texto livre na atividade.
    expect((await listar({ busca: 'Nova de Lisboa' })).itens[0].codigo).toBe(
      'MCG-002',
    );
    // Nome do evento.
    expect((await listar({ busca: 'Encontro Ibero' })).itens[0].codigo).toBe(
      'MCG-002',
    );
    expect((await listar({ busca: 'inexistente' })).total).toBe(0);
  });

  it('filtra por exercicio, periodo, pais, status e participante', async () => {
    expect((await listar({ ano: 2027 })).itens.map((i) => i.codigo)).toEqual([
      'MCG-002',
    ]);
    expect((await listar({ de: '2027-01-01', ate: '2030-12-31' })).total).toBe(
      2,
    );
    expect(
      (await listar({ paisId: paises[0].id })).itens
        .map((i) => i.codigo)
        .sort(),
    ).toEqual(['MCG-001', 'MCG-003']);
    expect((await listar({ status: 'CONFIRMADA' })).total).toBe(1);
    expect((await listar({ pessoaId: base.coordenadorTematicaId })).total).toBe(
      2,
    );
  });

  it('filtra por equipe mesmo sem vinculo apontado no participante', async () => {
    const comite = await listar({ tipoEquipe: 'COMITE_GESTOR' });
    expect(comite.itens.map((item) => item.codigo).sort()).toEqual([
      'MCG-001',
      'MCG-003',
    ]);
    expect((await listar({ tipoEquipe: 'ADMINISTRACAO' })).total).toBe(0);
  });

  it('combina filtros sem depender da ordem', async () => {
    const pagina = await listar({
      tipoEquipe: 'COMITE_GESTOR',
      paisId: paises[0].id,
      situacaoTemporal: 'FUTURA',
    });
    expect(pagina.itens.map((item) => item.codigo)).toEqual(['MCG-003']);
  });

  it('pagina e ordena preservando o total', async () => {
    const primeira = await listar({
      tamanho: 2,
      pagina: 1,
      ordenar: 'CODIGO',
      direcao: 'ASC',
    });
    expect(primeira.total).toBe(3);
    expect(primeira.paginas).toBe(2);
    expect(primeira.itens.map((item) => item.codigo)).toEqual([
      'MCG-001',
      'MCG-002',
    ]);

    const segunda = await listar({
      tamanho: 2,
      pagina: 2,
      ordenar: 'CODIGO',
      direcao: 'ASC',
    });
    expect(segunda.itens.map((item) => item.codigo)).toEqual(['MCG-003']);
    expect(segunda.total).toBe(3);
  });

  it('devolve pagina vazia coerente quando nada casa', async () => {
    const pagina = await listar({ ano: 2035 });
    expect(pagina).toMatchObject({ itens: [], total: 0, paginas: 1 });
  });

  it('nao vaza missoes de outro ciclo', async () => {
    const [outro] = await ctx.db
      .insert(s.ciclo)
      .values({
        programaId: base.programaId,
        nome: '2031-2034',
        anoInicio: 2031,
        anoFim: 2034,
      })
      .returning({ id: s.ciclo.id });

    expect(
      (
        await service.listar(
          outro.id,
          filtroPadrao,
          RecorteDeMissoes.irrestrito(),
        )
      ).total,
    ).toBe(0);
    expect(
      (
        await service.listar(
          base.cicloId,
          filtroPadrao,
          RecorteDeMissoes.irrestrito(),
        )
      ).total,
    ).toBe(3);
  });
});

describe('MissoesComiteService — detalhe', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: MissoesComiteService;
  let equipe: ComiteGestorService;
  let paises: { id: string; nome: string }[];

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new MissoesComiteService(ctx.db, new EncerramentoService(ctx.db));
    equipe = new ComiteGestorService(ctx.db);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    paises = await ctx.db
      .insert(s.pais)
      .values([
        { codigoIso2: 'FR', codigoIso3: 'FRA', nome: 'Franca' },
        { codigoIso2: 'PT', codigoIso3: 'PRT', nome: 'Portugal' },
      ])
      .returning({ id: s.pais.id, nome: s.pais.nome });
  });

  async function criarMissaoCompleta() {
    const membro = await equipe.criarMembro(
      base.cicloId,
      {
        pessoaId: base.coordenadorTematicaId,
        novaPessoa: null,
        tipoEquipe: 'COMITE_GESTOR',
        funcao: 'Coordenadora executiva',
        dataInicio: '2027-01-01',
        dataFim: null,
        observacoes: null,
      },
      admin,
    );
    const [externa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Adriana Externa', tipo: 'EXTERNO' })
      .returning({ id: s.pessoa.id });
    const [contato] = await ctx.db
      .insert(s.contatoInstituicao)
      .values({
        instituicaoId: base.instituicaoId,
        nome: 'Marie Dupont',
        nomeNormalizado: 'marie dupont',
        principal: true,
      })
      .returning({ id: s.contatoInstituicao.id });

    return service.criar(
      base.cicloId,
      {
        tipo: 'ARTICULACAO',
        unidadeDepartamento: 'Assessoria de Relacoes Internacionais',
        titulo: 'Missao completa',
        objetivo: 'Cobrir todos os campos do detalhe da missao.',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-20',
        status: 'PLANEJADA',
        observacoes: 'Observacao geral da missao.',
        redes: [base.redeId],
        participantes: [
          {
            pessoaId: externa.id,
            novaPessoa: null,
            membroEquipeId: null,
            papel: 'PARTICIPANTE',
            cargo: 'Pesquisadora visitante',
            area: 'Cooperacao academica',
            dataInicio: '2027-05-03',
            dataFim: '2027-05-12',
            observacoes: null,
          },
          {
            pessoaId: base.coordenadorTematicaId,
            novaPessoa: null,
            membroEquipeId: membro.id,
            papel: 'RESPONSAVEL',
            cargo: 'Coordenadora',
            area: 'Internacionalizacao',
            dataInicio: '2027-05-01',
            dataFim: '2027-05-20',
            observacoes: 'Assina os acordos.',
          },
        ],
        atividades: [
          {
            tipo: 'VISITA_TECNICA',
            titulo: 'Visita ao laboratorio parceiro',
            paisId: paises[0].id,
            cidade: 'Paris',
            estadoRegiao: 'Ile-de-France',
            local: 'Campus Central',
            endereco: '3 rue de Teste, Paris',
            instituicaoId: base.instituicaoId,
            instituicaoNome: null,
            contatoInstituicaoId: contato.id,
            tipoRelacionamento: 'COOPERACAO_ACADEMICA',
            objetivoRelacionamento: 'Preparar acordo de cotutela.',
            eventoNome: null,
            dataInicio: '2027-05-02',
            dataFim: '2027-05-06',
            planejamento: 'Reconhecer a infraestrutura de pesquisa.',
            observacoes: null,
          },
          {
            tipo: 'EVENTO',
            titulo: 'Painel de cooperacao',
            paisId: paises[1].id,
            cidade: 'Lisboa',
            instituicaoId: null,
            instituicaoNome: 'Universidade Nova de Lisboa',
            eventoNome: 'Semana da Cooperacao',
            eventoTipo: 'Congresso',
            eventoSite: 'https://evento.example.org',
            objetivoParticipacao: 'Apresentar o programa CAPES Global.',
            relacaoInternacionalizacao:
              'Prospeccao de novas mobilidades academicas.',
            dataInicio: '2027-05-10',
            dataFim: '2027-05-18',
            planejamento: null,
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
  }

  it('retorna dados basicos, roteiro ordenado, participantes e historico', async () => {
    const criada = await criarMissaoCompleta();
    const detalhe = await service.detalhe(base.cicloId, criada.id);

    expect(detalhe).toMatchObject({
      codigo: 'MCG-001',
      tipo: 'ARTICULACAO',
      unidadeDepartamento: 'Assessoria de Relacoes Internacionais',
      titulo: 'Missao completa',
      status: 'PLANEJADA',
      numeroDias: 20,
      observacoes: 'Observacao geral da missao.',
    });
    expect(detalhe.paises).toEqual(['Franca', 'Portugal']);

    // O roteiro sai na ordem enviada no cadastro.
    expect(detalhe.atividades.map((a) => a.ordem)).toEqual([1, 2]);
    expect(detalhe.atividades[0]).toMatchObject({
      pais: 'Franca',
      instituicao: 'Universidade de Teste',
      instituicaoDoCatalogo: true,
      estadoRegiao: 'Ile-de-France',
      local: 'Campus Central',
      endereco: '3 rue de Teste, Paris',
      contatoInstituicao: 'Marie Dupont',
      tipoRelacionamento: 'COOPERACAO_ACADEMICA',
      objetivoRelacionamento: 'Preparar acordo de cotutela.',
      numeroDias: 5,
    });
    expect(detalhe.atividades[1]).toMatchObject({
      pais: 'Portugal',
      instituicao: 'Universidade Nova de Lisboa',
      instituicaoDoCatalogo: false,
      eventoNome: 'Semana da Cooperacao',
      eventoTipo: 'Congresso',
      eventoSite: 'https://evento.example.org',
      objetivoParticipacao: 'Apresentar o programa CAPES Global.',
      relacaoInternacionalizacao: 'Prospeccao de novas mobilidades academicas.',
      numeroDias: 9,
    });

    // Responsavel primeiro, e o vinculo de equipe so aparece quando informado.
    expect(detalhe.participantes.map((p) => p.papel)).toEqual([
      'RESPONSAVEL',
      'PARTICIPANTE',
    ]);
    expect(detalhe.participantes[0]).toMatchObject({
      tipoEquipe: 'COMITE_GESTOR',
      funcaoEquipe: 'Coordenadora executiva',
      cargo: 'Coordenadora',
      area: 'Internacionalizacao',
      numeroDias: 20,
    });
    expect(detalhe.participantes[1]).toMatchObject({
      nome: 'Adriana Externa',
      tipoEquipe: null,
      funcaoEquipe: null,
      cargo: 'Pesquisadora visitante',
      area: 'Cooperacao academica',
      dataInicio: '2027-05-03',
      dataFim: '2027-05-12',
      numeroDias: 10,
    });

    expect(detalhe.historico).toHaveLength(1);
    expect(detalhe.historico[0].acao).toBe('CRIACAO');
  });

  it('declara a ausencia de prestacao em vez de devolver zero', async () => {
    const criada = await criarMissaoCompleta();
    const detalhe = await service.detalhe(base.cicloId, criada.id);

    expect(detalhe.prestacao).toBeNull();
    expect(detalhe.situacaoPrestacao).toBe('NAO_INICIADA');
    expect(detalhe.documentos).toEqual([]);
    expect(detalhe.totais).toEqual({
      passagens: null,
      diarias: null,
      geral: null,
      porExercicio: [],
    });
    // Nenhum total pode chegar como number: dinheiro so trafega como string.
    for (const valor of Object.values(detalhe.totais)) {
      expect(typeof valor).not.toBe('number');
    }
  });

  it('a situacao temporal do detalhe acompanha a da listagem', async () => {
    const criada = await criarMissaoCompleta();
    const detalhe = await service.detalhe(base.cicloId, criada.id);
    const [resumo] = (
      await service.listar(
        base.cicloId,
        filtroMissoesSchema.parse({}),
        RecorteDeMissoes.irrestrito(),
      )
    ).itens;
    expect(detalhe.situacaoTemporal).toBe(resumo.situacaoTemporal);
  });

  it('recusa missao de outro ciclo', async () => {
    const criada = await criarMissaoCompleta();
    const [outro] = await ctx.db
      .insert(s.ciclo)
      .values({
        programaId: base.programaId,
        nome: '2031-2034',
        anoInicio: 2031,
        anoFim: 2034,
      })
      .returning({ id: s.ciclo.id });

    await expect(service.detalhe(outro.id, criada.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('recusa identificador inexistente', async () => {
    await expect(
      service.detalhe(base.cicloId, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('MissoesComiteService — edicao com auditoria', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: MissoesComiteService;
  let paises: { id: string; nome: string }[];

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new MissoesComiteService(ctx.db, new EncerramentoService(ctx.db));
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    paises = await ctx.db
      .insert(s.pais)
      .values([
        { codigoIso2: 'FR', codigoIso3: 'FRA', nome: 'Franca' },
        { codigoIso2: 'PT', codigoIso3: 'PRT', nome: 'Portugal' },
      ])
      .returning({ id: s.pais.id, nome: s.pais.nome });
  });

  async function criar(status: 'RASCUNHO' | 'PLANEJADA' = 'PLANEJADA') {
    const criada = await service.criar(
      base.cicloId,
      {
        titulo: 'Missao editavel',
        objetivo: 'Missao usada para exercitar a edicao e a auditoria.',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-20',
        status,
        observacoes: null,
        redes: [base.redeId],
        participantes: [
          {
            pessoaId: base.coordenadorTematicaId,
            novaPessoa: null,
            membroEquipeId: null,
            papel: 'RESPONSAVEL',
            observacoes: null,
          },
        ],
        atividades: [
          {
            tipo: 'VISITA_TECNICA',
            titulo: 'Visita inicial',
            paisId: paises[0].id,
            cidade: 'Paris',
            instituicaoId: null,
            instituicaoNome: null,
            eventoNome: null,
            dataInicio: '2027-05-02',
            dataFim: '2027-05-06',
            planejamento: null,
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    return service.detalhe(base.cicloId, criada.id);
  }

  /** Payload de edicao que reproduz exatamente o estado atual da missao. */
  function payloadDe(detalhe: Awaited<ReturnType<typeof criar>>) {
    return atualizarMissaoComiteSchema.parse({
      tipo: detalhe.tipo,
      unidadeDepartamento: detalhe.unidadeDepartamento,
      titulo: detalhe.titulo,
      objetivo: detalhe.objetivo,
      dataInicio: detalhe.dataInicio,
      dataFim: detalhe.dataFim,
      observacoes: detalhe.observacoes,
      redes: detalhe.redes.map((rede) => rede.id),
      participantes: detalhe.participantes.map((participante) => ({
        id: participante.id,
        pessoaId: participante.pessoaId,
        membroEquipeId: participante.membroEquipeId,
        papel: participante.papel,
        cargo: participante.cargo,
        area: participante.area,
        dataInicio: participante.dataInicio,
        dataFim: participante.dataFim,
        observacoes: participante.observacoes,
      })),
      atividades: detalhe.atividades.map((atividade) => ({
        id: atividade.id,
        tipo: atividade.tipo,
        titulo: atividade.titulo,
        paisId: atividade.paisId,
        cidade: atividade.cidade,
        estadoRegiao: atividade.estadoRegiao,
        local: atividade.local,
        endereco: atividade.endereco,
        instituicaoId: atividade.instituicaoId,
        instituicaoNome: atividade.instituicaoDoCatalogo
          ? null
          : atividade.instituicao,
        contatoInstituicaoId: atividade.contatoInstituicaoId,
        tipoRelacionamento: atividade.tipoRelacionamento,
        objetivoRelacionamento: atividade.objetivoRelacionamento,
        eventoNome: atividade.eventoNome,
        eventoTipo: atividade.eventoTipo,
        eventoSite: atividade.eventoSite,
        objetivoParticipacao: atividade.objetivoParticipacao,
        relacaoInternacionalizacao: atividade.relacaoInternacionalizacao,
        dataInicio: atividade.dataInicio,
        dataFim: atividade.dataFim,
        planejamento: atividade.planejamento,
        observacoes: atividade.observacoes,
      })),
    });
  }

  async function auditoriaDe(id: string) {
    return ctx.db
      .select({
        campo: s.registroAuditoria.campo,
        valorAnterior: s.registroAuditoria.valorAnterior,
        valorNovo: s.registroAuditoria.valorNovo,
        justificativa: s.registroAuditoria.justificativa,
      })
      .from(s.registroAuditoria)
      .where(
        and(
          eq(s.registroAuditoria.entidadeId, id),
          eq(s.registroAuditoria.acao, 'EDICAO'),
        ),
      );
  }

  it('audita um registro por campo basico alterado', async () => {
    const missao = await criar();
    await service.atualizar(
      base.cicloId,
      missao.id,
      {
        ...payloadDe(missao),
        titulo: 'Missao renomeada',
        dataFim: '2027-05-25',
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    const auditoria = await auditoriaDe(missao.id);
    expect(auditoria.map((item) => item.campo).sort()).toEqual([
      'dataFim',
      'titulo',
    ]);
    expect(auditoria.find((item) => item.campo === 'titulo')).toMatchObject({
      valorAnterior: 'Missao editavel',
      valorNovo: 'Missao renomeada',
    });
  });

  it('reconcilia participantes preservando o id de quem permanece', async () => {
    const missao = await criar();
    const permanece = missao.participantes[0];
    const [nova] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Nova Participante', tipo: 'DOCENTE' })
      .returning({ id: s.pessoa.id });

    const atualizada = await service.atualizar(
      base.cicloId,
      missao.id,
      {
        ...payloadDe(missao),
        redes: [base.redeId],
        participantes: [
          ...payloadDe(missao).participantes,
          {
            id: null,
            pessoaId: nova.id,
            novaPessoa: null,
            membroEquipeId: null,
            papel: 'APOIO',
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    expect(atualizada.participantes).toHaveLength(2);
    expect(
      atualizada.participantes.find((p) => p.pessoaId === permanece.pessoaId)!
        .id,
    ).toBe(permanece.id);

    const auditoria = await auditoriaDe(missao.id);
    expect(auditoria).toContainEqual(
      expect.objectContaining({
        campo: 'participantes',
        valorAnterior: null,
        valorNovo: 'Nova Participante',
      }),
    );
  });

  it('transfere a responsabilidade sem colidir no indice unico', async () => {
    const missao = await criar();
    const [nova] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Nova Responsavel', tipo: 'DOCENTE' })
      .returning({ id: s.pessoa.id });
    const comDuas = await service.atualizar(
      base.cicloId,
      missao.id,
      {
        ...payloadDe(missao),
        participantes: [
          ...payloadDe(missao).participantes,
          {
            pessoaId: nova.id,
            papel: 'PARTICIPANTE',
            dataInicio: missao.dataInicio,
            dataFim: missao.dataFim,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    const transferida = await service.atualizar(
      base.cicloId,
      missao.id,
      {
        ...payloadDe(comDuas),
        participantes: payloadDe(comDuas).participantes.map((participante) => ({
          ...participante,
          papel:
            participante.pessoaId === nova.id
              ? ('RESPONSAVEL' as const)
              : ('PARTICIPANTE' as const),
        })),
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    expect(
      transferida.participantes.filter(
        (participante) => participante.papel === 'RESPONSAVEL',
      ),
    ).toEqual([expect.objectContaining({ pessoaId: nova.id })]);
  });

  it('audita remocao de participante', async () => {
    const missao = await criar();
    const [nova] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Participante Removida', tipo: 'DOCENTE' })
      .returning({ id: s.pessoa.id });

    const comDuas = await service.atualizar(
      base.cicloId,
      missao.id,
      {
        ...payloadDe(missao),
        redes: [base.redeId],
        participantes: [
          ...payloadDe(missao).participantes,
          {
            id: null,
            pessoaId: nova.id,
            novaPessoa: null,
            membroEquipeId: null,
            papel: 'APOIO',
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    await service.atualizar(
      base.cicloId,
      missao.id,
      {
        ...payloadDe(comDuas),
        participantes: payloadDe(comDuas).participantes.filter(
          (p) => p.pessoaId !== nova.id,
        ),
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    expect(await auditoriaDe(missao.id)).toContainEqual(
      expect.objectContaining({
        campo: 'participantes',
        valorAnterior: 'Participante Removida',
        valorNovo: null,
      }),
    );
  });

  it('audita a troca de pais do roteiro em entrada propria', async () => {
    const missao = await criar();
    const payload = payloadDe(missao);
    payload.atividades[0].paisId = paises[1].id;

    const atualizada = await service.atualizar(
      base.cicloId,
      missao.id,
      payload,
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    expect(atualizada.paises).toEqual(['Portugal']);

    const auditoria = await auditoriaDe(missao.id);
    expect(auditoria).toContainEqual(
      expect.objectContaining({
        campo: 'paises',
        valorAnterior: 'Franca',
        valorNovo: 'Portugal',
      }),
    );
    expect(auditoria.some((item) => item.campo === 'atividades')).toBe(true);
  });

  it('acrescenta e remove atividades do roteiro', async () => {
    const missao = await criar();
    const comDuas = await service.atualizar(
      base.cicloId,
      missao.id,
      {
        ...payloadDe(missao),
        atividades: [
          ...payloadDe(missao).atividades,
          {
            id: null,
            tipo: 'EVENTO',
            titulo: 'Evento acrescentado',
            paisId: paises[1].id,
            cidade: 'Lisboa',
            instituicaoId: null,
            instituicaoNome: null,
            eventoNome: 'Encontro anual',
            dataInicio: '2027-05-10',
            dataFim: '2027-05-15',
            planejamento: null,
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    expect(comDuas.atividades.map((a) => a.ordem)).toEqual([1, 2]);
    expect(comDuas.paises).toEqual(['Franca', 'Portugal']);

    const semPrimeira = await service.atualizar(
      base.cicloId,
      missao.id,
      {
        ...payloadDe(comDuas),
        atividades: payloadDe(comDuas).atividades.slice(1),
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    // A remocao renumera o roteiro: nao pode sobrar buraco na ordem.
    expect(semPrimeira.atividades.map((a) => a.ordem)).toEqual([1]);
    expect(semPrimeira.paises).toEqual(['Portugal']);
  });

  it('inverte a ordem do roteiro sem colidir na renumeracao', async () => {
    const missao = await criar();
    const comDuas = await service.atualizar(
      base.cicloId,
      missao.id,
      {
        ...payloadDe(missao),
        atividades: [
          ...payloadDe(missao).atividades,
          {
            id: null,
            tipo: 'EVENTO',
            titulo: 'Segunda parada',
            paisId: paises[1].id,
            cidade: 'Lisboa',
            instituicaoId: null,
            instituicaoNome: null,
            eventoNome: 'Encontro de Cooperacao',
            dataInicio: '2027-05-10',
            dataFim: '2027-05-15',
            planejamento: null,
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    const invertida = await service.atualizar(
      base.cicloId,
      missao.id,
      {
        ...payloadDe(comDuas),
        atividades: [...payloadDe(comDuas).atividades].reverse(),
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    expect(invertida.atividades.map((a) => [a.ordem, a.titulo])).toEqual([
      [1, 'Segunda parada'],
      [2, 'Visita inicial'],
    ]);
  });

  it('recusa atividade que nao pertence a missao', async () => {
    const missao = await criar();
    const payload = payloadDe(missao);
    payload.atividades[0].id = '00000000-0000-4000-8000-000000000000';

    await expect(
      service.atualizar(
        base.cicloId,
        missao.id,
        payload,
        adminMissoes,
        RecorteDeMissoes.irrestrito(),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('recusa edicao sem nenhuma alteracao', async () => {
    const missao = await criar();
    await expect(
      service.atualizar(
        base.cicloId,
        missao.id,
        payloadDe(missao),
        adminMissoes,
        RecorteDeMissoes.irrestrito(),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('exige justificativa para mudanca sensivel apos a confirmacao', async () => {
    const missao = await criar();
    await ctx.db
      .update(s.missaoComite)
      .set({ status: 'CONFIRMADA' })
      .where(eq(s.missaoComite.id, missao.id));
    const confirmada = await service.detalhe(base.cicloId, missao.id);

    // Data e sensivel: sem justificativa, recusa.
    await expect(
      service.atualizar(
        base.cicloId,
        missao.id,
        { ...payloadDe(confirmada), dataFim: '2027-05-28' },
        adminMissoes,
        RecorteDeMissoes.irrestrito(),
      ),
    ).rejects.toMatchObject({ status: 400 });

    // Titulo nao e sensivel: passa sem justificativa.
    await service.atualizar(
      base.cicloId,
      missao.id,
      { ...payloadDe(confirmada), titulo: 'Titulo ajustado' },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    const depois = await service.detalhe(base.cicloId, missao.id);
    await service.atualizar(
      base.cicloId,
      missao.id,
      {
        ...payloadDe(depois),
        dataFim: '2027-05-28',
        justificativa: 'Prorrogacao autorizada pelo comite.',
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    const auditoria = await auditoriaDe(missao.id);
    expect(
      auditoria.find((item) => item.campo === 'dataFim')?.justificativa,
    ).toBe('Prorrogacao autorizada pelo comite.');
  });

  it('nao deixa alteracao parcial quando a justificativa falta', async () => {
    const missao = await criar();
    await ctx.db
      .update(s.missaoComite)
      .set({ status: 'CONFIRMADA' })
      .where(eq(s.missaoComite.id, missao.id));
    const confirmada = await service.detalhe(base.cicloId, missao.id);

    await expect(
      service.atualizar(
        base.cicloId,
        missao.id,
        {
          ...payloadDe(confirmada),
          redes: [base.redeId],
          participantes: [
            ...payloadDe(confirmada).participantes,
            {
              id: null,
              pessoaId: null,
              novaPessoa: {
                nome: 'Nao Deve Persistir',
                email: 'nao-persiste@example.org',
                cpf: null,
                tipo: 'EXTERNO',
                ppgId: null,
                instituicaoId: null,
              },
              membroEquipeId: null,
              papel: 'APOIO',
              observacoes: null,
            },
          ],
        },
        adminMissoes,
        RecorteDeMissoes.irrestrito(),
      ),
    ).rejects.toMatchObject({ status: 400 });

    const depois = await service.detalhe(base.cicloId, missao.id);
    expect(depois.participantes).toHaveLength(1);
    expect(
      await ctx.db
        .select()
        .from(s.pessoa)
        .where(eq(s.pessoa.email, 'nao-persiste@example.org')),
    ).toHaveLength(0);
  });

  it('recusa edicao de missao concluida ou cancelada', async () => {
    for (const status of ['CONCLUIDA', 'CANCELADA'] as const) {
      const missao = await criar();
      await ctx.db
        .update(s.missaoComite)
        .set({ status })
        .where(eq(s.missaoComite.id, missao.id));

      await expect(
        service.atualizar(
          base.cicloId,
          missao.id,
          { ...payloadDe(missao), titulo: 'Tentativa de edicao' },
          adminMissoes,
          RecorteDeMissoes.irrestrito(),
        ),
      ).rejects.toMatchObject({ status: 409 });
    }
  });

  it('recusa qualquer campo financeiro no payload da missao', () => {
    const base = {
      titulo: 'Missao com valores',
      objetivo: 'Payload que tenta contrabandear dinheiro pela missao.',
      dataInicio: '2027-05-01',
      dataFim: '2027-05-20',
      redes: ['44444444-4444-4444-8444-444444444444'],
      participantes: [
        {
          pessoaId: '11111111-1111-4111-8111-111111111111',
          papel: 'RESPONSAVEL',
        },
      ],
      atividades: [
        {
          tipo: 'EVENTO',
          titulo: 'Evento',
          eventoNome: 'Evento de Teste',
          paisId: '22222222-2222-4222-8222-222222222222',
          dataInicio: '2027-05-02',
          dataFim: '2027-05-05',
        },
      ],
    };

    expect(atualizarMissaoComiteSchema.safeParse(base).success).toBe(true);
    // Nao basta ignorar: o endpoint da missao precisa recusar explicitamente.
    expect(
      atualizarMissaoComiteSchema.safeParse({ ...base, valorTotal: '1000.00' })
        .success,
    ).toBe(false);
    expect(
      atualizarMissaoComiteSchema.safeParse({
        ...base,
        despesas: [{ tipo: 'PASSAGEM', valorTotal: '1000.00' }],
      }).success,
    ).toBe(false);
    expect(
      atualizarMissaoComiteSchema.safeParse({
        ...base,
        atividades: [{ ...base.atividades[0], valorDiaria: '500.00' }],
      }).success,
    ).toBe(false);
  });
});

describe('MissoesComiteService — ciclo de vida', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: MissoesComiteService;
  let encerramento: EncerramentoService;
  let resultados: ResultadosService;
  let paisId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    encerramento = new EncerramentoService(ctx.db);
    resultados = new ResultadosService(ctx.db);
    service = new MissoesComiteService(ctx.db, encerramento);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ codigoIso2: 'FR', codigoIso3: 'FRA', nome: 'Franca' })
      .returning({ id: s.pais.id });
    paisId = pais.id;
  });

  async function criar(titulo = 'Missao do ciclo de vida') {
    return service.criar(
      base.cicloId,
      {
        titulo,
        objetivo: 'Missao usada para exercitar as transicoes de situacao.',
        // Periodo ja encerrado: torna visivel que "encerrada" e "realizada" sao
        // coisas diferentes.
        dataInicio: '2020-05-01',
        dataFim: '2020-05-20',
        status: 'PLANEJADA',
        observacoes: null,
        redes: [base.redeId],
        participantes: [
          {
            pessoaId: base.coordenadorTematicaId,
            novaPessoa: null,
            membroEquipeId: null,
            papel: 'RESPONSAVEL',
            observacoes: null,
          },
        ],
        atividades: [
          {
            tipo: 'VISITA_TECNICA',
            titulo: 'Visita unica',
            paisId,
            cidade: 'Paris',
            instituicaoId: null,
            instituicaoNome: null,
            eventoNome: null,
            dataInicio: '2020-05-02',
            dataFim: '2020-05-06',
            planejamento: null,
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
  }

  /** Relato minimo exigido pela CG-035. Sozinho ja nao basta para encerrar. */
  async function relatarMinimo(id: string) {
    const missao = await service.detalhe(base.cicloId, id);
    await service.relatar(
      base.cicloId,
      id,
      relatarMissaoSchema.parse({
        relatoGeral: 'A missao ocorreu conforme o roteiro previsto.',
        avaliacaoObjetivos: 'SIM',
        atividades: missao.atividades.map((atividade) => ({
          id: atividade.id,
          status: 'REALIZADA',
          relatoRealizado: 'Atividade realizada.',
        })),
      }),
      adminMissoes,
    );
  }

  /**
   * Caminho completo de encerramento depois da CG-058.
   *
   * Relatar deixou de ser suficiente: e preciso responder sobre produtos e
   * resolver a prestacao. Estas missoes de teste nao gastaram nada, e prestacao
   * sem despesa nunca chega a `VALIDADA` (CG-054) — entao o caminho e a
   * dispensa, que foi exatamente a saida decidida para esse caso.
   */
  async function prepararEncerramento(id: string) {
    await relatarMinimo(id);
    await resultados.responderProdutos(
      base.cicloId,
      id,
      { gerouProduto: false, justificativa: 'Missao de articulacao inicial.' },
      adminMissoes,
    );
    await encerramento.dispensar(
      base.cicloId,
      id,
      {
        chave: 'PRESTACAO_VALIDADA',
        justificativa: 'Missao sem despesa; nao ha prestacao a validar.',
      },
      adminMissoes,
    );
  }

  it('percorre planejada, confirmada e concluida', async () => {
    const missao = await criar();

    const confirmada = await service.transicionar(
      base.cicloId,
      missao.id,
      { acao: 'CONFIRMAR', justificativa: null },
      adminMissoes,
    );
    expect(confirmada.status).toBe('CONFIRMADA');

    // Depois da CG-058, relatar deixou de bastar: encerrar exige o checklist.
    await expect(
      service.transicionar(
        base.cicloId,
        missao.id,
        { acao: 'CONCLUIR', justificativa: null },
        adminMissoes,
      ),
    ).rejects.toMatchObject({ status: 422 });

    await prepararEncerramento(missao.id);
    const concluida = await service.transicionar(
      base.cicloId,
      missao.id,
      { acao: 'CONCLUIR', justificativa: null },
      adminMissoes,
    );
    expect(concluida.status).toBe('CONCLUIDA');

    const status = concluida.historico.filter(
      (item) => item.campo === 'status',
    );
    expect(status.map((item) => item.valorNovo)).toEqual([
      'CONCLUIDA',
      'CONFIRMADA',
    ]);
  });

  it('recusa transicao a partir de situacao incompativel', async () => {
    const missao = await criar();
    // Concluir sem confirmar antes.
    await expect(
      service.transicionar(
        base.cicloId,
        missao.id,
        { acao: 'CONCLUIR', justificativa: null },
        adminMissoes,
      ),
    ).rejects.toMatchObject({ status: 409 });

    await service.transicionar(
      base.cicloId,
      missao.id,
      { acao: 'CONFIRMAR', justificativa: null },
      adminMissoes,
    );
    // Confirmar duas vezes.
    await expect(
      service.transicionar(
        base.cicloId,
        missao.id,
        { acao: 'CONFIRMAR', justificativa: null },
        adminMissoes,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('exige justificativa para cancelar e a guarda no historico', async () => {
    const missao = await criar();
    await expect(
      service.transicionar(
        base.cicloId,
        missao.id,
        { acao: 'CANCELAR', justificativa: null },
        adminMissoes,
      ),
    ).rejects.toMatchObject({ status: 400 });

    const cancelada = await service.transicionar(
      base.cicloId,
      missao.id,
      {
        acao: 'CANCELAR',
        justificativa: 'Agenda inviabilizada pelo parceiro.',
      },
      adminMissoes,
    );
    expect(cancelada.status).toBe('CANCELADA');
    expect(
      cancelada.historico.find((item) => item.campo === 'status')
        ?.justificativa,
    ).toBe('Agenda inviabilizada pelo parceiro.');
  });

  it('missao cancelada nao conta como realizada nem carrega valor', async () => {
    const cancelada = await criar('Missao cancelada');
    await service.transicionar(
      base.cicloId,
      cancelada.id,
      { acao: 'CANCELAR', justificativa: 'Cancelada por falta de recurso.' },
      adminMissoes,
    );

    const concluida = await criar('Missao concluida');
    await service.transicionar(
      base.cicloId,
      concluida.id,
      { acao: 'CONFIRMAR', justificativa: null },
      adminMissoes,
    );
    await prepararEncerramento(concluida.id);
    await service.transicionar(
      base.cicloId,
      concluida.id,
      { acao: 'CONCLUIR', justificativa: null },
      adminMissoes,
    );

    const pagina = await service.listar(
      base.cicloId,
      filtroMissoesSchema.parse({}),
      RecorteDeMissoes.irrestrito(),
    );
    expect(pagina.resumo).toMatchObject({
      total: 2,
      realizadas: 1,
      canceladas: 1,
    });
    expect(pagina.resumo.porStatus.CONCLUIDA).toBe(1);
    expect(pagina.resumo.porStatus.CANCELADA).toBe(1);
    // As duas ja passaram; encerrada no tempo nao e o mesmo que realizada.
    expect(pagina.resumo.porSituacaoTemporal.ENCERRADA).toBe(2);
    // E nenhuma delas leva valor a indicador financeiro nenhum.
    expect(pagina.itens.every((item) => item.valorPrestado === null)).toBe(
      true,
    );
    expect(
      (await service.detalhe(base.cicloId, cancelada.id)).totais,
    ).toMatchObject({ geral: null, porExercicio: [] });
  });

  it('o resumo responde ao escopo do filtro, mas nao ao proprio status', async () => {
    const cancelada = await criar('Missao cancelada');
    await service.transicionar(
      base.cicloId,
      cancelada.id,
      { acao: 'CANCELAR', justificativa: 'Cancelada.' },
      adminMissoes,
    );
    await criar('Missao planejada');

    const filtrada = await service.listar(
      base.cicloId,
      filtroMissoesSchema.parse({ status: 'CANCELADA' }),
      RecorteDeMissoes.irrestrito(),
    );
    // A pagina traz so a cancelada, mas o resumo continua contando as duas.
    expect(filtrada.total).toBe(1);
    expect(filtrada.resumo.total).toBe(2);

    const foraDoEscopo = await service.listar(
      base.cicloId,
      filtroMissoesSchema.parse({ ano: 2035 }),
      RecorteDeMissoes.irrestrito(),
    );
    expect(foraDoEscopo.resumo.total).toBe(0);
  });

  it('reabre missao concluida e cancelada como operacao administrativa', async () => {
    for (const preparar of [
      async (id: string) => {
        await service.transicionar(
          base.cicloId,
          id,
          { acao: 'CONFIRMAR', justificativa: null },
          adminMissoes,
        );
        await prepararEncerramento(id);
        await service.transicionar(
          base.cicloId,
          id,
          { acao: 'CONCLUIR', justificativa: null },
          adminMissoes,
        );
      },
      async (id: string) => {
        await service.transicionar(
          base.cicloId,
          id,
          { acao: 'CANCELAR', justificativa: 'Cancelada.' },
          adminMissoes,
        );
      },
    ]) {
      const missao = await criar();
      await preparar(missao.id);

      const reaberta = await service.reabrir(
        base.cicloId,
        missao.id,
        { justificativa: 'Reabertura autorizada pela pro-reitoria.' },
        adminMissoes,
      );
      expect(reaberta.status).toBe('PLANEJADA');
      expect(
        reaberta.historico.find(
          (item) => item.campo === 'status' && item.valorNovo === 'PLANEJADA',
        )?.justificativa,
      ).toBe('Reabertura autorizada pela pro-reitoria.');

      // Reaberta, volta a aceitar edicao.
      await service.transicionar(
        base.cicloId,
        missao.id,
        { acao: 'CONFIRMAR', justificativa: null },
        adminMissoes,
      );
    }
  });

  it('recusa reabrir missao que nao terminou', async () => {
    const missao = await criar();
    await expect(
      service.reabrir(
        base.cicloId,
        missao.id,
        { justificativa: 'Tentativa indevida de reabertura.' },
        adminMissoes,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('recusa reabertura sem justificativa suficiente', () => {
    expect(reaberturaMissaoSchema.safeParse({}).success).toBe(false);
    expect(
      reaberturaMissaoSchema.safeParse({ justificativa: 'curta' }).success,
    ).toBe(false);
    expect(transicaoMissaoSchema.safeParse({ acao: 'REABRIR' }).success).toBe(
      false,
    );
  });
});

describe('MissoesComiteService — relato e conclusao', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: MissoesComiteService;
  let encerramento: EncerramentoService;
  let resultados: ResultadosService;
  let paises: { id: string }[];

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    encerramento = new EncerramentoService(ctx.db);
    resultados = new ResultadosService(ctx.db);
    service = new MissoesComiteService(ctx.db, encerramento);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    paises = await ctx.db
      .insert(s.pais)
      .values([
        { codigoIso2: 'FR', codigoIso3: 'FRA', nome: 'Franca' },
        { codigoIso2: 'PT', codigoIso3: 'PRT', nome: 'Portugal' },
      ])
      .returning({ id: s.pais.id });
  });

  /** Missao confirmada, com duas paradas planejadas e nenhum relato ainda. */
  async function confirmada() {
    const criada = await service.criar(
      base.cicloId,
      {
        titulo: 'Missao a relatar',
        objetivo: 'Missao usada para exercitar o registro do realizado.',
        dataInicio: '2020-05-01',
        dataFim: '2020-05-20',
        status: 'PLANEJADA',
        observacoes: null,
        redes: [base.redeId],
        participantes: [
          {
            pessoaId: base.coordenadorTematicaId,
            novaPessoa: null,
            membroEquipeId: null,
            papel: 'RESPONSAVEL',
            observacoes: null,
          },
        ],
        atividades: [
          {
            tipo: 'VISITA_TECNICA',
            titulo: 'Visita planejada',
            paisId: paises[0].id,
            cidade: 'Paris',
            instituicaoId: null,
            instituicaoNome: null,
            eventoNome: null,
            dataInicio: '2020-05-02',
            dataFim: '2020-05-06',
            planejamento: 'Conhecer o laboratorio parceiro.',
            observacoes: null,
          },
          {
            tipo: 'EVENTO',
            titulo: 'Evento planejado',
            paisId: paises[1].id,
            cidade: 'Lisboa',
            instituicaoId: null,
            instituicaoNome: null,
            eventoNome: 'Encontro anual',
            dataInicio: '2020-05-10',
            dataFim: '2020-05-15',
            planejamento: 'Apresentar o programa.',
            observacoes: null,
          },
        ],
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    await service.transicionar(
      base.cicloId,
      criada.id,
      { acao: 'CONFIRMAR', justificativa: null },
      adminMissoes,
    );
    return service.detalhe(base.cicloId, criada.id);
  }

  it('registra o realizado sem tocar no planejamento', async () => {
    const missao = await confirmada();
    const relatada = await service.relatar(
      base.cicloId,
      missao.id,
      relatarMissaoSchema.parse({
        relatoGeral: 'A missao cumpriu a agenda prevista nos dois paises.',
        resultados: 'Dois memorandos de entendimento encaminhados.',
        atividades: [
          {
            id: missao.atividades[0].id,
            status: 'REALIZADA',
            relatoRealizado: 'Visita realizada com a equipe do laboratorio.',
            resultados: 'Acordo de cotutela encaminhado.',
          },
          {
            id: missao.atividades[1].id,
            status: 'NAO_REALIZADA',
            observacoes: 'Evento adiado pelo organizador.',
          },
        ],
      }),
      adminMissoes,
    );

    expect(relatada.relatoGeral).toContain('cumpriu a agenda');
    // O planejamento original continua intacto ao lado do relato.
    expect(relatada.atividades[0]).toMatchObject({
      planejamento: 'Conhecer o laboratorio parceiro.',
      relatoRealizado: 'Visita realizada com a equipe do laboratorio.',
      status: 'REALIZADA',
      naoPrevista: false,
    });
    expect(relatada.atividades[1]).toMatchObject({
      planejamento: 'Apresentar o programa.',
      status: 'NAO_REALIZADA',
    });

    const campos = relatada.historico.map((item) => item.campo);
    expect(campos).toContain('relatoGeral');
    expect(campos).toContain('atividades.status');
  });

  it('inclui atividade nao prevista com justificativa e a mantem distinguivel', async () => {
    const missao = await confirmada();
    const relatada = await service.relatar(
      base.cicloId,
      missao.id,
      relatarMissaoSchema.parse({
        relatoGeral: 'Surgiu uma reuniao adicional durante a viagem.',
        atividades: missao.atividades.map((atividade) => ({
          id: atividade.id,
          status: 'REALIZADA',
          relatoRealizado: 'Realizada conforme o previsto.',
        })),
        atividadesNaoPrevistas: [
          {
            tipo: 'ARTICULACAO',
            titulo: 'Reuniao com a agencia de fomento',
            paisId: paises[1].id,
            cidade: 'Lisboa',
            dataInicio: '2020-05-16',
            dataFim: '2020-05-16',
            justificativa: 'Convite recebido durante o evento em Lisboa.',
            relatoRealizado: 'Apresentada a proposta de cooperacao bilateral.',
          },
        ],
      }),
      adminMissoes,
    );

    const extra = relatada.atividades.find(
      (atividade) => atividade.naoPrevista,
    )!;
    expect(extra.titulo).toBe('Reuniao com a agencia de fomento');
    expect(extra.justificativaInclusao).toBe(
      'Convite recebido durante o evento em Lisboa.',
    );
    // Nao prevista nao tem planejamento, e entra depois do roteiro planejado.
    expect(extra.planejamento).toBeNull();
    expect(extra.ordem).toBe(3);
    expect(
      relatada.atividades.filter((a) => !a.naoPrevista).map((a) => a.ordem),
    ).toEqual([1, 2]);

    expect(relatada.historico).toContainEqual(
      expect.objectContaining({
        campo: 'atividades.naoPrevista',
        valorNovo: 'Reuniao com a agencia de fomento',
        justificativa: 'Convite recebido durante o evento em Lisboa.',
      }),
    );
  });

  it('exige justificativa e relato na atividade nao prevista', () => {
    const naoPrevista = {
      tipo: 'ARTICULACAO',
      titulo: 'Reuniao extra',
      paisId: '22222222-2222-4222-8222-222222222222',
      dataInicio: '2020-05-16',
      dataFim: '2020-05-16',
      justificativa: 'Convite recebido durante a viagem ao exterior.',
      relatoRealizado: 'Reuniao realizada.',
    };
    const relato = { relatoGeral: 'Relato geral suficientemente descritivo.' };

    expect(
      relatarMissaoSchema.safeParse({
        ...relato,
        atividadesNaoPrevistas: [naoPrevista],
      }).success,
    ).toBe(true);
    expect(
      relatarMissaoSchema.safeParse({
        ...relato,
        atividadesNaoPrevistas: [{ ...naoPrevista, justificativa: undefined }],
      }).success,
    ).toBe(false);
    expect(
      relatarMissaoSchema.safeParse({
        ...relato,
        atividadesNaoPrevistas: [
          { ...naoPrevista, relatoRealizado: undefined },
        ],
      }).success,
    ).toBe(false);
    // Atividade marcada como realizada precisa dizer o que foi feito.
    expect(
      relatarMissaoSchema.safeParse({
        ...relato,
        atividades: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            status: 'REALIZADA',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('exige o checklist de encerramento para concluir a missao', async () => {
    const missao = await confirmada();
    const concluir = () =>
      service.transicionar(
        base.cicloId,
        missao.id,
        { acao: 'CONCLUIR', justificativa: null },
        adminMissoes,
      );

    // Sem relato nenhum. 422 e nao 400: o corpo esta correto, o que falta e
    // estado da missao — mesmo contrato da submissao (CG-037).
    await expect(concluir()).rejects.toMatchObject({ status: 422 });

    // Relato geral, mas uma parada ainda sem desfecho.
    await service.relatar(
      base.cicloId,
      missao.id,
      relatarMissaoSchema.parse({
        relatoGeral: 'Relato geral registrado, roteiro ainda em apuracao.',
        atividades: [
          {
            id: missao.atividades[0].id,
            status: 'REALIZADA',
            relatoRealizado: 'Visita realizada.',
          },
        ],
      }),
      adminMissoes,
    );
    await expect(concluir()).rejects.toMatchObject({ status: 422 });

    // Roteiro inteiro apurado. Antes da CG-058 isto ja bastava; agora faltam a
    // avaliacao, a resposta sobre produtos e a prestacao.
    await service.relatar(
      base.cicloId,
      missao.id,
      relatarMissaoSchema.parse({
        relatoGeral: 'Relato geral registrado, roteiro integralmente apurado.',
        atividades: [
          {
            id: missao.atividades[0].id,
            status: 'REALIZADA',
            relatoRealizado: 'Visita realizada.',
          },
          { id: missao.atividades[1].id, status: 'NAO_REALIZADA' },
        ],
      }),
      adminMissoes,
    );
    const parcial = await encerramento.checklist(base.cicloId, missao.id);
    expect(parcial.podeEncerrar).toBe(false);
    expect(
      parcial.itens
        .filter((item) => !item.atendido)
        .map((item) => item.chave)
        .sort(),
    ).toEqual([
      'AVALIACAO_OBJETIVOS',
      'PRESTACAO_VALIDADA',
      'PRODUTO_RESPONDIDO',
    ]);
    await expect(concluir()).rejects.toMatchObject({ status: 422 });

    await service.relatar(
      base.cicloId,
      missao.id,
      relatarMissaoSchema.parse({
        relatoGeral: 'Relato geral registrado, roteiro integralmente apurado.',
        avaliacaoObjetivos: 'PARCIALMENTE',
        avaliacaoJustificativa: 'Uma das visitas foi cancelada pelo anfitriao.',
        atividades: [
          {
            id: missao.atividades[0].id,
            status: 'REALIZADA',
            relatoRealizado: 'Visita realizada.',
          },
          { id: missao.atividades[1].id, status: 'NAO_REALIZADA' },
        ],
      }),
      adminMissoes,
    );
    await resultados.responderProdutos(
      base.cicloId,
      missao.id,
      { gerouProduto: false, justificativa: 'Articulacao sem produto formal.' },
      adminMissoes,
    );
    // Falta so a prestacao — e ela e o unico item que ainda bloqueia.
    await expect(concluir()).rejects.toMatchObject({ status: 422 });

    await encerramento.dispensar(
      base.cicloId,
      missao.id,
      {
        chave: 'PRESTACAO_VALIDADA',
        justificativa: 'Missao sem despesa; nao ha prestacao a validar.',
      },
      adminMissoes,
    );

    const concluida = await concluir();
    expect(concluida.status).toBe('CONCLUIDA');
  });

  it('a edicao da missao nao apaga nem reclassifica a atividade nao prevista', async () => {
    const missao = await confirmada();
    const relatada = await service.relatar(
      base.cicloId,
      missao.id,
      relatarMissaoSchema.parse({
        relatoGeral: 'Missao com uma parada adicional nao prevista.',
        atividadesNaoPrevistas: [
          {
            tipo: 'ARTICULACAO',
            titulo: 'Parada adicional',
            paisId: paises[1].id,
            dataInicio: '2020-05-16',
            dataFim: '2020-05-16',
            justificativa: 'Oportunidade surgida durante a missao.',
            relatoRealizado: 'Reuniao realizada.',
          },
        ],
      }),
      adminMissoes,
    );
    const extra = relatada.atividades.find((a) => a.naoPrevista)!;

    // O payload de edicao so leva as planejadas — e a extra tem que sobreviver.
    const planejadas = relatada.atividades.filter((a) => !a.naoPrevista);
    const editada = await service.atualizar(
      base.cicloId,
      missao.id,
      {
        titulo: 'Missao a relatar (revisada)',
        objetivo: relatada.objetivo,
        dataInicio: relatada.dataInicio,
        dataFim: relatada.dataFim,
        observacoes: null,
        justificativa: 'Ajuste de titulo apos a confirmacao.',
        redes: relatada.redes.map((r) => r.id),
        participantes: relatada.participantes.map((p) => ({
          id: p.id,
          pessoaId: p.pessoaId,
          membroEquipeId: p.membroEquipeId,
          papel: p.papel,
          observacoes: p.observacoes,
        })),
        atividades: planejadas.map((a) => ({
          id: a.id,
          tipo: a.tipo as 'VISITA_TECNICA',
          titulo: a.titulo,
          paisId: a.paisId,
          cidade: a.cidade,
          instituicaoId: a.instituicaoId,
          instituicaoNome: null,
          eventoNome: a.eventoNome,
          dataInicio: a.dataInicio,
          dataFim: a.dataFim,
          planejamento: a.planejamento,
          observacoes: a.observacoes,
        })),
      },
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    const preservada = editada.atividades.find((a) => a.id === extra.id);
    expect(preservada).toBeDefined();
    expect(preservada).toMatchObject({
      naoPrevista: true,
      justificativaInclusao: 'Oportunidade surgida durante a missao.',
      ordem: 3,
    });
    expect(
      editada.atividades.filter((a) => !a.naoPrevista).map((a) => a.ordem),
    ).toEqual([1, 2]);
  });

  it('recusa alterar atividade nao prevista pelo endpoint de edicao', async () => {
    const missao = await confirmada();
    const relatada = await service.relatar(
      base.cicloId,
      missao.id,
      relatarMissaoSchema.parse({
        relatoGeral: 'Missao com uma parada adicional nao prevista.',
        atividadesNaoPrevistas: [
          {
            tipo: 'ARTICULACAO',
            titulo: 'Parada adicional',
            paisId: paises[1].id,
            dataInicio: '2020-05-16',
            dataFim: '2020-05-16',
            justificativa: 'Oportunidade surgida durante a missao.',
            relatoRealizado: 'Reuniao realizada.',
          },
        ],
      }),
      adminMissoes,
    );

    await expect(
      service.atualizar(
        base.cicloId,
        missao.id,
        {
          titulo: relatada.titulo,
          objetivo: relatada.objetivo,
          dataInicio: relatada.dataInicio,
          dataFim: relatada.dataFim,
          observacoes: null,
          justificativa: 'Tentativa de editar o que veio do relato.',
          redes: relatada.redes.map((r) => r.id),
          participantes: relatada.participantes.map((p) => ({
            id: p.id,
            pessoaId: p.pessoaId,
            membroEquipeId: p.membroEquipeId,
            papel: p.papel,
            observacoes: p.observacoes,
          })),
          atividades: relatada.atividades.map((a) => ({
            id: a.id,
            tipo: a.tipo as 'VISITA_TECNICA',
            titulo: a.titulo,
            paisId: a.paisId,
            cidade: a.cidade,
            instituicaoId: a.instituicaoId,
            instituicaoNome: null,
            eventoNome: a.eventoNome,
            dataInicio: a.dataInicio,
            dataFim: a.dataFim,
            planejamento: a.planejamento,
            observacoes: a.observacoes,
          })),
        },
        adminMissoes,
        RecorteDeMissoes.irrestrito(),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('recusa relato em missao cancelada', async () => {
    const missao = await confirmada();
    await service.transicionar(
      base.cicloId,
      missao.id,
      { acao: 'CANCELAR', justificativa: 'Cancelada antes de acontecer.' },
      adminMissoes,
    );

    await expect(
      service.relatar(
        base.cicloId,
        missao.id,
        relatarMissaoSchema.parse({
          relatoGeral: 'Tentativa de relatar missao que nao aconteceu.',
        }),
        adminMissoes,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('MissoesComiteService — redes da missao', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: MissoesComiteService;
  let paisId: string;
  /** A rede do fixture mais duas, para exercitar o pertencimento multiplo. */
  let redes: { id: string; nome: string }[];

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new MissoesComiteService(ctx.db, new EncerramentoService(ctx.db));
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);

    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ codigoIso2: 'IT', codigoIso3: 'ITA', nome: 'Italia' })
      .returning({ id: s.pais.id });
    paisId = pais.id;

    const extras = await ctx.db
      .insert(s.redeCoordenadora)
      .values(
        ['UNESP', 'UNICAMP'].map((nome) => ({
          cicloId: base.cicloId,
          instituicaoId: base.instituicaoId,
          nome,
        })),
      )
      .returning({ id: s.redeCoordenadora.id, nome: s.redeCoordenadora.nome });

    redes = [{ id: base.redeId, nome: 'REDE-TESTE' }, ...extras];
  });

  function missao(
    titulo: string,
    idsDeRede: string[],
  ): Parameters<typeof service.criar>[1] {
    return {
      titulo,
      objetivo: 'Articulacao institucional com universidades italianas.',
      dataInicio: '2027-09-01',
      dataFim: '2027-09-12',
      status: 'PLANEJADA',
      observacoes: null,
      redes: idsDeRede,
      participantes: [
        {
          pessoaId: base.coordenadorTematicaId,
          novaPessoa: null,
          membroEquipeId: null,
          papel: 'RESPONSAVEL',
          observacoes: null,
        },
      ],
      atividades: [
        {
          tipo: 'ARTICULACAO',
          titulo: 'Reuniao em Bolonha',
          paisId,
          cidade: 'Bolonha',
          instituicaoId: null,
          instituicaoNome: null,
          eventoNome: null,
          dataInicio: '2027-09-02',
          dataFim: '2027-09-08',
          planejamento: null,
          observacoes: null,
        },
      ],
    };
  }

  it('grava a missao multirrede e devolve as redes ordenadas', async () => {
    const criada = await service.criar(
      base.cicloId,
      missao('Missao das tres redes', [redes[2].id, redes[0].id, redes[1].id]),
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    const detalhe = await service.detalhe(base.cicloId, criada.id);
    expect(detalhe.redes.map((rede) => rede.nome)).toEqual([
      'REDE-TESTE',
      'UNESP',
      'UNICAMP',
    ]);
  });

  it('exige pelo menos uma rede e recusa rede repetida', () => {
    expect(
      criarMissaoComiteSchema.safeParse(missao('Sem rede', [])).success,
    ).toBe(false);
    expect(
      criarMissaoComiteSchema.safeParse(
        missao('Rede repetida', [redes[0].id, redes[0].id]),
      ).success,
    ).toBe(false);
  });

  it('recusa rede que pertence a outro ciclo', async () => {
    const [outro] = await ctx.db
      .insert(s.ciclo)
      .values({
        programaId: base.programaId,
        nome: '2031-2034',
        anoInicio: 2031,
        anoFim: 2034,
      })
      .returning({ id: s.ciclo.id });
    const [redeDeOutroCiclo] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId: outro.id,
        instituicaoId: base.instituicaoId,
        nome: 'UFMG',
      })
      .returning({ id: s.redeCoordenadora.id });

    await expect(
      service.criar(
        base.cicloId,
        missao('Missao com rede alheia', [redeDeOutroCiclo.id]),
        adminMissoes,
        RecorteDeMissoes.irrestrito(),
      ),
    ).rejects.toMatchObject({ status: 400 });
    // A transacao inteira e desfeita: nem a missao sobrou.
    expect(await ctx.db.select().from(s.missaoComite)).toHaveLength(0);
  });

  it('a missao multirrede aparece uma unica vez em todas as redes', async () => {
    await service.criar(
      base.cicloId,
      missao('Missao conjunta', [redes[0].id, redes[1].id, redes[2].id]),
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    await service.criar(
      base.cicloId,
      missao('Missao so da UNESP', [redes[1].id]),
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    const todas = await service.listar(
      base.cicloId,
      filtroMissoesSchema.parse({}),
      RecorteDeMissoes.irrestrito(),
    );
    expect(todas.total).toBe(2);
    expect(todas.itens).toHaveLength(2);
    expect(todas.resumo.total).toBe(2);

    // Filtrar por uma rede da missao conjunta traz as duas; a outra, so a dela.
    const daUnesp = await service.listar(
      base.cicloId,
      filtroMissoesSchema.parse({ redeId: redes[1].id }),
      RecorteDeMissoes.irrestrito(),
    );
    expect(daUnesp.total).toBe(2);

    const daPrimeira = await service.listar(
      base.cicloId,
      filtroMissoesSchema.parse({ redeId: redes[0].id }),
      RecorteDeMissoes.irrestrito(),
    );
    expect(daPrimeira.itens.map((item) => item.titulo)).toEqual([
      'Missao conjunta',
    ]);
    expect(daPrimeira.itens[0].redes).toEqual([
      'REDE-TESTE',
      'UNESP',
      'UNICAMP',
    ]);
  });

  it('audita uma entrada por rede incluida e removida', async () => {
    const criada = await service.criar(
      base.cicloId,
      missao('Missao a remanejar', [redes[0].id, redes[1].id]),
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    const detalhe = await service.detalhe(base.cicloId, criada.id);

    await service.atualizar(
      base.cicloId,
      criada.id,
      atualizarMissaoComiteSchema.parse({
        titulo: detalhe.titulo,
        objetivo: detalhe.objetivo,
        dataInicio: detalhe.dataInicio,
        dataFim: detalhe.dataFim,
        observacoes: detalhe.observacoes,
        // Sai a UNESP, entra a UNICAMP; a primeira permanece.
        redes: [redes[0].id, redes[2].id],
        participantes: detalhe.participantes.map((participante) => ({
          id: participante.id,
          pessoaId: participante.pessoaId,
          membroEquipeId: participante.membroEquipeId,
          papel: participante.papel,
          observacoes: participante.observacoes,
        })),
        atividades: detalhe.atividades.map((atividade) => ({
          id: atividade.id,
          tipo: atividade.tipo,
          titulo: atividade.titulo,
          paisId: atividade.paisId,
          cidade: atividade.cidade,
          instituicaoId: atividade.instituicaoId,
          instituicaoNome: null,
          eventoNome: atividade.eventoNome,
          dataInicio: atividade.dataInicio,
          dataFim: atividade.dataFim,
          planejamento: atividade.planejamento,
          observacoes: atividade.observacoes,
        })),
      }),
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );

    const depois = await service.detalhe(base.cicloId, criada.id);
    expect(depois.redes.map((rede) => rede.nome)).toEqual([
      'REDE-TESTE',
      'UNICAMP',
    ]);

    const deRede = await ctx.db
      .select({
        anterior: s.registroAuditoria.valorAnterior,
        novo: s.registroAuditoria.valorNovo,
      })
      .from(s.registroAuditoria)
      .where(
        and(
          eq(s.registroAuditoria.entidadeId, criada.id),
          eq(s.registroAuditoria.campo, 'redes'),
        ),
      );
    // Uma entrada por rede, e nao um diff de lista em um registro so.
    expect(deRede).toHaveLength(2);
    expect(deRede).toEqual(
      expect.arrayContaining([
        { anterior: null, novo: 'UNICAMP' },
        { anterior: 'UNESP', novo: null },
      ]),
    );
  });

  it('trocar a rede de missao confirmada exige justificativa', async () => {
    const criada = await service.criar(
      base.cicloId,
      missao('Missao confirmada', [redes[0].id]),
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    await service.transicionar(
      base.cicloId,
      criada.id,
      { acao: 'CONFIRMAR', justificativa: null },
      adminMissoes,
    );
    const detalhe = await service.detalhe(base.cicloId, criada.id);

    const payload = (justificativa: string | null) =>
      atualizarMissaoComiteSchema.parse({
        titulo: detalhe.titulo,
        objetivo: detalhe.objetivo,
        dataInicio: detalhe.dataInicio,
        dataFim: detalhe.dataFim,
        observacoes: detalhe.observacoes,
        justificativa,
        redes: [redes[0].id, redes[1].id],
        participantes: detalhe.participantes.map((participante) => ({
          id: participante.id,
          pessoaId: participante.pessoaId,
          membroEquipeId: participante.membroEquipeId,
          papel: participante.papel,
          observacoes: participante.observacoes,
        })),
        atividades: detalhe.atividades.map((atividade) => ({
          id: atividade.id,
          tipo: atividade.tipo,
          titulo: atividade.titulo,
          paisId: atividade.paisId,
          cidade: atividade.cidade,
          instituicaoId: atividade.instituicaoId,
          instituicaoNome: null,
          eventoNome: atividade.eventoNome,
          dataInicio: atividade.dataInicio,
          dataFim: atividade.dataFim,
          planejamento: atividade.planejamento,
          observacoes: atividade.observacoes,
        })),
      });

    await expect(
      service.atualizar(
        base.cicloId,
        criada.id,
        payload(null),
        adminMissoes,
        RecorteDeMissoes.irrestrito(),
      ),
    ).rejects.toMatchObject({ status: 400 });

    // A recusa nao pode ter deixado a rede nova gravada pela metade.
    expect((await service.detalhe(base.cicloId, criada.id)).redes).toHaveLength(
      1,
    );

    await service.atualizar(
      base.cicloId,
      criada.id,
      payload('A UNESP passou a integrar a missao por decisao do Comite.'),
      adminMissoes,
      RecorteDeMissoes.irrestrito(),
    );
    expect((await service.detalhe(base.cicloId, criada.id)).redes).toHaveLength(
      2,
    );
  });
});
