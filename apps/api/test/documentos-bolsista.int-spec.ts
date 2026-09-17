import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AuthUser } from '../src/auth/auth-user';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import { IdentidadeService } from '../src/auth/identidade.service';
import {
  copiarModelo,
  type ModeloAcessoV1,
} from '../src/auth/autorizacao-v1/modelos';
import { ArmazenamentoService } from '../src/arquivos/armazenamento.service';
import * as s from '../src/database/schema';
import {
  AnexosService,
  type ArquivoRecebido,
} from '../src/dominio/anexos.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarAcesso, criarBase, type BaseFixture } from './fixtures';

/**
 * Montados a partir dos modelos da V1, e nao a mao: uma lista escrita
 * aqui continuaria passando no dia em que o mapa de permissoes mudasse, e e
 * exatamente essa mudanca que estes casos precisam acompanhar.
 */
const comoModelo = (id: string, modelo: ModeloAcessoV1): AuthUser => ({
  id,
  name: `Usuario ${modelo}`,
  roles: [],
  permissions: copiarModelo(modelo).permissoes,
});

const admin = comoModelo('admin-bol', 'administrador');
const secretaria = comoModelo('secretaria-bol', 'secretaria');
const comite = comoModelo('comite-bol', 'comite-gestor');
const coordenador = comoModelo('coord-bol', 'responsavel-ppg');

const bytes = (hex: string, sobra = 64) =>
  Buffer.concat([Buffer.from(hex, 'hex'), Buffer.alloc(sobra, 0x41)]);

const PDF = (nome = 'documento.pdf'): ArquivoRecebido => {
  const conteudo = bytes('255044462d312e34');
  return { originalname: nome, buffer: conteudo, size: conteudo.length };
};

/**
 * Documentos do bolsista (BOL-021).
 *
 * O que se trava aqui e a decisao de 2026-09-09: a **categoria** decide a
 * visibilidade, `PESSOAL` e `RESTRITA` sao publicos diferentes e nao niveis, e
 * o documento herda o recorte por PPG da BOL-020 em vez de virar a porta
 * lateral dele.
 */
describe('Documentos do bolsista (BOL-021)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: AnexosService;
  let identidade: IdentidadeService;
  let bolsaId: string;
  let bolsaDeForaId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    process.env.ARQUIVOS_DIR = await mkdtemp(join(tmpdir(), 'bol021-'));
    identidade = new IdentidadeService(ctx.db);
    service = new AnexosService(ctx.db, new ArmazenamentoService(), identidade);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);

    // Admin, secretaria e Comite enxergam tudo por concessao GLOBAL; a
    // coordenacao nasce sem alcance, e o caso do recorte concede o PPG.
    for (const conta of [admin, secretaria, comite]) {
      await criarAcesso(ctx.db, {
        sub: conta.id,
        nome: conta.name,
        permissoes: conta.permissions,
      });
    }
    // A coordenacao alcanca **um** PPG, o da fixture: e o que torna visivel o
    // recorte quando ela tenta o documento da bolsa de outro PPG.
    await criarAcesso(ctx.db, {
      sub: coordenador.id,
      nome: coordenador.name,
      permissoes: coordenador.permissions,
      alvo: colunasDoAlvo({
        tipo: 'PPG',
        ppgId: base.ppgId,
        cicloId: base.cicloId,
      }),
    });

    const concessao = async (nome: string, cpf: string, ppgId: string) => {
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

    bolsaId = await concessao('Bolsista Um', '52998224725', base.ppgId);

    const [outroPpg] = await ctx.db
      .insert(s.ppg)
      .values({ nome: 'PPG Alheio', sigla: 'PPGALHEIO', situacao: 'ATIVO' })
      .returning({ id: s.ppg.id });
    bolsaDeForaId = await concessao(
      'Bolsista Dois',
      '11144477735',
      outroPpg.id,
    );
  });

  const enviar = (
    categoria: 'CARTA_ACEITE' | 'PASSAPORTE' | 'DOCUMENTO_IDENTIDADE',
    usuario: AuthUser = admin,
    entidadeId = bolsaId,
    visibilidade: 'INTERNA' | 'RESTRITA' | 'PESSOAL' = 'INTERNA',
  ) =>
    service.enviar(
      {
        entidadeTipo: 'BOLSA_CONCEDIDA',
        entidadeId,
        categoria,
        visibilidade,
      },
      PDF(),
      usuario,
    );

  // -------------------------------------------------------------------------

  it('documento academico fica INTERNA e segue o recorte da bolsa', async () => {
    const anexo = await enviar('CARTA_ACEITE');
    expect(anexo.visibilidade).toBe('INTERNA');

    // O coordenador acompanha o proprio orientando: e o motivo de a carta de
    // aceite nao ser pessoal.
    const vistos = await service.listar(
      {
        entidadeTipo: 'BOLSA_CONCEDIDA',
        entidadeId: bolsaId,
        incluirInativos: false,
      },
      coordenador,
    );
    expect(vistos.map((item) => item.id)).toContain(anexo.id);
  });

  it('documento pessoal nasce PESSOAL mesmo se o cliente pedir INTERNA', async () => {
    // O cliente manda `INTERNA`; a categoria decide, e o servico sobrescreve.
    // Sem isto, bastaria um cliente escrito errado para publicar o passaporte.
    const anexo = await enviar('PASSAPORTE', admin, bolsaId, 'INTERNA');
    expect(anexo.visibilidade).toBe('PESSOAL');
  });

  it('PESSOAL e RESTRITA sao publicos diferentes, nao niveis', async () => {
    const pessoal = await enviar('DOCUMENTO_IDENTIDADE');

    const veem = async (usuario: AuthUser) => {
      const lista = await service.listar(
        {
          entidadeTipo: 'BOLSA_CONCEDIDA',
          entidadeId: bolsaId,
          incluirInativos: false,
        },
        usuario,
      );
      return lista.some((item) => item.id === pessoal.id);
    };

    // Secretaria instrui o processo na CAPES: abre.
    expect(await veem(secretaria)).toBe(true);
    expect(await veem(admin)).toBe(true);

    // O Comite Gestor tem `documento:read-restrito` e **nao** abre documento
    // pessoal de bolsista: o escopo dele e a missao institucional.
    expect(comite.permissions).toContain('documento:read-restrito');
    expect(comite.permissions).not.toContain('documento:read-pessoal');
    expect(await veem(comite)).toBe(false);

    // O coordenador alcanca a bolsa e ainda assim nao ve o documento pessoal.
    expect(await veem(coordenador)).toBe(false);
  });

  it('a retencao conta do fim da concessao, e so vale para o pessoal', async () => {
    const academico = await enviar('CARTA_ACEITE');
    const pessoal = await enviar('PASSAPORTE');

    const lista = await service.listar(
      {
        entidadeTipo: 'BOLSA_CONCEDIDA',
        entidadeId: bolsaId,
        incluirInativos: false,
      },
      admin,
    );
    const achar = (id: string) => lista.find((item) => item.id === id);

    // A bolsa termina em 2027-08-31; a guarda vai ate cinco anos depois. O
    // relogio comeca quando a finalidade se encerra, nao no upload.
    expect(achar(pessoal.id)?.retencaoAte).toBe('2032-08-31');
    // Documento academico nao tem prazo de guarda de dado pessoal.
    expect(achar(academico.id)?.retencaoAte).toBeUndefined();
  });

  it('quem nao abre documento pessoal tambem nao envia', async () => {
    // Simetria homologada em 2026-09-09: sem ela o coordenador coletava
    // passaporte de aluno que so ele proprio reabriria depois.
    expect(coordenador.permissions).toContain('bolsa:create');
    await expect(enviar('PASSAPORTE', coordenador)).rejects.toThrow(
      'documento:read-pessoal',
    );

    // A secretaria envia, porque e ela quem instrui o processo na CAPES.
    const anexo = await enviar('PASSAPORTE', secretaria);
    expect(anexo.visibilidade).toBe('PESSOAL');

    // E o academico continua liberado para o coordenador.
    const academico = await enviar('CARTA_ACEITE', coordenador);
    expect(academico.visibilidade).toBe('INTERNA');
  });

  it('recusa categoria que nao pertence a bolsista', async () => {
    await expect(
      service.enviar(
        {
          entidadeTipo: 'BOLSA_CONCEDIDA',
          entidadeId: bolsaId,
          categoria: 'NOTA_FISCAL',
          visibilidade: 'INTERNA',
        },
        PDF(),
        admin,
      ),
    ).rejects.toThrow('não é aceita em documento de bolsista');
  });

  it('PESSOAL nao vale fora de bolsista', async () => {
    // Marcar assim um comprovante de missao o esconderia de quem precisa
    // conferir a prestacao.
    await expect(
      service.enviar(
        {
          entidadeTipo: 'INSTITUICAO',
          entidadeId: base.instituicaoId,
          categoria: 'DECLARACAO',
          visibilidade: 'PESSOAL',
        },
        PDF(),
        admin,
      ),
    ).rejects.toThrow('vale apenas para documento de bolsista');
  });

  it('o documento nao contorna o recorte por PPG da BOL-020', async () => {
    // A coordenacao ja alcanca o PPG da fixture (ver `beforeEach`), e so ele.

    // Conhecer o UUID da bolsa alheia nao basta — nem para ler, nem para subir.
    await expect(
      enviar('CARTA_ACEITE', coordenador, bolsaDeForaId),
    ).rejects.toThrow('Documento não encontrado.');

    await expect(
      service.listar(
        {
          entidadeTipo: 'BOLSA_CONCEDIDA',
          entidadeId: bolsaDeForaId,
          incluirInativos: false,
        },
        coordenador,
      ),
    ).rejects.toThrow('Documento não encontrado.');
  });
  it('a decisao do Comite aceita somente ata (BOL-052)', async () => {
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MCG-ATA',
        titulo: 'Missão com ata',
        objetivo: 'Testar a ata',
        dataInicio: '2027-04-01',
        dataFim: '2027-04-05',
      })
      .returning({ id: s.missaoComite.id });
    const [rodada] = await ctx.db
      .insert(s.rodadaAnalise)
      // As duas datas explicitas: `submetido_em` tem default `now()`, e o check
      // exige `encerrada_em >= submetido_em` — um `new Date()` avaliado antes do
      // insert cai do lado errado da desigualdade.
      .values({
        missaoId: missao.id,
        numero: 1,
        submetidoEm: new Date('2027-03-01T12:00:00Z'),
        encerradaEm: new Date('2027-03-20T12:00:00Z'),
      })
      .returning({ id: s.rodadaAnalise.id });
    const [decisao] = await ctx.db
      .insert(s.decisaoComite)
      .values({
        rodadaId: rodada.id,
        acao: 'APROVAR',
        parecer: 'Aprovada na reunião semanal.',
        reuniaoData: '2027-03-20',
      })
      .returning({ id: s.decisaoComite.id });

    const anexarComCategoria = (categoria: 'ATA' | 'PROJETO') =>
      service.enviar(
        {
          entidadeTipo: 'DECISAO_COMITE',
          entidadeId: decisao.id,
          categoria,
          visibilidade: 'INTERNA',
        },
        PDF(),
        admin,
      );

    // Outra categoria confundiria o comprovante da deliberação com os
    // documentos analisados, que se prendem à missão e não à decisão.
    await expect(anexarComCategoria('PROJETO')).rejects.toThrow(
      'apenas documento da categoria ATA',
    );

    const ata = await anexarComCategoria('ATA');
    expect(ata.categoria).toBe('ATA');
    expect(ata.entidadeTipo).toBe('DECISAO_COMITE');
  });
});
