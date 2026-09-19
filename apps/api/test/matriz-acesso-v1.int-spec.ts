import { eq, sql } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { AcessoV1Service } from '../src/auth/autorizacao-v1/acesso-v1.service';
import type { Alcance } from '../src/auth/autorizacao-v1/alcance';
import type { PermissaoV1 } from '../src/auth/autorizacao-v1/catalogo';
import type { EscopoV1 } from '../src/auth/autorizacao-v1/concessao';
import { ConcessoesService } from '../src/auth/autorizacao-v1/concessoes.service';
import { copiarModelo } from '../src/auth/autorizacao-v1/modelos';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import { IdentidadeService } from '../src/auth/identidade.service';
import { normalizarNomeInstituicao } from '../src/database/normalizacao';
import * as s from '../src/database/schema';
import { BolsistasService } from '../src/dominio/bolsistas.service';
import { CatalogoService } from '../src/dominio/catalogo.service';
import { ContextoService } from '../src/dominio/contexto.service';
import { MobilidadeService } from '../src/dominio/mobilidade.service';
import { ParceirosService } from '../src/dominio/parceiros.service';
import { PlanoService } from '../src/dominio/plano.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';

/**
 * V1-020 — regressao integral da matriz de acesso.
 *
 * As suites anteriores provam cada entrega isoladamente: `recorte-bolsas-v1` o
 * alcance por acao das bolsas, `recorte-indiretos-v1` os caminhos indiretos,
 * `escopo-rede` as missoes, `concessoes-admin` a politica administrativa. **Esta
 * nao repete nenhuma delas** — ela cruza o que cada uma deixa de fora, que e
 * justamente onde a autorizacao costuma vazar:
 *
 * - **dois ciclos**, para o alvo `PPG` ser um par e nao duas listas soltas;
 * - **uma tematica compartilhada por dois PPGs**, para distinguir o alcance de
 *   tematica do de participacao;
 * - **leitura ampla com escrita estreita**, em varios dominios de uma vez;
 * - **conta inativa, conta sem vinculo local e revogacao**, ponta a ponta.
 *
 * O fixture e proprio, e nao `criarBase`: aquele tem um ciclo so, e um ciclo so
 * nao consegue exibir o erro cartesiano — que e o caso central daqui.
 */

const PERIODO = { dataInicio: '2027-03-01', dataFim: '2027-08-31' } as const;

interface Matriz {
  programaId: string;
  ciclo1: string;
  ciclo2: string;
  redeA: string;
  redeB: string;
  redeC: string;
  t1: string;
  t2: string;
  t3: string;
  ppgX: string;
  ppgY: string;
  participacaoX1: string;
  participacaoY1: string;
  modalidadeId: string;
  itemCatalogoId: string;
  instituicaoId: string;
  paisId: string;
  /** Uma linha de plano por combinacao PPG x ciclo. */
  itemX1: string;
  itemY1: string;
  itemX2: string;
  itemY2: string;
  bolsaX1: string;
  bolsaY1: string;
  missaoMultirrede: string;
}

describe('V1-020: matriz de acesso entre ciclos, PPGs e acoes', () => {
  let ctx: ContextoTeste;
  let m: Matriz;
  let resolver: AcessoV1Service;
  let concessoes: ConcessoesService;
  let identidade: IdentidadeService;
  let contexto: ContextoService;
  let plano: PlanoService;
  let bolsas: BolsistasService;
  let mobilidade: MobilidadeService;
  let parceiros: ParceirosService;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    identidade = new IdentidadeService(ctx.db);
    resolver = new AcessoV1Service(ctx.db);
    concessoes = new ConcessoesService(ctx.db, resolver);
    contexto = new ContextoService(ctx.db);
    plano = new PlanoService(ctx.db, new CatalogoService(ctx.db));
    bolsas = new BolsistasService(ctx.db, identidade);
    mobilidade = new MobilidadeService(ctx.db, identidade);
    parceiros = new ParceirosService(ctx.db);
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    m = await montarMatriz();
  });

  // ---------------------------------------------------------------- fixture --

  async function montarMatriz(): Promise<Matriz> {
    const um = async <T>(p: Promise<T[]>) => (await p)[0];

    const pais = await um(
      ctx.db
        .insert(s.pais)
        .values({ nome: 'Brasil', codigoIso2: 'BR', codigoIso3: 'BRA' })
        .returning(),
    );
    const instituicao = await um(
      ctx.db
        .insert(s.instituicao)
        .values({
          nome: 'Universidade da Matriz',
          nomeNormalizado: normalizarNomeInstituicao('Universidade da Matriz'),
          tipo: 'PARCEIRA_INTERNACIONAL',
        })
        .returning(),
    );
    const programa = await um(
      ctx.db
        .insert(s.programa)
        .values({
          nome: 'Programa da Matriz',
          slug: 'matriz',
          usaRedes: true,
          usaAreasTematicas: true,
        })
        .returning(),
    );
    const ciclo = async (nome: string, inicio: number, fim: number) =>
      um(
        ctx.db
          .insert(s.ciclo)
          .values({
            programaId: programa.id,
            nome,
            anoInicio: inicio,
            anoFim: fim,
          })
          .returning(),
      );
    const c1 = await ciclo('2027-2030', 2027, 2030);
    const c2 = await ciclo('2031-2034', 2031, 2034);

    const rede = async (cicloId: string, nome: string) =>
      um(
        ctx.db
          .insert(s.redeCoordenadora)
          .values({ cicloId, instituicaoId: instituicao.id, nome })
          .returning(),
      );
    const rA = await rede(c1.id, 'REDE-A');
    const rB = await rede(c1.id, 'REDE-B');
    const rC = await rede(c2.id, 'REDE-C');

    const tematica = async (redeId: string, codigo: string) =>
      um(
        ctx.db
          .insert(s.areaTematica)
          .values({ redeId, codigo, nome: `Temática ${codigo}` })
          .returning(),
      );
    const t1 = await tematica(rA.id, 'T1');
    const t2 = await tematica(rB.id, 'T2');
    const t3 = await tematica(rC.id, 'T3');

    const ppg = async (sigla: string) =>
      um(
        ctx.db
          .insert(s.ppg)
          .values({ nome: `PPG ${sigla}`, sigla, nivel: 'DOUTORADO' })
          .returning(),
      );
    const ppgX = await ppg('PPGX');
    const ppgY = await ppg('PPGY');

    // `participacao_ppg.coordenador_tematica_id` e obrigatorio: a participacao
    // existe porque alguem coordena aquela tematica naquele PPG.
    const coordenador = await um(
      ctx.db
        .insert(s.pessoa)
        .values({ nome: 'Coordenação da Matriz', tipo: 'DOCENTE' })
        .returning(),
    );
    const participacao = async (ppgId: string, areaTematicaId: string) =>
      um(
        ctx.db
          .insert(s.participacaoPpg)
          .values({
            ppgId,
            areaTematicaId,
            coordenadorTematicaId: coordenador.id,
            situacao: 'CONTEMPLADO',
          })
          .returning(),
      );
    // T1 e a tematica **compartilhada**: os dois PPGs participam dela.
    const pX1 = await participacao(ppgX.id, t1.id);
    const pY1 = await participacao(ppgY.id, t1.id);
    await participacao(ppgY.id, t2.id);
    await participacao(ppgX.id, t3.id);
    await participacao(ppgY.id, t3.id);

    const modalidade = await um(
      ctx.db
        .insert(s.modalidade)
        .values({
          nome: 'Doutorado Sanduíche',
          permiteBrasil: false,
          permiteExterior: true,
        })
        .returning(),
    );
    const tabela = await um(
      ctx.db
        .insert(s.tabelaValores)
        .values({
          programaId: programa.id,
          versao: '2026-01-01',
          dataBase: '2026-01-01',
          cotacaoDolar: '5.0000',
          vigenteDe: '2026-01-01',
        })
        .returning(),
    );
    const itemCatalogo = await um(
      ctx.db
        .insert(s.itemCatalogoBolsa)
        .values({
          tabelaValoresId: tabela.id,
          codigo: 'CAT-M01',
          destino: 'EXTERIOR',
          modalidadeId: modalidade.id,
          vigenciaMeses: '6.0',
          valorBrl: '1000.00',
        })
        .returning(),
    );

    const item = async (
      codigo: string,
      cicloId: string,
      ppgId: string,
      areaTematicaId: string,
    ) =>
      um(
        ctx.db
          .insert(s.itemPlanejado)
          .values({
            codigo,
            cicloId,
            ppgId,
            areaTematicaId,
            rubrica: 'BOLSAS',
            quantidadeAnual: 1,
            mesImplementacao: 'MARCO',
            status: 'PROGRAMADO',
            destino: 'EXTERIOR',
            modalidadeId: modalidade.id,
            vigenciaMeses: '6.0',
            itemCatalogoId: itemCatalogo.id,
            fluxo: 'OUT',
          })
          .returning(),
      );
    // As quatro combinacoes PPG x ciclo: e o que torna o erro cartesiano
    // visivel, porque cada concessao de PPG so pode alcancar uma delas.
    const iX1 = await item('BOL-X1', c1.id, ppgX.id, t1.id);
    const iY1 = await item('BOL-Y1', c1.id, ppgY.id, t1.id);
    const iX2 = await item('BOL-X2', c2.id, ppgX.id, t3.id);
    const iY2 = await item('BOL-Y2', c2.id, ppgY.id, t3.id);

    const bolsa = async (
      nome: string,
      cicloId: string,
      ppgId: string,
      areaTematicaId: string,
      itemPlanejadoId: string,
    ) => {
      const pessoa = await um(
        ctx.db.insert(s.pessoa).values({ nome, tipo: 'DISCENTE' }).returning(),
      );
      return um(
        ctx.db
          .insert(s.bolsaConcedida)
          .values({
            programaId: programa.id,
            cicloId,
            ppgId,
            pessoaId: pessoa.id,
            areaTematicaId,
            itemPlanejadoId,
            modalidadeId: modalidade.id,
            destino: 'EXTERIOR',
            nivelBeneficiario: 'DOUTORADO',
            instituicaoDestinoId: instituicao.id,
            ...PERIODO,
            status: 'EM_ANDAMENTO',
            vigenciaMeses: '6',
            valorConcedido: '1000.00',
            fluxo: 'OUT',
          })
          .returning(),
      );
    };
    const bX1 = await bolsa('Bolsista X1', c1.id, ppgX.id, t1.id, iX1.id);
    const bY1 = await bolsa('Bolsista Y1', c1.id, ppgY.id, t1.id, iY1.id);

    const missao = await um(
      ctx.db
        .insert(s.missaoComite)
        .values({
          cicloId: c1.id,
          codigo: 'MCG-M01',
          titulo: 'Missão de duas redes',
          objetivo: 'Cruzar o recorte',
          dataInicio: '2027-05-01',
          dataFim: '2027-05-10',
        })
        .returning(),
    );
    await ctx.db.insert(s.missaoRede).values([
      { missaoId: missao.id, redeId: rA.id },
      { missaoId: missao.id, redeId: rB.id },
    ]);
    await ctx.db.insert(s.atividadeMissao).values({
      missaoId: missao.id,
      ordem: 1,
      tipo: 'VISITA_TECNICA',
      titulo: 'Visita',
      paisId: pais.id,
      instituicaoId: instituicao.id,
      dataInicio: '2027-05-02',
      dataFim: '2027-05-03',
    });

    return {
      programaId: programa.id,
      ciclo1: c1.id,
      ciclo2: c2.id,
      redeA: rA.id,
      redeB: rB.id,
      redeC: rC.id,
      t1: t1.id,
      t2: t2.id,
      t3: t3.id,
      ppgX: ppgX.id,
      ppgY: ppgY.id,
      participacaoX1: pX1.id,
      participacaoY1: pY1.id,
      modalidadeId: modalidade.id,
      itemCatalogoId: itemCatalogo.id,
      instituicaoId: instituicao.id,
      paisId: pais.id,
      itemX1: iX1.id,
      itemY1: iY1.id,
      itemX2: iX2.id,
      itemY2: iY2.id,
      bolsaX1: bX1.id,
      bolsaY1: bY1.id,
      missaoMultirrede: missao.id,
    };
  }

  // ------------------------------------------------------------- contas --

  /** Conta local ativa, sem concessao alguma. */
  async function criarConta(sub: string): Promise<string> {
    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: `Conta ${sub}`, tipo: 'SERVIDOR' })
      .returning({ id: s.pessoa.id });
    const [conta] = await ctx.db
      .insert(s.usuarioSistema)
      .values({ sub, pessoaId: pessoa.id, origem: 'MANUAL' })
      .returning({ id: s.usuarioSistema.id });
    return conta.id;
  }

  async function conceder(
    usuarioId: string,
    permissao: PermissaoV1,
    alvo: EscopoV1,
  ): Promise<void> {
    await ctx.db.insert(s.concessaoAcesso).values({
      usuarioId,
      permissao,
      justificativa: 'Fixture da matriz de acesso.',
      ...colunasDoAlvo(alvo),
    });
  }

  /** Monta a conta e devolve o acesso resolvido, como o guard faria. */
  async function contaCom(
    sub: string,
    linhas: readonly [PermissaoV1, EscopoV1][],
  ) {
    const usuarioId = await criarConta(sub);
    for (const [permissao, alvo] of linhas) {
      await conceder(usuarioId, permissao, alvo);
    }
    return { usuarioId, acesso: await resolver.resolver(sub) };
  }

  const usuarioDe = (sub: string, acesso: { permissoes: PermissaoV1[] }) =>
    ({ id: sub, roles: [], permissions: acesso.permissoes }) as AuthUser;

  const noPpg = (ppgId: string, cicloId: string): EscopoV1 => ({
    tipo: 'PPG',
    ppgId,
    cicloId,
  });
  const naTematica = (tematicaId: string): EscopoV1 => ({
    tipo: 'TEMATICA',
    tematicaId,
  });
  const naParticipacao = (participacaoId: string): EscopoV1 => ({
    tipo: 'PARTICIPACAO',
    participacaoId,
  });
  const global = (): EscopoV1 => ({ tipo: 'GLOBAL' });

  const codigos = async (cicloId: string, alcance: Alcance) =>
    (await plano.listar(cicloId, {}, alcance)).map((l) => l.codigo).sort();

  // ------------------------------------------------ o alvo PPG e um par --

  it('concessao de PPG nao se combina entre ciclos', async () => {
    // PPG X no ciclo 1 **e** PPG Y no ciclo 2. Se o alcance guardasse duas
    // listas soltas — PPGs {X,Y} e ciclos {1,2} —, o produto delas liberaria
    // tambem X no ciclo 2 e Y no ciclo 1, que ninguem concedeu.
    const { acesso } = await contaCom('sub-cartesiana', [
      ['plano:read', noPpg(m.ppgX, m.ciclo1)],
      ['plano:read', noPpg(m.ppgY, m.ciclo2)],
    ]);
    const alcance = acesso.alcance('plano:read');

    expect(await codigos(m.ciclo1, alcance)).toEqual(['BOL-X1']);
    expect(await codigos(m.ciclo2, alcance)).toEqual(['BOL-Y2']);
  });

  it('tematica compartilhada alcanca os dois PPGs; participacao alcanca um', async () => {
    // T1 pertence a X e a Y. As duas concessoes parecem equivalentes e nao sao:
    // a tematica e a area inteira, a participacao e um PPG dentro dela.
    const { acesso: porTematica } = await contaCom('sub-tematica', [
      ['plano:read', naTematica(m.t1)],
    ]);
    expect(await codigos(m.ciclo1, porTematica.alcance('plano:read'))).toEqual([
      'BOL-X1',
      'BOL-Y1',
    ]);

    const { acesso: porParticipacao } = await contaCom('sub-participacao', [
      ['plano:read', naParticipacao(m.participacaoX1)],
    ]);
    expect(
      await codigos(m.ciclo1, porParticipacao.alcance('plano:read')),
    ).toEqual(['BOL-X1']);
  });

  // ------------------------------------- leitura ampla nao vira escrita --

  it('leitura global com escrita em um PPG nao escreve nos outros', async () => {
    const { acesso } = await contaCom('sub-ampla', [
      ['plano:read', global()],
      ['plano:create', noPpg(m.ppgX, m.ciclo1)],
      ['plano:edit', noPpg(m.ppgX, m.ciclo1)],
    ]);

    // Le os dois ciclos inteiros...
    expect(await codigos(m.ciclo1, acesso.alcance('plano:read'))).toEqual([
      'BOL-X1',
      'BOL-Y1',
    ]);
    expect(await codigos(m.ciclo2, acesso.alcance('plano:read'))).toEqual([
      'BOL-X2',
      'BOL-Y2',
    ]);

    // ...e edita so onde a acao de escrita alcanca.
    const ciclo = await contexto.resolver('matriz', '2027-2030');
    const usuario = usuarioDe('sub-ampla', acesso);
    await expect(
      plano.atualizar(
        ciclo,
        m.itemY1,
        { quantidadeAnual: 2, ano: 2027 } as never,
        usuario,
        acesso.alcance('plano:edit'),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('bolsa: leitura ampla, escrita estreita e campo pessoal a parte', async () => {
    const { acesso } = await contaCom('sub-bolsa', [
      ['bolsa:read', global()],
      ['bolsa:edit', noPpg(m.ppgX, m.ciclo1)],
    ]);
    const usuario = usuarioDe('sub-bolsa', acesso);

    const lista = await bolsas.listar(usuario, acesso);
    expect(lista.map((b) => b.id).sort()).toEqual(
      [m.bolsaX1, m.bolsaY1].sort(),
    );

    // Editar alcanca so a bolsa de X; a de Y responde 404, nao 403.
    expect(lista.find((b) => b.id === m.bolsaX1)?.podeEditar).toBe(true);
    expect(lista.find((b) => b.id === m.bolsaY1)?.podeEditar).toBe(false);

    // Sem `pessoa:read-*` nenhum campo pessoal sai, mesmo lendo a bolsa.
    for (const linha of lista) {
      expect(linha.podeLerCpf).toBe(false);
      expect(linha.cpf).toBeNull();
      expect(linha.telefone).toBeNull();
    }
  });

  it('capacidade pessoal global nao alcanca bolsa fora da leitura', async () => {
    // O cruzamento que a V1-015 fixou: a capacidade e global, mas o alvo
    // continua sendo recortado por `bolsa:read`.
    const { acesso } = await contaCom('sub-pessoal', [
      ['bolsa:read', noPpg(m.ppgX, m.ciclo1)],
      ['pessoa:read-cpf', global()],
    ]);
    const lista = await bolsas.listar(usuarioDe('sub-pessoal', acesso), acesso);

    expect(lista.map((b) => b.id)).toEqual([m.bolsaX1]);
    expect(lista[0].podeLerCpf).toBe(true);
  });

  // ------------------------------------------------ caminhos indiretos --

  it('missao multirrede aparece uma vez, e so para quem alcanca uma das redes', async () => {
    const { acesso: naRedeA } = await contaCom('sub-rede-a', [
      ['parceiro:read', global()],
      ['missao:read', { tipo: 'REDE', redeId: m.redeA }],
    ]);
    const comA = await parceiros.historico(m.instituicaoId, naRedeA);
    // Uma linha, apesar de a missao pertencer a duas redes.
    expect(comA.missoes.map((x) => x.id)).toEqual([m.missaoMultirrede]);

    const { acesso: naRedeC } = await contaCom('sub-rede-c', [
      ['parceiro:read', global()],
      ['missao:read', { tipo: 'REDE', redeId: m.redeC }],
    ]);
    const comC = await parceiros.historico(m.instituicaoId, naRedeC);
    expect(comC.missoes).toEqual([]);
    expect(comC.acesso.missoes).toBe(true);
  });

  it('exportacao de mobilidade nao amplia o que a tela mostra', async () => {
    const { acesso } = await contaCom('sub-export', [
      ['bolsa:read', noPpg(m.ppgX, m.ciclo1)],
      ['bolsa:export', global()],
    ]);
    const usuario = usuarioDe('sub-export', acesso);

    const linhas = await mobilidade.relatorio(usuario, {}, acesso);
    expect(linhas).toHaveLength(1);
    // Exportar amplo nao destrava o CPF: e capacidade propria.
    expect(linhas[0].cpf).toBeNull();
  });

  // --------------------------------------------- estado da conta e tempo --

  it('conta inativa perde tudo, inclusive a gestao de acesso', async () => {
    const { usuarioId, acesso } = await contaCom('sub-inativa', [
      ['plano:read', global()],
      ['acesso:read', global()],
      ['acesso:write', global()],
    ]);
    expect(acesso.ativo).toBe(true);

    await ctx.db
      .update(s.usuarioSistema)
      .set({ ativo: false })
      .where(eq(s.usuarioSistema.id, usuarioId));

    // Desativar a conta fecha tudo de uma vez — e nao so o negocio, senao
    // quem tem `acesso:*` se reativaria sozinho.
    const depois = await resolver.resolver('sub-inativa');
    expect(depois.ativo).toBe(false);
    expect(depois.permissoes).toEqual([]);
    expect(await codigos(m.ciclo1, depois.alcance('plano:read'))).toEqual([]);
  });

  it('token sem conta local nao autoriza nada', async () => {
    // O `sub` existe no Keycloak e nao tem linha em `usuario_sistema`: sem
    // vinculo nao ha concessao possivel, e o resolver nao inventa uma.
    const acesso = await resolver.resolver('sub-que-nunca-entrou');
    expect(acesso.ativo).toBe(false);
    expect(acesso.permissoes).toEqual([]);
    expect(await codigos(m.ciclo1, acesso.alcance('plano:read'))).toEqual([]);
  });

  it('revogar vale na consulta seguinte, sem esperar o token expirar', async () => {
    const { usuarioId, acesso } = await contaCom('sub-revogada', [
      ['plano:read', global()],
    ]);
    expect(await codigos(m.ciclo1, acesso.alcance('plano:read'))).toEqual([
      'BOL-X1',
      'BOL-Y1',
    ]);

    // `concessao_revogacao_ck` exige a data junto do estado: concessao inativa
    // sem `revogado_em` seria revogacao sem quando, e a auditoria nao fecha.
    await ctx.db
      .update(s.concessaoAcesso)
      .set({ ativo: false, revogadoEm: sql`now()` })
      .where(eq(s.concessaoAcesso.usuarioId, usuarioId));

    const depois = await resolver.resolver('sub-revogada');
    expect(await codigos(m.ciclo1, depois.alcance('plano:read'))).toEqual([]);
  });

  // ------------------------------------------------------------ modelos --

  it('aplicar modelo grava concessoes explicitas, sem heranca', async () => {
    const admin = await criarConta('sub-admin-matriz');
    await conceder(admin, 'acesso:read', global());
    await conceder(admin, 'acesso:write', global());
    const alvoId = await criarConta('sub-recebe-modelo');

    const modelo = copiarModelo('responsavel-ppg');
    const ator = {
      id: 'sub-admin-matriz',
      roles: [],
      permissions: (await resolver.resolver('sub-admin-matriz')).permissoes,
    } as AuthUser;

    await concessoes.conceder(ator, alvoId, {
      motivo: 'Matriz: modelo aplicado.',
      origem: 'responsavel-ppg',
      concessoes: modelo.permissoes.map((permissao) => ({
        permissao,
        escopo: noPpg(m.ppgX, m.ciclo1),
      })),
    });

    const gravadas = await ctx.db
      .select({ permissao: s.concessaoAcesso.permissao })
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.usuarioId, alvoId));

    // Linhas concretas, uma por acao — nao um ponteiro para o modelo. E por
    // isso que editar `modelos.ts` depois nao mexe em quem ja foi configurado.
    expect(gravadas).toHaveLength(modelo.permissoes.length);
    expect(gravadas.map((g) => g.permissao).sort()).toEqual(
      [...modelo.permissoes].sort(),
    );

    // E o alcance e o que foi escolhido na aplicacao, nunca GLOBAL por padrao.
    const recebido = await resolver.resolver('sub-recebe-modelo');
    expect(recebido.alcance('plano:read').global).toBe(false);
    expect(await codigos(m.ciclo1, recebido.alcance('plano:read'))).toEqual([
      'BOL-X1',
    ]);
  });

  it('modelo nao concede o que ele nao lista', () => {
    // O modelo de responsavel nao traz gestao de acesso nem dado pessoal; se
    // trouxesse por descuido, a matriz inteira mudaria de sentido.
    const modelo = copiarModelo('responsavel-ppg');
    expect(modelo.permissoes).not.toContain('acesso:write');
    expect(modelo.permissoes).not.toContain('acesso:delegate');
    expect(modelo.permissoes).not.toContain('pessoa:read-cpf');
  });

  // ------------------------------------------------- papel e vinculo --

  it('papel do token e vinculo de equipe nao concedem nada', async () => {
    const usuarioId = await criarConta('sub-so-papel');
    // Vinculo de equipe: fato de cadastro desde V1-012, nunca autorizacao.
    const [pessoa] = await ctx.db
      .select({ pessoaId: s.usuarioSistema.pessoaId })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.id, usuarioId));
    const [membro] = await ctx.db
      .insert(s.membroEquipeGestao)
      .values({
        cicloId: m.ciclo1,
        pessoaId: pessoa.pessoaId,
        tipoEquipe: 'COMITE_GESTOR',
        funcao: 'Membro',
        dataInicio: '2027-01-01',
      })
      .returning({ id: s.membroEquipeGestao.id });
    await ctx.db
      .insert(s.membroEquipeGestaoRede)
      .values({ membroEquipeId: membro.id, redeId: m.redeA });

    const acesso = await resolver.resolver('sub-so-papel');
    expect(acesso.ativo).toBe(true);
    // Conta viva, equipe cadastrada, papel `admin` no token — e nada concedido.
    expect(acesso.permissoes).toEqual([]);
    expect(await codigos(m.ciclo1, acesso.alcance('plano:read'))).toEqual([]);
  });
});
