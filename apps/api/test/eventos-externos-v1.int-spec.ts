import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { and, eq } from 'drizzle-orm';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';

import type { AuthUser } from '../src/auth/auth-user';
import type { AuthenticatedRequest } from '../src/auth/auth.decorators';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import {
  AcessoV1Service,
  type AcessoResolvido,
} from '../src/auth/autorizacao-v1/acesso-v1.service';
import type { PermissaoV1 } from '../src/auth/autorizacao-v1/catalogo';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import { IdentidadeService } from '../src/auth/identidade.service';
import { ArmazenamentoService } from '../src/arquivos/armazenamento.service';
import * as s from '../src/database/schema';
import { carregarTiposEventoBolsista } from '../src/database/seed/tipos-evento-bolsista';
import { AnexosService } from '../src/dominio/anexos.service';
import {
  BolsistasService,
  criarBolsaConcedidaSchema,
} from '../src/dominio/bolsistas.service';
import type { CicloResolvido } from '../src/dominio/contexto.service';
import { ContextoService } from '../src/dominio/contexto.service';
import {
  EventosDaBolsaController,
  EventosDoCicloController,
  EventosExternosController,
} from '../src/dominio/eventos-externos.controller';
import {
  EventosExternosService,
  registrarMovimentacaoSchema,
  type RegistrarEventoBolsista,
  type RegistrarMovimentacao,
} from '../src/dominio/eventos-externos.service';
import { MobilidadeService } from '../src/dominio/mobilidade.service';
import { OrcamentoService } from '../src/dominio/orcamento.service';
import {
  criarContextoTeste,
  esperarViolacao,
  type ContextoTeste,
} from './db-teste';
import {
  bolsaValida,
  criarAcesso,
  criarBase,
  type BaseFixture,
} from './fixtures';

/**
 * V1-036 · eventos externos da CAPES.
 *
 * O que se trava aqui e o contrato de docs/eventos-externos-v1.md: o evento
 * muda a situacao da bolsa pelo tipo, a vaga segue a regra "cancelada libera,
 * interrompida nao", reenvio nao duplica, correcao nao apaga, a movimentacao
 * fica na mesma tematica e nenhum derivado financeiro muda por fora dos
 * servicos de calculo. O acesso vem de `concessao_acesso` pelo resolver real.
 */

const GLOBAL: PermissaoV1[] = [
  'evento:read',
  'evento:create',
  'evento:edit',
  'bolsa:read',
  'bolsa:create',
  'bolsa:edit',
];

describe('V1-036: eventos externos da CAPES', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let eventos: EventosExternosService;
  let bolsas: BolsistasService;
  let mobilidade: MobilidadeService;
  let orcamento: OrcamentoService;
  let anexos: AnexosService;
  let contexto: ContextoService;
  let resolver: AcessoV1Service;
  let ciclo: CicloResolvido;
  let app: INestApplication;
  let url: string;
  /** Quem a autenticacao ficticia poe na requisicao HTTP. */
  let subAtual = 'operador';

  let itemA: string;
  let ppg2: string;
  let ppgOutraTematica: string;
  let tematica2: string;
  let pais: string;
  let bolsaX: string;
  let bolsaDoPpg2: string;

  const conta = async (sub: string) => {
    const acesso = await resolver.resolver(sub);
    const usuario: AuthUser = {
      id: sub,
      name: `Conta ${sub}`,
      roles: [],
      permissions: acesso.permissoes,
    };
    return { usuario, acesso };
  };

  let operador: { usuario: AuthUser; acesso: AcessoResolvido };

  const evento = (
    tipo: string,
    extra: Partial<RegistrarEventoBolsista> = {},
  ): RegistrarEventoBolsista => ({
    chave: randomUUID(),
    tipo,
    dataAto: '2026-05-12',
    justificativa: 'Registro do ato informado pela CAPES.',
    referenciaExterna: 'Ofício 12/2026',
    ...extra,
  });

  const movimentacao = (
    extra: Partial<RegistrarMovimentacao> = {},
  ): RegistrarMovimentacao =>
    registrarMovimentacaoSchema.parse({
      chave: randomUUID(),
      dataAto: '2026-06-01',
      ano: 2027,
      areaTematicaId: base.areaTematicaId,
      ppgOrigemId: base.ppgId,
      ppgDestinoId: ppg2,
      rubrica: 'BOLSAS',
      modalidadeId: base.modalidadeId,
      quantidade: 1,
      valor: '82902.20',
      justificativa: 'Bolsa não utilizada, realocada pela CAPES.',
      ...extra,
    });

  const statusDe = async (id: string) =>
    (
      await ctx.db
        .select({ status: s.bolsaConcedida.status })
        .from(s.bolsaConcedida)
        .where(eq(s.bolsaConcedida.id, id))
    )[0].status;

  const concessao = async (
    nome: string,
    cpf: string,
    ppgId: string,
    extra: Partial<typeof s.bolsaConcedida.$inferInsert> = {},
  ) => {
    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome, cpf, tipo: 'DISCENTE', ppgId })
      .returning({ id: s.pessoa.id });
    const [bolsa] = await ctx.db
      .insert(s.bolsaConcedida)
      .values({
        programaId: base.programaId,
        cicloId: base.cicloId,
        ppgId,
        areaTematicaId: base.areaTematicaId,
        pessoaId: pessoa.id,
        modalidadeId: base.modalidadeId,
        destino: 'EXTERIOR',
        nivelBeneficiario: 'DOUTORADO',
        dataInicio: '2027-03-01',
        dataFim: '2027-08-31',
        vigenciaMeses: '6.0',
        valorConcedido: '82902.20',
        fluxo: 'OUT',
        status: 'EM_ANDAMENTO',
        paisDestinoNome: 'Portugal',
        instituicaoDestinoNome: 'Universidade de Lisboa',
        ...extra,
      })
      .returning({ id: s.bolsaConcedida.id });
    return bolsa.id;
  };

  /** Concessao pela porta real, para a vaga ser conferida por `exigirVaga`. */
  const conceder = (cpf: string) =>
    bolsas.criar(
      criarBolsaConcedidaSchema.parse({
        itemPlanejadoId: itemA,
        nome: `Bolsista ${cpf}`,
        cpf,
        nivelBeneficiario: 'DOUTORADO',
        paisOrigemId: pais,
        modoInstituicaoOrigem: 'livre',
        instituicaoOrigemNome: 'Universidade do Estado do Amazonas',
        paisDestinoNome: 'Portugal',
        instituicaoDestinoNome: 'Universidade de Lisboa',
        dataInicio: '2027-03-01',
        dataFim: '2027-08-31',
      }),
      operador.usuario,
      operador.acesso,
    );

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    process.env.ARQUIVOS_DIR = await mkdtemp(join(tmpdir(), 'v1036-'));
    const identidade = new IdentidadeService(ctx.db);
    eventos = new EventosExternosService(ctx.db);
    bolsas = new BolsistasService(ctx.db, identidade);
    mobilidade = new MobilidadeService(ctx.db, identidade);
    orcamento = new OrcamentoService(ctx.db);
    anexos = new AnexosService(ctx.db, new ArmazenamentoService(), identidade);
    contexto = new ContextoService(ctx.db);
    resolver = new AcessoV1Service(ctx.db);

    const modulo = await Test.createTestingModule({
      controllers: [
        EventosDaBolsaController,
        EventosDoCicloController,
        EventosExternosController,
      ],
      providers: [
        { provide: EventosExternosService, useValue: eventos },
        { provide: ContextoService, useValue: contexto },
      ],
    }).compile();
    app = modulo.createNestApplication();
    // Autenticacao substituida pela identidade ficticia; concessoes, guard,
    // controller, validacao, SQL e transacoes sao reais.
    app.use((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      resolver
        .resolver(subAtual)
        .then((acesso) => {
          req.acesso = acesso;
          req.user = {
            id: subAtual,
            name: `Conta ${subAtual}`,
            roles: [],
            permissions: acesso.permissoes,
          };
          next();
        })
        .catch(next);
    });
    app.useGlobalGuards(new PermissionsGuard(app.get(Reflector)));
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    // O truncate leva a tabela de tipos junto; a seed a devolve.
    await carregarTiposEventoBolsista(ctx.db);
    base = await criarBase(ctx.db);

    ppg2 = (
      await ctx.db
        .insert(s.ppg)
        .values({ nome: 'PPG Vizinho', sigla: 'PPGVIZ' })
        .returning()
    )[0].id;
    ppgOutraTematica = (
      await ctx.db
        .insert(s.ppg)
        .values({ nome: 'PPG de Outra Temática', sigla: 'PPGOUT' })
        .returning()
    )[0].id;
    tematica2 = (
      await ctx.db
        .insert(s.areaTematica)
        .values({ redeId: base.redeId, codigo: 'TESTE-T2', nome: 'Temática 2' })
        .returning()
    )[0].id;
    await ctx.db.insert(s.participacaoPpg).values([
      {
        ppgId: base.ppgId,
        areaTematicaId: base.areaTematicaId,
        coordenadorTematicaId: base.coordenadorTematicaId,
        situacao: 'CONTEMPLADO',
      },
      {
        ppgId: ppg2,
        areaTematicaId: base.areaTematicaId,
        coordenadorTematicaId: base.coordenadorTematicaId,
        situacao: 'CONTEMPLADO',
      },
      {
        ppgId: ppgOutraTematica,
        areaTematicaId: tematica2,
        coordenadorTematicaId: base.coordenadorTematicaId,
        situacao: 'CONTEMPLADO',
      },
    ]);

    itemA = (
      await ctx.db
        .insert(s.itemPlanejado)
        .values(bolsaValida(base, 'BOL-A'))
        .returning()
    )[0].id;
    // Uma vaga so: e o que torna visivel quem libera e quem ocupa.
    await ctx.db
      .insert(s.planejamentoAnual)
      .values({ itemPlanejadoId: itemA, ano: 2027, quantidade: 1 });

    pais = (
      await ctx.db
        .insert(s.pais)
        .values({ nome: 'Brasil', codigoIso2: 'BR', codigoIso3: 'BRA' })
        .returning()
    )[0].id;

    bolsaX = await concessao('Bolsista X', '52998224725', base.ppgId, {
      itemPlanejadoId: itemA,
    });
    bolsaDoPpg2 = await concessao('Bolsista Vizinho', '11144477735', ppg2);

    await criarAcesso(ctx.db, { sub: 'operador', permissoes: GLOBAL });
    await criarAcesso(ctx.db, {
      sub: 'restrito',
      permissoes: GLOBAL,
      alvo: colunasDoAlvo({
        tipo: 'PPG',
        ppgId: base.ppgId,
        cicloId: base.cicloId,
      }),
    });
    await criarAcesso(ctx.db, {
      sub: 'sem-edicao',
      permissoes: ['evento:read', 'evento:create', 'bolsa:read'],
    });
    await criarAcesso(ctx.db, {
      sub: 'so-leitura',
      permissoes: ['bolsa:read'],
    });

    operador = await conta('operador');
    subAtual = 'operador';
    ciclo = await contexto.resolver('programa-teste', '2027-2030');
  });

  // -------------------------------------------------------------------------
  describe('eventos do beneficiário', () => {
    it('desistência cancela, libera a vaga, audita e não mexe no custo do plano', async () => {
      const custoAntes = await orcamento.porTematica(base.cicloId, 2027);
      // A unica vaga esta ocupada por X.
      await expect(conceder('39053344705')).rejects.toThrow(/vagas planejadas/);

      const registrado = await eventos.registrar(
        bolsaX,
        evento('DESISTENCIA'),
        operador.usuario,
        operador.acesso,
      );

      expect(registrado).toMatchObject({
        tipo: 'DESISTENCIA',
        statusAnterior: 'EM_ANDAMENTO',
        statusPosterior: 'CANCELADA',
        dataAto: '2026-05-12',
        comprovantes: 0,
        corrigido: false,
      });
      // As duas datas: a do ato informada, a do registro automatica.
      expect(registrado.registradoEm).toBeTruthy();
      expect(await statusDe(bolsaX)).toBe('CANCELADA');

      // Cancelada libera: a vaga volta, e a concessao nova entra.
      await expect(conceder('39053344705')).resolves.toMatchObject({
        status: 'SELECIONADO',
      });

      const trilha = await ctx.db
        .select()
        .from(s.registroAuditoria)
        .where(eq(s.registroAuditoria.entidadeId, bolsaX));
      expect(trilha).toEqual([
        expect.objectContaining({
          campo: 'status',
          valorAnterior: 'EM_ANDAMENTO',
          valorNovo: 'CANCELADA',
          dataReferencia: '2026-05-12',
          usuarioId: 'operador',
        }),
      ]);

      // O custo do plano sai de planejamento_anual e nao muda (contrato §5.2).
      expect(await orcamento.porTematica(base.cicloId, 2027)).toEqual(
        custoAntes,
      );
      expect(await ctx.db.select().from(s.lancamentoExecucao)).toHaveLength(0);
    });

    it('interrupção mantém a vaga ocupada', async () => {
      await eventos.registrar(
        bolsaX,
        evento('INTERRUPCAO', { previsaoRetorno: '2027-12-01' }),
        operador.usuario,
        operador.acesso,
      );
      expect(await statusDe(bolsaX)).toBe('INTERROMPIDA');
      await expect(conceder('39053344705')).rejects.toThrow(/vagas planejadas/);
    });

    it('falecimento leva a Interrompida, sem estado que publique a causa', async () => {
      const registrado = await eventos.registrar(
        bolsaX,
        evento('FALECIMENTO'),
        operador.usuario,
        operador.acesso,
      );
      expect(registrado.statusPosterior).toBe('INTERROMPIDA');
      const listada = await bolsas.detalhar(
        bolsaX,
        operador.usuario,
        operador.acesso,
      );
      expect(listada.status).toBe('INTERROMPIDA');
    });

    it('recusa evento que não se aplica à situação atual e tipo desconhecido', async () => {
      await ctx.db
        .update(s.bolsaConcedida)
        .set({ status: 'SELECIONADO' })
        .where(eq(s.bolsaConcedida.id, bolsaX));

      await expect(
        eventos.registrar(
          bolsaX,
          evento('INTERRUPCAO'),
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(/não se aplica a bolsa com situação Selecionado/);
      await expect(
        eventos.registrar(
          bolsaX,
          evento('PRORROGACAO'),
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(/Tipo de evento desconhecido/);
      await expect(
        eventos.registrar(
          bolsaX,
          evento('DESISTENCIA', { previsaoRetorno: '2027-01-01' }),
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(/não tem previsão de retorno/);
      await expect(
        eventos.registrar(
          bolsaX,
          evento('DESISTENCIA', { dataAto: '2999-01-01' }),
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(/não pode estar no futuro/);

      expect(await statusDe(bolsaX)).toBe('SELECIONADO');
      expect(await ctx.db.select().from(s.eventoBolsista)).toHaveLength(0);
    });

    it('tipo desligado pela instituição deixa de ser aceito', async () => {
      await ctx.db
        .update(s.tipoEventoBolsista)
        .set({ ativo: false })
        .where(eq(s.tipoEventoBolsista.codigo, 'DESISTENCIA'));
      await expect(
        eventos.registrar(
          bolsaX,
          evento('DESISTENCIA'),
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(/inativo/);
      expect((await eventos.tipos()).map((t) => t.codigo)).not.toContain(
        'DESISTENCIA',
      );
    });

    it('reenvio com a mesma chave devolve o registro sem aplicar o efeito de novo', async () => {
      const dto = evento('DESISTENCIA');
      const primeiro = await eventos.registrar(
        bolsaX,
        dto,
        operador.usuario,
        operador.acesso,
      );
      const segundo = await eventos.registrar(
        bolsaX,
        dto,
        operador.usuario,
        operador.acesso,
      );

      expect(segundo.id).toBe(primeiro.id);
      expect(await ctx.db.select().from(s.eventoBolsista)).toHaveLength(1);
      const trilha = await ctx.db
        .select()
        .from(s.registroAuditoria)
        .where(eq(s.registroAuditoria.entidadeTipo, 'EVENTO_BOLSISTA'));
      expect(trilha).toHaveLength(1);

      // A mesma chave noutra bolsa nao e reenvio: e erro de quem enviou.
      await expect(
        eventos.registrar(bolsaDoPpg2, dto, operador.usuario, operador.acesso),
      ).rejects.toThrow(/chave de envio já foi usada/);
    });

    it('reenvios simultâneos da mesma chave produzem um evento só', async () => {
      const dto = evento('DESISTENCIA');
      const resultados = await Promise.all(
        [1, 2, 3].map(() =>
          eventos.registrar(bolsaX, dto, operador.usuario, operador.acesso),
        ),
      );
      expect(new Set(resultados.map((r) => r.id)).size).toBe(1);
      expect(await ctx.db.select().from(s.eventoBolsista)).toHaveLength(1);
    });

    it('dois eventos simultâneos na mesma bolsa: o segundo encontra a situação já mudada', async () => {
      const resultados = await Promise.allSettled([
        eventos.registrar(
          bolsaX,
          evento('DESISTENCIA'),
          operador.usuario,
          operador.acesso,
        ),
        eventos.registrar(
          bolsaX,
          evento('INTERRUPCAO'),
          operador.usuario,
          operador.acesso,
        ),
      ]);
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
      expect(resultados.filter((r) => r.status === 'rejected')).toHaveLength(1);
      expect(await ctx.db.select().from(s.eventoBolsista)).toHaveLength(1);
    });

    it('recorta pelo alcance da ação e exige bolsa:edit além de evento:create', async () => {
      const restrito = await conta('restrito');
      const semEdicao = await conta('sem-edicao');
      const soLeitura = await conta('so-leitura');

      // Fora do alcance: 404, como no resto da P03.
      await expect(
        eventos.registrar(
          bolsaDoPpg2,
          evento('DESISTENCIA'),
          restrito.usuario,
          restrito.acesso,
        ),
      ).rejects.toThrow('Bolsa concedida não encontrada.');
      await expect(
        eventos.daBolsa(bolsaDoPpg2, restrito.acesso),
      ).rejects.toThrow('Bolsa concedida não encontrada.');

      // Registrar evento e editar a bolsa por outra porta.
      await expect(
        eventos.registrar(
          bolsaX,
          evento('DESISTENCIA'),
          semEdicao.usuario,
          semEdicao.acesso,
        ),
      ).rejects.toThrow('Bolsa concedida não encontrada.');
      await expect(eventos.daBolsa(bolsaX, soLeitura.acesso)).rejects.toThrow(
        'Bolsa concedida não encontrada.',
      );

      await eventos.registrar(
        bolsaX,
        evento('DESISTENCIA'),
        restrito.usuario,
        restrito.acesso,
      );
      await eventos.registrar(
        bolsaDoPpg2,
        evento('DESISTENCIA'),
        operador.usuario,
        operador.acesso,
      );

      // A lista do ciclo so traz a bolsa do PPG alcancado.
      const doCiclo = await eventos.doCiclo(ciclo, restrito.acesso);
      expect(doCiclo.map((e) => e.bolsaConcedidaId)).toEqual([bolsaX]);
      expect(await eventos.doCiclo(ciclo, operador.acesso)).toHaveLength(2);
      expect(await statusDe(bolsaDoPpg2)).toBe('CANCELADA');
    });

    it('substituição liga a bolsa que sai à que entra na mesma vaga, e o panorama conta uma', async () => {
      const antes = await mobilidade.panorama(
        operador.usuario,
        { cicloId: base.cicloId },
        operador.acesso,
      );
      expect(antes.totais.mobilidades).toBe(2);

      const saida = await eventos.registrar(
        bolsaX,
        evento('SUBSTITUICAO'),
        operador.usuario,
        operador.acesso,
      );
      expect(saida.bolsaSubstitutaId).toBeNull();

      // Com a vaga liberada, o substituto entra pela porta normal.
      const entra = await conceder('39053344705');
      const ligado = await eventos.corrigir(
        saida.id,
        {
          motivo: 'Substituto cadastrado.',
          bolsaSubstitutaId: entra.id,
        },
        operador.usuario,
        operador.acesso,
      );
      expect(ligado).toMatchObject({
        bolsaSubstitutaId: entra.id,
        substituto: 'Bolsista 39053344705',
        corrigido: true,
      });

      const historicoDoSubstituto = await eventos.daBolsa(
        entra.id,
        operador.acesso,
      );
      expect(historicoDoSubstituto.substituiu.map((e) => e.id)).toEqual([
        saida.id,
      ]);

      // X saiu (cancelada), o substituto entrou: 2 continua 2, nao 3.
      const depois = await mobilidade.panorama(
        operador.usuario,
        { cicloId: base.cicloId },
        operador.acesso,
      );
      expect(depois.totais.mobilidades).toBe(2);
      const canceladas = await mobilidade.panorama(
        operador.usuario,
        { cicloId: base.cicloId, status: 'CANCELADA' },
        operador.acesso,
      );
      expect(canceladas.totais.mobilidades).toBe(1);

      // O beneficiario anterior continua na bolsa que saiu.
      const [pessoaDeX] = await ctx.db
        .select({ nome: s.pessoa.nome })
        .from(s.bolsaConcedida)
        .innerJoin(s.pessoa, eq(s.pessoa.id, s.bolsaConcedida.pessoaId))
        .where(eq(s.bolsaConcedida.id, bolsaX));
      expect(pessoaDeX.nome).toBe('Bolsista X');
    });

    it('panorama e relatório deixam a cancelada de fora pelo mesmo filtro', async () => {
      await criarAcesso(ctx.db, {
        sub: 'exporta',
        permissoes: ['bolsa:read', 'bolsa:export'],
      });
      const exporta = await conta('exporta');
      await eventos.registrar(
        bolsaX,
        evento('DESISTENCIA'),
        operador.usuario,
        operador.acesso,
      );
      await eventos.registrar(
        bolsaDoPpg2,
        evento('INTERRUPCAO'),
        operador.usuario,
        operador.acesso,
      );

      // Interrompida conta — a viagem aconteceu; cancelada nao.
      const panorama = await mobilidade.panorama(
        exporta.usuario,
        { cicloId: base.cicloId },
        exporta.acesso,
      );
      const relatorio = await mobilidade.relatorio(
        exporta.usuario,
        { cicloId: base.cicloId },
        exporta.acesso,
      );
      expect(panorama.totais.mobilidades).toBe(1);
      expect(relatorio.map((linha) => linha.bolsista)).toEqual([
        'Bolsista Vizinho',
      ]);
    });

    it('substituta precisa ocupar a mesma vaga e só substitui uma vez', async () => {
      await expect(
        eventos.registrar(
          bolsaX,
          evento('SUBSTITUICAO', { bolsaSubstitutaId: bolsaDoPpg2 }),
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(/mesma vaga/);
      await expect(
        eventos.registrar(
          bolsaX,
          evento('DESISTENCIA', { bolsaSubstitutaId: bolsaDoPpg2 }),
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(/não aponta bolsa substituta/);

      // Duas vagas no item para caberem tres concessoes ao longo do caso.
      await ctx.db
        .update(s.planejamentoAnual)
        .set({ quantidade: 2 })
        .where(eq(s.planejamentoAnual.itemPlanejadoId, itemA));
      const outra = await concessao('Bolsista W', '12345678909', base.ppgId, {
        itemPlanejadoId: itemA,
      });
      await eventos.registrar(
        bolsaX,
        evento('SUBSTITUICAO'),
        operador.usuario,
        operador.acesso,
      );
      const entra = await conceder('39053344705');
      await eventos.registrar(
        outra,
        evento('SUBSTITUICAO', { bolsaSubstitutaId: entra.id }),
        operador.usuario,
        operador.acesso,
      );
      const [saidaX] = await ctx.db
        .select({ id: s.eventoBolsista.id })
        .from(s.eventoBolsista)
        .where(eq(s.eventoBolsista.bolsaConcedidaId, bolsaX));
      await expect(
        eventos.corrigir(
          saidaX.id,
          { motivo: 'Vincular substituto.', bolsaSubstitutaId: entra.id },
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(/já foi registrada como substituta/);
    });

    it('correção de data preserva o evento e grava a troca campo a campo', async () => {
      const registrado = await eventos.registrar(
        bolsaX,
        evento('DESISTENCIA', { dataAto: '2026-06-12' }),
        operador.usuario,
        operador.acesso,
      );
      const corrigido = await eventos.corrigir(
        registrado.id,
        { motivo: 'Data digitada errada.', dataAto: '2026-05-12' },
        operador.usuario,
        operador.acesso,
      );

      expect(corrigido).toMatchObject({
        id: registrado.id,
        dataAto: '2026-05-12',
        corrigido: true,
      });
      const trilha = await ctx.db
        .select()
        .from(s.registroAuditoria)
        .where(
          and(
            eq(s.registroAuditoria.entidadeId, registrado.id),
            eq(s.registroAuditoria.acao, 'EDICAO'),
          ),
        );
      expect(trilha).toEqual([
        expect.objectContaining({
          campo: 'dataAto',
          valorAnterior: '2026-06-12',
          valorNovo: '2026-05-12',
          justificativa: 'Data digitada errada.',
        }),
      ]);
      expect(await ctx.db.select().from(s.eventoBolsista)).toHaveLength(1);
    });

    it('a trilha registra que a justificativa mudou, sem guardar o texto', async () => {
      const registrado = await eventos.registrar(
        bolsaX,
        evento('FALECIMENTO', { justificativa: 'Texto que descreve a causa.' }),
        operador.usuario,
        operador.acesso,
      );
      await eventos.corrigir(
        registrado.id,
        {
          motivo: 'Texto revisado.',
          justificativa: 'Registro conforme ofício.',
        },
        operador.usuario,
        operador.acesso,
      );
      const [troca] = await ctx.db
        .select()
        .from(s.registroAuditoria)
        .where(
          and(
            eq(s.registroAuditoria.entidadeId, registrado.id),
            eq(s.registroAuditoria.acao, 'EDICAO'),
          ),
        );
      expect(troca).toMatchObject({
        campo: 'justificativa',
        valorAnterior: null,
        valorNovo: null,
        justificativa: 'Texto revisado.',
      });
    });

    it('correção de tipo reaplica o efeito a partir do estado fotografado', async () => {
      const registrado = await eventos.registrar(
        bolsaX,
        evento('DESISTENCIA'),
        operador.usuario,
        operador.acesso,
      );
      const corrigido = await eventos.corrigir(
        registrado.id,
        {
          motivo: 'Era interrupção, não desistência.',
          tipo: 'INTERRUPCAO',
        },
        operador.usuario,
        operador.acesso,
      );
      expect(corrigido).toMatchObject({
        tipo: 'INTERRUPCAO',
        statusAnterior: 'EM_ANDAMENTO',
        statusPosterior: 'INTERROMPIDA',
      });
      expect(await statusDe(bolsaX)).toBe('INTERROMPIDA');
    });

    it('correção que falharia na vaga não deixa evento nem bolsa pela metade', async () => {
      const registrado = await eventos.registrar(
        bolsaX,
        evento('DESISTENCIA'),
        operador.usuario,
        operador.acesso,
      );
      // Alguem ocupou a vaga que a desistencia liberou.
      await conceder('39053344705');

      await expect(
        eventos.corrigir(
          registrado.id,
          {
            motivo: 'Era interrupção.',
            tipo: 'INTERRUPCAO',
            dataAto: '2026-05-01',
          },
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(/vagas planejadas/);

      expect(await statusDe(bolsaX)).toBe('CANCELADA');
      const [intacto] = await ctx.db
        .select()
        .from(s.eventoBolsista)
        .where(eq(s.eventoBolsista.id, registrado.id));
      expect(intacto).toMatchObject({
        tipo: 'DESISTENCIA',
        dataAto: '2026-05-12',
        statusPosterior: 'CANCELADA',
      });
      const correcoes = await ctx.db
        .select()
        .from(s.registroAuditoria)
        .where(eq(s.registroAuditoria.acao, 'EDICAO'));
      // So a mudanca de status do registro original.
      expect(correcoes.map((c) => c.entidadeTipo)).toEqual(['BOLSA_CONCEDIDA']);
    });

    it('a edição da bolsa não desfaz a situação que um evento produziu', async () => {
      await eventos.registrar(
        bolsaX,
        evento('DESISTENCIA'),
        operador.usuario,
        operador.acesso,
      );
      await expect(
        bolsas.atualizar(
          bolsaX,
          {
            dataInicio: '2027-03-01',
            dataFim: '2027-08-31',
            status: 'EM_ANDAMENTO',
          },
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(
        /definida pelo evento externo Desistência, de 12\/05\/2026/,
      );
      expect(await statusDe(bolsaX)).toBe('CANCELADA');

      // Sem evento, a situacao continua editavel — e agora deixa rastro.
      await bolsas.atualizar(
        bolsaDoPpg2,
        {
          dataInicio: '2027-03-01',
          dataFim: '2027-08-31',
          status: 'CONCLUIDA',
        },
        operador.usuario,
        operador.acesso,
      );
      const [rastro] = await ctx.db
        .select()
        .from(s.registroAuditoria)
        .where(eq(s.registroAuditoria.entidadeId, bolsaDoPpg2));
      expect(rastro).toMatchObject({
        campo: 'status',
        valorAnterior: 'EM_ANDAMENTO',
        valorNovo: 'CONCLUIDA',
      });
    });

    it('a edição não leva a bolsa a cancelada ou interrompida sem evento (V1-037)', async () => {
      for (const status of ['CANCELADA', 'INTERROMPIDA'] as const) {
        await expect(
          bolsas.atualizar(
            bolsaX,
            { dataInicio: '2027-03-01', dataFim: '2027-08-31', status },
            operador.usuario,
            operador.acesso,
          ),
        ).rejects.toThrow(/registre-os como evento externo/);
      }
      expect(await statusDe(bolsaX)).toBe('EM_ANDAMENTO');
    });

    it('oferece como substituta só a bolsa da mesma vaga ainda livre (V1-037)', async () => {
      await eventos.registrar(
        bolsaX,
        evento('SUBSTITUICAO'),
        operador.usuario,
        operador.acesso,
      );
      const entra = await conceder('39053344705');
      const { substitutas } = await eventos.daBolsa(bolsaX, operador.acesso);
      // A bolsa do PPG vizinho nao e da mesma vaga e fica de fora.
      expect(substitutas.map((b) => b.id)).toEqual([entra.id]);
    });

    it('referências da movimentação trazem só temáticas com dois PPGs alcançados (V1-037)', async () => {
      const completas = await eventos.referenciasDeMovimentacao(
        ciclo,
        operador.acesso,
      );
      expect(completas.anos).toEqual([2027, 2028, 2029, 2030]);
      expect(completas.tematicas).toEqual([
        expect.objectContaining({
          id: base.areaTematicaId,
          ppgs: [
            expect.objectContaining({ sigla: 'PPGT' }),
            expect.objectContaining({ sigla: 'PPGVIZ' }),
          ],
        }),
      ]);
      // Alcance de um PPG so nao forma par: nada a oferecer.
      const restrito = await conta('restrito');
      const parciais = await eventos.referenciasDeMovimentacao(
        ciclo,
        restrito.acesso,
      );
      expect(parciais.tematicas).toEqual([]);
    });

    it('comprovante herda o recorte da bolsa e aceita só categorias de comprovante', async () => {
      const registrado = await eventos.registrar(
        bolsaDoPpg2,
        evento('DESISTENCIA'),
        operador.usuario,
        operador.acesso,
      );
      const restrito = await conta('restrito');
      const pdf = Buffer.concat([
        Buffer.from('255044462d312e34', 'hex'),
        Buffer.alloc(64, 0x41),
      ]);
      const arquivo = {
        originalname: 'oficio.pdf',
        buffer: pdf,
        size: pdf.length,
      };

      await expect(
        anexos.listar(
          {
            entidadeTipo: 'EVENTO_BOLSISTA',
            entidadeId: registrado.id,
            incluirInativos: false,
          },
          restrito.usuario,
        ),
      ).rejects.toThrow('Documento não encontrado.');
      await expect(
        anexos.enviar(
          {
            entidadeTipo: 'EVENTO_BOLSISTA',
            entidadeId: registrado.id,
            categoria: 'PASSAPORTE',
            visibilidade: 'INTERNA',
          },
          arquivo,
          operador.usuario,
        ),
      ).rejects.toThrow(/não é aceita em comprovante de evento externo/);

      await anexos.enviar(
        {
          entidadeTipo: 'EVENTO_BOLSISTA',
          entidadeId: registrado.id,
          categoria: 'COMPROVANTE',
          visibilidade: 'INTERNA',
        },
        arquivo,
        operador.usuario,
      );
      const [comComprovante] = await eventos.doCiclo(ciclo, operador.acesso);
      expect(comComprovante.comprovantes).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('garantias do banco', () => {
    const linha = (extra: Partial<typeof s.eventoBolsista.$inferInsert>) => ({
      bolsaConcedidaId: bolsaX,
      tipo: 'SUBSTITUICAO',
      dataAto: '2026-05-12',
      justificativa: 'Registro direto.',
      statusAnterior: 'EM_ANDAMENTO' as const,
      statusPosterior: 'CANCELADA' as const,
      chaveIdempotencia: randomUUID(),
      registradoPorId: 'operador',
      ...extra,
    });

    it('a bolsa não substitui a si mesma, nem sem justificativa', async () => {
      await esperarViolacao(
        ctx.db
          .insert(s.eventoBolsista)
          .values(linha({ bolsaSubstitutaId: bolsaX })),
        'evento_bolsista_substituta_ck',
      );
      await esperarViolacao(
        ctx.db.insert(s.eventoBolsista).values(linha({ justificativa: '   ' })),
        'evento_bolsista_justificativa_ck',
      );
    });

    it('a mesma chave não entra duas vezes e o evento não some com a bolsa', async () => {
      const chave = randomUUID();
      await ctx.db
        .insert(s.eventoBolsista)
        .values(linha({ chaveIdempotencia: chave }));
      await esperarViolacao(
        ctx.db
          .insert(s.eventoBolsista)
          .values(linha({ chaveIdempotencia: chave })),
        'evento_bolsista_chave_uk',
      );
      await esperarViolacao(
        ctx.db.delete(s.bolsaConcedida).where(eq(s.bolsaConcedida.id, bolsaX)),
        'evento_bolsista_bolsa_concedida_id_bolsa_concedida_id_fk',
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('movimentações de recurso', () => {
    it('registra na mesma temática, com código, trilha e sem mexer no plano', async () => {
      const custoAntes = await orcamento.porTematica(base.cicloId, 2027);
      const planoAntes = await ctx.db.select().from(s.planejamentoAnual);

      const registrada = await eventos.registrarMovimentacao(
        ciclo,
        movimentacao(),
        operador.usuario,
        operador.acesso,
      );

      expect(registrada).toMatchObject({
        codigo: 'REM-001',
        status: 'EXECUTADO',
        ppgOrigemSigla: 'PPGT',
        ppgDestinoSigla: 'PPGVIZ',
        areaTematicaCodigo: 'TESTE-T1',
        valor: '82902.20',
        quantidade: 1,
        referenciaExterna: null,
        comprovantes: 0,
      });
      const segunda = await eventos.registrarMovimentacao(
        ciclo,
        movimentacao({
          valor: '100.00',
          quantidade: null,
          modalidadeId: null,
          rubrica: 'MISSOES',
        }),
        operador.usuario,
        operador.acesso,
      );
      expect(segunda.codigo).toBe('REM-002');

      const [criacao] = await ctx.db
        .select()
        .from(s.registroAuditoria)
        .where(eq(s.registroAuditoria.entidadeId, registrada.id));
      expect(criacao).toMatchObject({ acao: 'CRIACAO', usuarioId: 'operador' });

      // Teto e custo intactos: a movimentacao redistribui dentro do teto.
      expect(await orcamento.porTematica(base.cicloId, 2027)).toEqual(
        custoAntes,
      );
      expect(await ctx.db.select().from(s.planejamentoAnual)).toEqual(
        planoAntes,
      );
      // Registro de ato externo, nunca pagamento: nada de execucao financeira.
      expect(await ctx.db.select().from(s.lancamentoExecucao)).toHaveLength(0);
    });

    it('recusa outra temática, PPG repetido, exercício fora do ciclo e estado propositivo', async () => {
      await expect(
        eventos.registrarMovimentacao(
          ciclo,
          movimentacao({ ppgDestinoId: ppgOutraTematica }),
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(/mesma área temática/);
      await expect(
        eventos.registrarMovimentacao(
          ciclo,
          movimentacao({ ano: 2031 }),
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(/não pertence ao ciclo/);

      expect(() => movimentacao({ ppgDestinoId: base.ppgId })).toThrow(
        /PPGs diferentes/,
      );
      for (const status of ['PROPOSTO', 'AUTORIZADO', 'REJEITADO']) {
        expect(
          registrarMovimentacaoSchema.safeParse({
            ...movimentacao(),
            status,
          }).success,
        ).toBe(false);
      }
      expect(await ctx.db.select().from(s.remanejamento)).toHaveLength(0);
    });

    it('exige alcance sobre os dois lados, e cada lado vê a movimentação', async () => {
      const restrito = await conta('restrito');
      await expect(
        eventos.registrarMovimentacao(
          ciclo,
          movimentacao(),
          restrito.usuario,
          restrito.acesso,
        ),
      ).rejects.toThrow(
        'Sem permissão para registrar movimentação envolvendo o PPGVIZ.',
      );

      await eventos.registrarMovimentacao(
        ciclo,
        movimentacao(),
        operador.usuario,
        operador.acesso,
      );
      // O PPG que cedeu enxerga; quem nao alcanca nenhum lado, nao.
      expect(await eventos.movimentacoes(ciclo, restrito.acesso)).toHaveLength(
        1,
      );
      const soLeitura = await conta('so-leitura');
      expect(await eventos.movimentacoes(ciclo, soLeitura.acesso)).toHaveLength(
        0,
      );
    });

    it('reenvio não duplica, nem em paralelo', async () => {
      const dto = movimentacao();
      const resultados = await Promise.all(
        [1, 2, 3].map(() =>
          eventos.registrarMovimentacao(
            ciclo,
            dto,
            operador.usuario,
            operador.acesso,
          ),
        ),
      );
      expect(new Set(resultados.map((r) => r.id)).size).toBe(1);
      expect(await ctx.db.select().from(s.remanejamento)).toHaveLength(1);
    });

    it('correção revalida os lados e grava a troca com o motivo', async () => {
      const registrada = await eventos.registrarMovimentacao(
        ciclo,
        movimentacao(),
        operador.usuario,
        operador.acesso,
      );
      await expect(
        eventos.corrigirMovimentacao(
          registrada.id,
          { motivo: 'Destino errado.', ppgDestinoId: ppgOutraTematica },
          operador.usuario,
          operador.acesso,
        ),
      ).rejects.toThrow(/mesma área temática/);

      const corrigida = await eventos.corrigirMovimentacao(
        registrada.id,
        {
          motivo: 'Valor do ofício.',
          valor: '82902.2',
          referenciaExterna: 'Ofício 30/2026',
        },
        operador.usuario,
        operador.acesso,
      );
      expect(corrigida).toMatchObject({
        valor: '82902.20',
        referenciaExterna: 'Ofício 30/2026',
        corrigido: true,
      });
      const trilha = await ctx.db
        .select()
        .from(s.registroAuditoria)
        .where(
          and(
            eq(s.registroAuditoria.entidadeId, registrada.id),
            eq(s.registroAuditoria.acao, 'EDICAO'),
          ),
        );
      // `82902.2` e o mesmo valor: so a referencia mudou de fato.
      expect(trilha.map((t) => t.campo)).toEqual(['referenciaExterna']);

      const restrito = await conta('restrito');
      await expect(
        eventos.corrigirMovimentacao(
          registrada.id,
          { motivo: 'Tentativa.', justificativa: 'Outra justificativa.' },
          restrito.usuario,
          restrito.acesso,
        ),
      ).rejects.toThrow('Movimentação não encontrada.');
    });
  });

  // -------------------------------------------------------------------------
  describe('pela API', () => {
    const enviar = (caminho: string, corpo: unknown) =>
      fetch(`${url}${caminho}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      });

    it('o guard, a validação e o recorte recusam o pedido adulterado', async () => {
      subAtual = 'so-leitura';
      expect(
        (await enviar(`/bolsistas/${bolsaX}/eventos`, evento('DESISTENCIA')))
          .status,
      ).toBe(403);
      expect((await fetch(`${url}/eventos-externos/tipos`)).status).toBe(403);

      subAtual = 'operador';
      const tipos = await fetch(`${url}/eventos-externos/tipos`);
      const listados = (await tipos.json()) as { codigo: string }[];
      expect(listados.map((t) => t.codigo)).toEqual([
        'DESISTENCIA',
        'INTERRUPCAO',
        'FALECIMENTO',
        'SUBSTITUICAO',
        'CONCLUSAO_ANTECIPADA',
      ]);

      const registrado = await enviar(
        `/bolsistas/${bolsaX}/eventos`,
        evento('DESISTENCIA'),
      );
      expect(registrado.status).toBe(201);
      expect(await registrado.json()).toMatchObject({
        statusPosterior: 'CANCELADA',
      });

      const caminho = '/programas/programa-teste/2027-2030/movimentacoes';
      const corpo = { ...movimentacao(), chave: randomUUID() };
      expect(
        (await enviar(caminho, { ...corpo, status: 'PROPOSTO' })).status,
      ).toBe(400);
      expect(
        (await enviar(caminho, { ...corpo, ppgDestinoId: ppgOutraTematica }))
          .status,
      ).toBe(422);
      expect((await enviar(caminho, corpo)).status).toBe(201);

      subAtual = 'restrito';
      expect(
        (
          await enviar(
            `/bolsistas/${bolsaDoPpg2}/eventos`,
            evento('DESISTENCIA'),
          )
        ).status,
      ).toBe(404);
      expect(
        (await enviar(caminho, { ...corpo, chave: randomUUID() })).status,
      ).toBe(403);
    });
  });
});
