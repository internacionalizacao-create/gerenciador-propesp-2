import type { AuthUser } from '../src/auth/auth-user';
import { normalizarNomeInstituicao } from '../src/database/normalizacao';
import * as s from '../src/database/schema';
import { ParceirosService } from '../src/dominio/parceiros.service';
import { ResultadosService } from '../src/dominio/resultados.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { acessoGlobalDeTeste, criarBase, type BaseFixture } from './fixtures';

/**
 * V1-032 — gerir convenios pela interface.
 *
 * As regras do acordo ja tinham cobertura em `resultados.int-spec.ts` (CG-056).
 * O que esta tarefa acrescenta, e o que estes casos cobram, e o que a **tela**
 * precisa para operar sem `pnpm api`:
 *
 * - o historico do parceiro entrega **todos os campos editaveis**, porque e
 *   dele que o formulario de edicao se preenche — com metade dos campos, salvar
 *   apagaria a outra metade;
 * - o acordo de duas redes continua sendo **uma linha** no historico, e nao
 *   duas, apesar das redes agora virem junto;
 * - a jornada inteira da ficha: criar → produto associado → inativar →
 *   reativar, com o produto intacto do inicio ao fim;
 * - **inativar nao esconde o acordo do historico** — some da lista padrao, nao
 *   da ficha do parceiro, senao inativar equivaleria a apagar;
 * - e o recorte: sem `convenio:read` a secao vem vazia **e** o acesso vem
 *   marcado como negado, para o estado vazio nao afirmar "nao ha acordo".
 */

const acessoAmplo = acessoGlobalDeTeste([
  'parceiro:read',
  'bolsa:read',
  'missao:read',
  'produto-missao:read',
  'convenio:read',
]);

/** A mesma conta sem a leitura de convenio — o recorte da V1-016. */
const acessoSemConvenio = acessoGlobalDeTeste([
  'parceiro:read',
  'bolsa:read',
  'missao:read',
  'produto-missao:read',
]);

const admin: AuthUser = {
  id: 'admin-convenios-v1',
  name: 'Admin dos Acordos',
  roles: ['admin'],
  permissions: [
    'missao:read',
    'produto-missao:create',
    'convenio:create',
    'convenio:edit',
    'convenio:status',
  ],
};

describe('V1-032: convenios pela interface', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: ResultadosService;
  let parceiros: ParceirosService;
  let missaoId: string;
  let parceiroId: string;
  let segundaRedeId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new ResultadosService(ctx.db);
    parceiros = new ParceirosService(ctx.db);
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);

    const [segunda] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId: base.cicloId,
        nome: 'Rede Sul',
        instituicaoId: base.instituicaoId,
      })
      .returning({ id: s.redeCoordenadora.id });
    segundaRedeId = segunda.id;

    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MCG-320',
        titulo: 'Missão que originou o acordo',
        objetivo: 'Negociar cooperação',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-10',
      })
      .returning({ id: s.missaoComite.id });
    missaoId = missao.id;

    const [parceiro] = await ctx.db
      .insert(s.instituicao)
      .values({
        nome: 'Universidad de Salamanca',
        nomeNormalizado: normalizarNomeInstituicao('Universidad de Salamanca'),
        tipo: 'PARCEIRA_INTERNACIONAL',
      })
      .returning({ id: s.instituicao.id });
    parceiroId = parceiro.id;
  });

  const convenioValido = () => ({
    instituicaoId: parceiroId,
    titulo: 'Acordo de dupla titulação',
    tipoAcordo: 'DUPLA_TITULACAO' as const,
    area: 'Ciências ambientais',
    objetivo: 'Formação conjunta de doutorandos',
    situacao: 'EM_TRAMITACAO' as const,
    numeroProcesso: '23456.000123/2027-10',
    dataAssinatura: null,
    dataInicio: '2027-06-01',
    dataFim: null,
    observacoes: 'Minuta em análise jurídica.',
    missaoOrigemId: missaoId,
    redesIds: [base.redeId],
  });

  // ------------------------------------------- o que a edicao precisa ler --

  it('o historico entrega os campos que o formulario de edicao preenche', async () => {
    await service.criarConvenio(convenioValido(), admin);

    const { convenios } = await parceiros.historico(parceiroId, acessoAmplo);
    expect(convenios).toHaveLength(1);
    const [acordo] = convenios;

    // Estes quatro nao apareciam no historico antes da V1-032, e sao
    // justamente os que a edicao sobrescreveria com vazio se nao os lesse.
    expect(acordo.numeroProcesso).toBe('23456.000123/2027-10');
    expect(acordo.objetivo).toBe('Formação conjunta de doutorandos');
    expect(acordo.observacoes).toBe('Minuta em análise jurídica.');
    expect(acordo.redes.map((rede) => rede.id)).toEqual([base.redeId]);
  });

  it('acordo de duas redes continua sendo uma linha do historico', async () => {
    // A armadilha e a mesma da CG-027 na missao multirrede: carregar as redes
    // por `join` faria o acordo aparecer uma vez por rede, e a ficha do
    // parceiro passaria a contar dois acordos onde ha um.
    await service.criarConvenio(
      { ...convenioValido(), redesIds: [base.redeId, segundaRedeId] },
      admin,
    );

    const { convenios } = await parceiros.historico(parceiroId, acessoAmplo);
    expect(convenios).toHaveLength(1);
    expect(convenios[0].redes).toHaveLength(2);
  });

  // ------------------------------------------------ a jornada da ficha --

  it('criar, associar produto, inativar e reativar preserva o produto', async () => {
    const convenio = await service.criarConvenio(convenioValido(), admin);

    const resultados = await service.criarProduto(
      base.cicloId,
      missaoId,
      {
        tipo: 'CONVENIO',
        titulo: 'Acordo firmado na missão',
        descricao: null,
        situacao: 'CONCLUIDO',
        ano: 2027,
        referencia: null,
        observacoes: null,
        convenioId: convenio.id,
        instituicoesIds: [parceiroId],
        redesIds: [],
        responsaveis: [],
      },
      admin,
    );

    const inativo = await service.inativarConvenio(
      convenio.id,
      { justificativa: 'Acordo encerrado antes da assinatura.' },
      admin,
    );
    expect(inativo.ativo).toBe(false);
    // O produto continua apontando para o acordo inativado: inativar retira de
    // circulacao, nao desfaz o que ja foi registrado.
    const produtoId = resultados.produtos[0].id;
    expect(inativo.produtos.map((item) => item.id)).toContain(produtoId);

    const reativado = await service.reativarConvenio(
      convenio.id,
      { justificativa: 'Processo retomado pela reitoria.' },
      admin,
    );
    expect(reativado.ativo).toBe(true);
    expect(reativado.produtos).toHaveLength(1);
  });

  it('acordo inativado some da lista padrao, nao do historico do parceiro', async () => {
    const convenio = await service.criarConvenio(convenioValido(), admin);
    await service.inativarConvenio(
      convenio.id,
      { justificativa: 'Substituído por outro processo.' },
      admin,
    );

    const padrao = await service.listarConvenios({ incluirInativos: false });
    expect(padrao).toHaveLength(0);

    // Na ficha do parceiro ele continua, marcado como inativo. Se sumisse
    // daqui tambem, inativar seria indistinguivel de apagar — e a tela nao
    // teria de onde oferecer a reativacao.
    const { convenios } = await parceiros.historico(parceiroId, acessoAmplo);
    expect(convenios).toHaveLength(1);
    expect(convenios[0].ativo).toBe(false);
  });

  it('a edicao pela tela troca as redes sem tocar no resto do acordo', async () => {
    const convenio = await service.criarConvenio(convenioValido(), admin);

    // O formulario manda o acordo inteiro, com a lista de redes reconciliada:
    // e por isso que ele precisa ter lido as redes atuais antes.
    await service.atualizarConvenio(
      convenio.id,
      {
        titulo: 'Acordo de dupla titulação (revisado)',
        redesIds: [segundaRedeId],
      },
      admin,
    );

    const { convenios } = await parceiros.historico(parceiroId, acessoAmplo);
    expect(convenios[0].titulo).toBe('Acordo de dupla titulação (revisado)');
    expect(convenios[0].redes.map((rede) => rede.id)).toEqual([segundaRedeId]);
    // Campo nao enviado e campo preservado — a API nao o zera, e por isso o
    // formulario pode mandar o objeto inteiro sem medo do inverso.
    expect(convenios[0].numeroProcesso).toBe('23456.000123/2027-10');
  });

  // ------------------------------------------------------------ recorte --

  it('sem convenio:read a secao vem vazia e o acesso vem negado', async () => {
    await service.criarConvenio(convenioValido(), admin);

    const historico = await parceiros.historico(parceiroId, acessoSemConvenio);
    expect(historico.convenios).toHaveLength(0);
    // O par importa: lista vazia sozinha faria a tela escrever "nenhum acordo
    // cadastrado" para quem apenas nao pode consultar os acordos.
    expect(historico.acesso.convenios).toBe(false);
  });
});
