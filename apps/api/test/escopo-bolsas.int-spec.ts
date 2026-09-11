import type { AuthUser } from '../src/auth/auth-user';
import { RECORTE_OBRIGATORIO } from '../src/auth/escopo';
import { IdentidadeService } from '../src/auth/identidade.service';
import * as s from '../src/database/schema';
import { BolsistasService } from '../src/dominio/bolsistas.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { bolsaValida, criarBase, type BaseFixture } from './fixtures';

const coordenador = (parcial: Partial<AuthUser> = {}): AuthUser => ({
  id: 'sub-coord',
  username: 'coord.teste',
  email: 'coord.teste@propesp.local',
  name: 'Coordenação de Teste',
  roles: ['coordenador'],
  permissions: ['bolsa:read', 'bolsa:write', 'produto:read', 'produto:write'],
  ...parcial,
});

const ADMIN: AuthUser = coordenador({
  id: 'sub-admin',
  username: 'admin',
  email: 'admin@propesp.local',
  roles: ['admin'],
});

/**
 * Recorte por PPG das concessoes (BOL-020).
 *
 * A P03 guarda CPF, nome e periodo de pessoas reais, e ate a BOL-020 qualquer
 * conta com `bolsa:read` via todas as concessoes de todos os PPGs. Estes casos
 * sao o que impede a regressao — e sao pre-requisito do anexo de documento
 * pessoal (BOL-021), que multiplicaria o dano de um acesso indevido.
 */
describe('Recorte por PPG das bolsas concedidas', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let identidade: IdentidadeService;
  let bolsistas: BolsistasService;

  /** Ids do cenario: dois PPGs, uma concessao e uma linha de plano em cada. */
  let ppgOutroId: string;
  let bolsaDoEscopoId: string;
  let bolsaDeForaId: string;
  let itemDoEscopoId: string;
  let itemDeForaId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    identidade = new IdentidadeService(ctx.db);
    bolsistas = new BolsistasService(ctx.db, identidade);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);

    const [outro] = await ctx.db
      .insert(s.ppg)
      .values({
        nome: 'PPG de Outro Coordenador',
        sigla: 'PPGOUTRO',
        situacao: 'ATIVO',
      })
      .returning({ id: s.ppg.id });
    ppgOutroId = outro.id;

    const criarLinha = async (codigo: string, ppgId: string) => {
      const [item] = await ctx.db
        .insert(s.itemPlanejado)
        .values({ ...bolsaValida(base, codigo), ppgId })
        .returning({ id: s.itemPlanejado.id });
      await ctx.db.insert(s.planejamentoAnual).values({
        itemPlanejadoId: item.id,
        ano: 2027,
        quantidade: 5,
      });
      return item.id;
    };
    itemDoEscopoId = await criarLinha('BOL-001', base.ppgId);
    itemDeForaId = await criarLinha('BOL-002', ppgOutroId);

    const criarConcessao = async (nome: string, cpf: string, ppgId: string) => {
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
          pessoaId: pessoa.id,
          modalidadeId: base.modalidadeId,
          destino: 'EXTERIOR',
          nivelBeneficiario: 'DOUTORADO',
          dataInicio: '2027-03-01',
          dataFim: '2027-08-31',
          vigenciaMeses: '6.0',
          valorConcedido: '82902.20',
          fluxo: 'OUT',
        })
        .returning({ id: s.bolsaConcedida.id });
      return bolsa.id;
    };
    bolsaDoEscopoId = await criarConcessao(
      'Bolsista Do Escopo',
      '52998224725',
      base.ppgId,
    );
    bolsaDeForaId = await criarConcessao(
      'Bolsista De Fora',
      '11144477735',
      ppgOutroId,
    );
  });

  /** Concede escopo de PPG ao coordenador e devolve o usuario pronto. */
  const comEscopoNo = async (ppgId: string) => {
    const resolvida = await identidade.resolver(coordenador());
    await ctx.db.insert(s.escopoAcesso).values({
      usuarioId: resolvida!.usuarioId,
      tipo: 'PPG',
      ppgId,
    });
    return coordenador();
  };

  // -------------------------------------------------------------------------
  // Leitura

  it('a listagem devolve somente as concessoes do PPG no escopo', async () => {
    const usuario = await comEscopoNo(base.ppgId);

    const recortadas = await bolsistas.listar(usuario);
    expect(recortadas.map((bolsa) => bolsa.id)).toEqual([bolsaDoEscopoId]);

    // O admin continua vendo as duas: o recorte nao muda o dado, so quem o le.
    const todas = await bolsistas.listar(ADMIN);
    expect(todas).toHaveLength(2);
  });

  it('o detalhe de concessao fora do escopo responde 404, nunca 403', async () => {
    const usuario = await comEscopoNo(base.ppgId);

    await expect(bolsistas.detalhar(bolsaDeForaId, usuario)).rejects.toThrow(
      'Bolsa concedida não encontrada.',
    );
    // 403 diria "existe, mas nao e sua" — e a existencia da bolsa ja e o dado
    // protegido: entrega que aquela pessoa tem uma concessao.
    await expect(
      bolsistas.detalhar(bolsaDeForaId, usuario),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('o formulario so oferece as linhas planejadas do escopo', async () => {
    const usuario = await comEscopoNo(base.ppgId);

    const opcoes = await bolsistas.opcoesPlanejamento(usuario);
    expect(opcoes.map((opcao) => opcao.id)).toEqual([itemDoEscopoId]);
    expect(await bolsistas.opcoesPlanejamento(ADMIN)).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // Escrita

  it('recusa conceder bolsa numa linha de PPG fora do escopo', async () => {
    const usuario = await comEscopoNo(base.ppgId);

    await expect(
      bolsistas.criar(
        {
          itemPlanejadoId: itemDeForaId,
          nome: 'Tentativa Indevida',
          cpf: '19625224016',
          nivelBeneficiario: 'DOUTORADO',
          paisOrigemId: '00000000-0000-4000-8000-000000000000',
          modoInstituicaoOrigem: 'livre',
          instituicaoOrigemNome: 'Universidade de Teste',
          paisDestinoNome: 'Portugal',
          instituicaoDestinoNome: 'Universidade de Destino',
          dataInicio: '2027-04-01',
          dataFim: '2027-09-30',
          status: 'SELECIONADO',
        },
        usuario,
      ),
    ).rejects.toThrow('Bolsa planejada não encontrada.');
  });

  it('o produto herda o recorte da bolsa e nao vira porta lateral', async () => {
    const usuario = await comEscopoNo(base.ppgId);

    // Conhecer o UUID nao basta: sem alcance a concessao, nao se escreve nela.
    await expect(
      bolsistas.criarProduto(
        bolsaDeForaId,
        {
          tipo: 'ARTIGO',
          titulo: 'Produto numa bolsa alheia',
          prazoEntrega: '2027-12-01',
          status: 'PREVISTO',
          instituicaoColaboracao: 'Universidade de Coimbra',
          paisColaboracao: 'Portugal',
        },
        usuario,
      ),
    ).rejects.toThrow('Bolsa concedida não encontrada.');

    // E a do proprio escopo continua funcionando.
    const produto = await bolsistas.criarProduto(
      bolsaDoEscopoId,
      {
        tipo: 'ARTIGO',
        titulo: 'Produto legitimo',
        prazoEntrega: '2027-12-01',
        status: 'PREVISTO',
        instituicaoColaboracao: 'Universidade de Coimbra',
        paisColaboracao: 'Portugal',
      },
      usuario,
    );
    expect(produto.titulo).toBe('Produto legitimo');
  });

  it('recusa atualizar concessao fora do escopo', async () => {
    const usuario = await comEscopoNo(base.ppgId);

    await expect(
      bolsistas.atualizar(
        bolsaDeForaId,
        {
          dataInicio: '2027-03-01',
          dataFim: '2027-08-31',
          status: 'CONCLUIDA',
        },
        usuario,
      ),
    ).rejects.toThrow('Bolsa concedida não encontrada.');
  });

  // -------------------------------------------------------------------------
  // Os dois modos de RECORTE_OBRIGATORIO

  it('conta sem escopo nenhum segue o modo de RECORTE_OBRIGATORIO', async () => {
    // Conta resolvida, porem sem nenhum escopo atribuido — o estado real de
    // todo mundo enquanto a PROPESP nao distribui os escopos.
    await identidade.resolver(coordenador());

    const vistas = await bolsistas.listar(coordenador());
    expect(vistas).toHaveLength(RECORTE_OBRIGATORIO ? 0 : 2);
  });

  it('escopo de rede sem PPG nao libera PPG nenhum', async () => {
    // Quem tem escopo de **rede** e nenhum de PPG nao esta "sem configuracao":
    // foi configurado para outra dimensao, e liberar todos os PPGs seria
    // vazamento. E o caso que a implementacao ingenua erra.
    const resolvida = await identidade.resolver(coordenador());
    await ctx.db.insert(s.escopoAcesso).values({
      usuarioId: resolvida!.usuarioId,
      tipo: 'REDE',
      redeId: base.redeId,
    });

    expect(await bolsistas.listar(coordenador())).toEqual([]);
  });
});
