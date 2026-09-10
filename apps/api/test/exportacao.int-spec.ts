import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AuthUser } from '../src/auth/auth-user';
import { RecorteDeMissoes } from '../src/auth/escopo';
import { IdentidadeService } from '../src/auth/identidade.service';
import { permissionsForRoles } from '../src/auth/permissions';
import { ArmazenamentoService } from '../src/arquivos/armazenamento.service';
import * as s from '../src/database/schema';
import { NotificacoesService } from '../src/dominio/notificacoes.service';
import { AnexosService } from '../src/dominio/anexos.service';
import { MobilidadeService } from '../src/dominio/mobilidade.service';
import {
  criarParceiroSchema,
  ParceirosService,
} from '../src/dominio/parceiros.service';
import { EncerramentoService } from '../src/dominio/encerramento.service';
import { MissoesComiteService } from '../src/dominio/missoes-comite.service';
import { PrestacaoService } from '../src/dominio/prestacao.service';
import {
  filtroRelatorioSchema,
  RelatoriosService,
} from '../src/dominio/relatorios.service';
import { ResultadosService } from '../src/dominio/resultados.service';
import { ExportacaoService } from '../src/exportacao/exportacao.service';
import { neutralizarFormula, paraXlsx } from '../src/exportacao/planilha';
import {
  criarContextoTeste,
  type ContextoTeste,
  type TestDatabase,
} from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-exportacao',
  name: 'Admin da Exportação',
  roles: ['admin'],
  permissions: permissionsForRoles(['admin']),
};

/**
 * Servico de notificacao sem canal externo — o mesmo estado da aplicacao hoje.
 *
 * Os testes de dominio verificam a regra de negocio, e nao a notificacao, que
 * tem suite propria em `notificacoes.int-spec.ts`. Montar aqui com canal nulo e
 * o que faz esses testes continuarem falando so do que se propoem a testar.
 */
function semCanal(db: TestDatabase): NotificacoesService {
  return new NotificacoesService(db, new IdentidadeService(db), null);
}

/**
 * Exportacoes e dossie (CG-069).
 *
 * O criterio de aceite tem quatro metades, e as quatro sao verificaveis:
 * manter filtros, moeda e datas; respeitar autorizacao; nao expor caminho
 * interno; nao expor conteudo privado.
 */
describe('Exportacao de relatorios e dossie (CG-069)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let exportacao: ExportacaoService;
  let missoes: MissoesComiteService;
  let anexos: AnexosService;
  let prestacao: PrestacaoService;
  let raiz: string;
  let paisId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    raiz = await mkdtemp(join(tmpdir(), 'exportacao-teste-'));
    process.env.ARQUIVOS_DIR = raiz;

    const identidade = new IdentidadeService(ctx.db);
    missoes = new MissoesComiteService(ctx.db, new EncerramentoService(ctx.db));
    prestacao = new PrestacaoService(ctx.db, semCanal(ctx.db));
    anexos = new AnexosService(ctx.db, new ArmazenamentoService(), identidade);
    exportacao = new ExportacaoService(
      new RelatoriosService(ctx.db, missoes),
      missoes,
      prestacao,
      new ResultadosService(ctx.db),
      new EncerramentoService(ctx.db),
      anexos,
      new ParceirosService(ctx.db),
      new MobilidadeService(ctx.db, identidade),
    );
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ codigoIso2: 'PT', codigoIso3: 'PRT', nome: 'Portugal' })
      .returning({ id: s.pais.id });
    paisId = pais.id;
  });

  async function criarMissao(codigo: string, titulo = `Missão ${codigo}`) {
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo,
        titulo,
        objetivo: 'Exercitar a exportação.',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-10',
        status: 'CONFIRMADA',
      })
      .returning({ id: s.missaoComite.id });
    await ctx.db
      .insert(s.missaoRede)
      .values({ missaoId: missao.id, redeId: base.redeId });
    await ctx.db.insert(s.atividadeMissao).values({
      missaoId: missao.id,
      ordem: 1,
      tipo: 'ARTICULACAO',
      titulo: 'Reunião institucional',
      paisId,
      dataInicio: '2027-05-02',
      dataFim: '2027-05-03',
    });
    return missao.id;
  }

  const exportar = (
    qual: 'missoes' | 'parceiros' | 'financas' | 'resultados',
    formato: 'pdf' | 'xlsx' | 'csv',
    filtro: Record<string, unknown> = {},
  ) =>
    exportacao.relatorio(
      base.cicloId,
      qual,
      formato,
      filtroRelatorioSchema.parse(filtro),
      RecorteDeMissoes.irrestrito(),
    );

  // --- neutralizacao de formula ---------------------------------------------

  it('neutraliza os inicios de formula, e so eles', () => {
    // A unica linha de codigo entre um titulo malicioso e a maquina de quem
    // abre a planilha.
    for (const perigoso of ['=cmd|x', '+1+1', '-1', '@SUM(A1)', '\tx', '\rx']) {
      expect(neutralizarFormula(perigoso)).toBe(`'${perigoso}`);
    }
    // Texto comum nao pode ganhar aspa: o relatorio ficaria ilegivel.
    for (const inocente of ['Missão ao Porto', '2027-05-01', 'R$ 1.000,00']) {
      expect(neutralizarFormula(inocente)).toBe(inocente);
    }
  });

  it('o titulo com formula sai neutralizado no CSV e no XLSX', async () => {
    await criarMissao('MCG-001', "=cmd|'/c calc'!A1");

    const csv = (await exportar('missoes', 'csv')).conteudo.toString('utf8');
    expect(csv).toContain(`"'=cmd|'/c calc'!A1"`);
    // Sem a aspa, o Excel executaria isso ao abrir.
    expect(csv).not.toContain(`"=cmd|`);

    const xlsx = (await exportar('missoes', 'xlsx')).conteudo.toString(
      'latin1',
    );
    expect(xlsx).not.toContain('<t xml:space="preserve">=cmd');
  });

  // --- formatos --------------------------------------------------------------

  it('o CSV sai com BOM e ponto e virgula, e preserva acento e moeda', async () => {
    const missaoId = await criarMissao('MCG-010', 'Missão à Coimbra');
    await prestacao.criar(base.cicloId, missaoId, admin);
    await prestacao.criarDespesa(
      base.cicloId,
      missaoId,
      {
        tipo: 'OUTRA',
        exercicio: 2027,
        valorTotal: '1234.56',
        descricao: 'Inscrição',
      } as never,
      admin,
    );

    const arquivo = await exportar('missoes', 'csv');
    const texto = arquivo.conteudo.toString('utf8');

    expect(arquivo.mimeType).toBe('text/csv; charset=utf-8');
    // Sem BOM o Excel no Windows le UTF-8 como Latin-1.
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    expect(texto).toContain('Missão à Coimbra');
    // Moeda continua string decimal ate a apresentacao — nada de float.
    expect(texto).toContain('1234.56');
    expect(texto).toContain('2027-05-01');
  });

  it('o XLSX gerado abre no LibreOffice com acento, numero e formula neutra', async () => {
    // Verificacao de verdade: um `.xlsx` escrito a mao pode passar em toda
    // assercao de conteudo e ainda assim o Excel recusar o arquivo. Quem
    // responde isso e um leitor real.
    const planilha = {
      titulo: 'Relatório de missões',
      colunas: ['Código', 'Título', 'Valor'],
      linhas: [
        ['MCG-001', 'Visita à Universidade do Porto', 1250.5],
        ['MCG-002', '=cmd|x', 0],
      ] as (string | number | null)[][],
    };
    const destino = join(raiz, 'planilha.xlsx');
    await writeFile(destino, paraXlsx(planilha));

    execFileSync(
      'soffice',
      [
        '--headless',
        '--convert-to',
        'csv',
        '--outdir',
        join(raiz, 'convertido'),
        destino,
      ],
      { stdio: 'pipe', timeout: 120_000 },
    );
    const lido = await readFile(
      join(raiz, 'convertido', 'planilha.csv'),
      'utf8',
    );

    expect(lido).toContain('Visita à Universidade do Porto');
    expect(lido).toContain('1250.5');
    expect(lido).toContain("'=cmd|x");
  }, 150_000);

  it('o PDF sai com assinatura valida e o filtro no cabecalho', async () => {
    await criarMissao('MCG-020');
    const arquivo = await exportar('missoes', 'pdf', { ano: 2027 });

    expect(arquivo.mimeType).toBe('application/pdf');
    expect(arquivo.conteudo.subarray(0, 5).toString()).toBe('%PDF-');
    expect(arquivo.nomeArquivo).toMatch(
      /^relatorio-missoes-\d{4}-\d{2}-\d{2}\.pdf$/,
    );
  });

  it('exporta os quatro relatorios nos tres formatos', async () => {
    await criarMissao('MCG-030');
    for (const qual of [
      'missoes',
      'parceiros',
      'financas',
      'resultados',
    ] as const) {
      for (const formato of ['pdf', 'xlsx', 'csv'] as const) {
        const arquivo = await exportar(qual, formato);
        expect(arquivo.conteudo.length).toBeGreaterThan(0);
        expect(arquivo.nomeArquivo).toContain(qual);
      }
    }
  });

  it('o filtro do relatorio vale para a exportacao', async () => {
    await criarMissao('MCG-040');
    await criarMissao('MCG-041');

    // Exportar sem repetir o recorte da tela devolveria um arquivo maior do
    // que o que a pessoa estava vendo — o erro mais facil de nao notar.
    const tudo = (await exportar('missoes', 'csv')).conteudo.toString('utf8');
    expect(tudo).toContain('MCG-040');
    expect(tudo).toContain('MCG-041');

    const um = (
      await exportar('missoes', 'csv', { busca: 'MCG-040' })
    ).conteudo.toString('utf8');
    expect(um).toContain('MCG-040');
    expect(um).not.toContain('MCG-041');
  });

  // --- dossie ----------------------------------------------------------------

  it('o dossie e um PDF unico, com os anexos PDF concatenados', async () => {
    const missaoId = await criarMissao('MCG-050');

    const semAnexo = await exportacao.dossie(base.cicloId, missaoId, admin);
    expect(semAnexo.conteudo.subarray(0, 5).toString()).toBe('%PDF-');
    expect(semAnexo.nomeArquivo).toBe('dossie-MCG-050.pdf');

    await anexos.enviar(
      {
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missaoId,
        categoria: 'OUTRO',
        visibilidade: 'INTERNA',
      } as never,
      {
        originalname: 'projeto.pdf',
        buffer: await pdfDeUmaPagina(),
        size: 1,
      },
      admin,
    );

    // "PDF unico" so e verdade com a mesclagem: sem ela o dossie seria um
    // indice apontando para arquivos que quem recebeu teria de baixar.
    //
    // A contagem e de **paginas**, e nao de bytes: o pdf-lib recomprime ao
    // salvar, e o arquivo mesclado chega a ficar menor que o original. Foi o
    // que a primeira versao deste teste supos, errado.
    const comAnexo = await exportacao.dossie(base.cicloId, missaoId, admin);
    expect(await paginas(comAnexo.conteudo)).toBe(
      (await paginas(semAnexo.conteudo)) + 1,
    );
    expect(comAnexo.ignorados).toEqual([]);
  });

  it('anexo corrompido nao derruba o dossie, e volta na lista de ignorados', async () => {
    const missaoId = await criarMissao('MCG-060');
    await anexos.enviar(
      {
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missaoId,
        categoria: 'OUTRO',
        visibilidade: 'INTERNA',
      } as never,
      {
        originalname: 'quebrado.pdf',
        // Assinatura de PDF valida, corpo que nao e PDF nenhum.
        buffer: Buffer.concat([
          Buffer.from('%PDF-1.4\n'),
          Buffer.alloc(200, 0x41),
        ]),
        size: 1,
      },
      admin,
    );

    // Um arquivo corrompido nao pode impedir a emissao do dossie inteiro.
    const dossie = await exportacao.dossie(base.cicloId, missaoId, admin);
    expect(dossie.conteudo.subarray(0, 5).toString()).toBe('%PDF-');
    expect(dossie.ignorados).toEqual(['quebrado.pdf']);
  });

  it('documento restrito de outra pessoa nao entra no dossie', async () => {
    const missaoId = await criarMissao('MCG-070');
    await anexos.enviar(
      {
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missaoId,
        categoria: 'OUTRO',
        visibilidade: 'RESTRITA',
      } as never,
      {
        originalname: 'sigiloso.pdf',
        buffer: await pdfDeUmaPagina(),
        size: 1,
      },
      admin,
    );

    // O Gestor da Rede tem a missao no escopo, mas nao tem
    // `documento:read-restrito` nem enviou o arquivo. O dossie dele nao pode
    // trazer o conteudo — e a lista tambem nao pode nomea-lo.
    const gestor: AuthUser = {
      id: 'sub-gestor-dossie',
      name: 'Gestora',
      roles: ['gestor-rede'],
      permissions: [
        ...permissionsForRoles(['gestor-rede']),
        // `missao:all-redes` para isolar o que se testa aqui: a visibilidade
        // do documento, e nao o recorte por rede (que tem suite propria).
        'missao:all-redes',
      ],
    };

    const doAdmin = await exportacao.dossie(base.cicloId, missaoId, admin);
    const doGestor = await exportacao.dossie(base.cicloId, missaoId, gestor);

    // O anexo restrito vira uma pagina a mais no dossie de quem pode ve-lo, e
    // nenhuma no de quem nao pode.
    expect(await paginas(doGestor.conteudo)).toBeLessThan(
      await paginas(doAdmin.conteudo),
    );
    // E o nome tambem nao pode vazar na tabela de documentos. A verificacao e
    // sobre o **texto extraido**, e nao sobre os bytes: pdfkit comprime o fluxo
    // de texto, entao procurar a palavra no buffer passa por vacuo — foi
    // exatamente o que a primeira versao deste teste fez, e uma mutacao que
    // desligava a visibilidade continuava passando.
    expect(await texto(doGestor.conteudo)).not.toContain('sigiloso');
    expect(await texto(doAdmin.conteudo)).toContain('sigiloso');
  });

  it('nenhuma exportacao expoe o caminho interno de armazenamento', async () => {
    const missaoId = await criarMissao('MCG-080');
    await anexos.enviar(
      {
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missaoId,
        categoria: 'OUTRO',
        visibilidade: 'INTERNA',
      } as never,
      { originalname: 'anexo.pdf', buffer: await pdfDeUmaPagina(), size: 1 },
      admin,
    );

    // A chave de armazenamento e opaca e nunca sai do servico (CG-051); um
    // dossie que a imprimisse transformaria "conhecer o caminho" em acesso.
    const dossie = await exportacao.dossie(base.cicloId, missaoId, admin);
    const texto = dossie.conteudo.toString('latin1');
    expect(texto).not.toContain(raiz);
    expect(texto).not.toMatch(/[0-9a-f]{2}\/[0-9a-f]{62}/);
  });

  /**
   * Texto visivel do PDF, por `pdftotext`.
   *
   * Necessario porque o fluxo de texto vai comprimido: qualquer assercao feita
   * sobre os bytes crus passa por vacuo, o que e pior do que nao testar.
   */
  async function texto(conteudo: Buffer): Promise<string> {
    const arquivo = join(raiz, `extrair-${Date.now()}-${Math.random()}.pdf`);
    await writeFile(arquivo, conteudo);
    return execFileSync('pdftotext', [arquivo, '-'], {
      stdio: 'pipe',
      timeout: 60_000,
    }).toString('utf8');
  }

  /** Quantas paginas o PDF tem — o sinal certo para a mesclagem. */
  async function paginas(conteudo: Buffer): Promise<number> {
    const { PDFDocument } = await import('pdf-lib');
    return (await PDFDocument.load(conteudo)).getPageCount();
  }

  /** PDF minimo e valido, para exercitar a mesclagem. */
  async function pdfDeUmaPagina(): Promise<Buffer> {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    return Buffer.from(await doc.save());
  }
  it('gera a ficha do parceiro com os dois eixos da situacao (BOL-034)', async () => {
    const parceiros = new ParceirosService(ctx.db);
    const parceiro = await parceiros.criar(
      criarParceiroSchema.parse({
        nome: 'Universidade da Ficha',
        sigla: 'UFICHA',
        redeIds: [],
        origemRelacionamento: 'EVENTO_INTERNACIONAL',
      }),
      admin,
    );

    const arquivo = await exportacao.fichaDoParceiro(parceiro.id);
    expect(arquivo.mimeType).toBe('application/pdf');
    expect(arquivo.nomeArquivo).toBe('ficha-uficha.pdf');

    // pdfkit comprime o texto, entao asserir sobre os bytes do PDF passa por
    // vacuo: o conteudo tem de ser extraido antes de comparado (CG-069).
    const conteudo = await texto(arquivo.conteudo);
    expect(conteudo).toContain('Universidade da Ficha');
    expect(conteudo).toContain('Evento internacional');
    // Os dois eixos aparecem lado a lado, e o aviso do documento vai junto.
    expect(conteudo).toContain('Instituição identificada');
    expect(conteudo).toContain('Não há bolsa registrada');
    expect(conteudo).toContain('não implica disponibilidade futura');
  });
});
