import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { IdentidadeService } from '../src/auth/identidade.service';
import { RecorteDeMissoes } from '../src/auth/escopo';
import * as s from '../src/database/schema';
import { NotificacoesService } from '../src/dominio/notificacoes.service';
import { EncerramentoService } from '../src/dominio/encerramento.service';
import { MissoesComiteService } from '../src/dominio/missoes-comite.service';
import { SubmissaoService } from '../src/dominio/submissao.service';
import {
  criarContextoTeste,
  type ContextoTeste,
  type TestDatabase,
} from './db-teste';
import { criarAcesso, criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'sub-admin',
  name: 'Admin',
  roles: ['admin'],
  permissions: ['missao:submit', 'missao:edit'],
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

/** Gestor de rede que **e** o responsavel pela missao. */
const responsavel: AuthUser = {
  id: 'sub-responsavel',
  name: 'Ana Responsável',
  email: 'ana@propesp.local',
  roles: ['gestor-rede'],
  permissions: ['missao:submit'],
};

/** Gestor de rede que participa da missao, mas nao a responde. */
const outro: AuthUser = {
  id: 'sub-outro',
  name: 'Bruno Participante',
  email: 'bruno@propesp.local',
  roles: ['gestor-rede'],
  permissions: ['missao:submit'],
};

/**
 * Submissao para analise (CG-037).
 *
 * O que interessa aqui e o que o servico **recusa**: envio sem documento
 * obrigatorio, envio por quem nao e responsavel, envio duplicado e edicao de
 * missao ja sob analise. O caminho feliz e uma linha.
 */
describe('SubmissaoService (CG-037)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let identidade: IdentidadeService;
  let submissao: SubmissaoService;
  let missoes: MissoesComiteService;
  let missaoId: string;
  let pessoaResponsavelId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    identidade = new IdentidadeService(ctx.db);
    submissao = new SubmissaoService(ctx.db, identidade, semCanal(ctx.db));
    missoes = new MissoesComiteService(ctx.db, new EncerramentoService(ctx.db));
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    // A excecao ao "somente o responsavel" e o alcance global da acao, nao
    // o papel do token (V1-059).
    await criarAcesso(ctx.db, {
      sub: admin.id,
      permissoes: admin.permissions,
    });

    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MCG-800',
        titulo: 'Missão a submeter',
        objetivo: 'Testar submissão',
        dataInicio: '2027-06-01',
        dataFim: '2027-06-10',
        tipo: 'VISITA_TECNICA',
      })
      .returning({ id: s.missaoComite.id });
    missaoId = missao.id;

    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({
        nome: 'Ana Responsável',
        email: 'ana@propesp.local',
        tipo: 'SERVIDOR',
      })
      .returning({ id: s.pessoa.id });
    pessoaResponsavelId = pessoa.id;

    await ctx.db.insert(s.missaoParticipante).values({
      missaoId,
      pessoaId: pessoa.id,
      papel: 'RESPONSAVEL',
      dataInicio: '2027-06-01',
      dataFim: '2027-06-10',
    });

    // Requisitos como dado, nunca constante (decisao de 2026-09-05).
    await ctx.db.insert(s.requisitoSubmissao).values([
      {
        cicloId: base.cicloId,
        categoria: 'PROJETO',
        obrigatorio: true,
        descricao: 'Anexe o projeto da missão.',
      },
      {
        cicloId: base.cicloId,
        categoria: 'JUSTIFICATIVA',
        obrigatorio: true,
        descricao: 'Anexe a justificativa.',
      },
      { cicloId: base.cicloId, categoria: 'CONVITE', obrigatorio: false },
    ]);
  });

  const anexar = (categoria: 'PROJETO' | 'JUSTIFICATIVA' | 'CONVITE') =>
    ctx.db.insert(s.anexo).values({
      nome: `${categoria.toLowerCase()}.pdf`,
      mimeType: 'application/pdf',
      tamanho: 512,
      caminho: `chave/${categoria}`,
      categoria,
      entidadeTipo: 'MISSAO_COMITE',
      entidadeId: missaoId,
    });

  async function completarDocumentos() {
    await anexar('PROJETO');
    await anexar('JUSTIFICATIVA');
  }

  // -------------------------------------------------------------------------
  // Requisitos

  it('lista o que falta antes de tentar enviar', async () => {
    const avaliacao = await submissao.avaliar(base.cicloId, missaoId);

    expect(avaliacao.podeSubmeter).toBe(false);
    expect(avaliacao.pendencias).toEqual([
      'Anexe o projeto da missão.',
      'Anexe a justificativa.',
    ]);
    // O recomendado aparece no checklist, mas nao vira pendencia.
    expect(avaliacao.requisitos).toHaveLength(3);
    expect(avaliacao.requisitos.find((r) => r.categoria === 'CONVITE')).toEqual(
      expect.objectContaining({ obrigatorio: false, atendido: false }),
    );
  });

  it('recusa o envio com documento obrigatorio faltando, dizendo qual', async () => {
    await anexar('PROJETO');

    await expect(
      submissao.submeter(base.cicloId, missaoId, admin),
    ).rejects.toMatchObject({
      response: { pendencias: ['Anexe a justificativa.'] },
    });

    // Nada foi gravado: recusa nao pode deixar rodada meio aberta.
    expect(await ctx.db.select().from(s.rodadaAnalise)).toEqual([]);
  });

  it('documento inativo nao satisfaz requisito', async () => {
    await completarDocumentos();
    await ctx.db
      .update(s.anexo)
      .set({ ativo: false })
      .where(eq(s.anexo.categoria, 'PROJETO'));

    const avaliacao = await submissao.avaliar(base.cicloId, missaoId);
    expect(avaliacao.pendencias).toEqual(['Anexe o projeto da missão.']);
  });

  it('requisito de outro tipo de missao nao se aplica', async () => {
    await completarDocumentos();
    await ctx.db.insert(s.requisitoSubmissao).values({
      cicloId: base.cicloId,
      categoria: 'PROGRAMACAO',
      tipoMissao: 'EVENTO',
      obrigatorio: true,
      descricao: 'Programação do evento.',
    });

    // A missao e VISITA_TECNICA: a exigencia de EVENTO nao pode bloquea-la.
    const avaliacao = await submissao.avaliar(base.cicloId, missaoId);
    expect(avaliacao.podeSubmeter).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Autoria

  it('somente o responsavel envia; participante comum recebe 403', async () => {
    await completarDocumentos();
    await ctx.db.insert(s.pessoa).values({
      nome: 'Bruno Participante',
      email: 'bruno@propesp.local',
      tipo: 'SERVIDOR',
    });

    // A regra so e verificavel porque existe o vinculo `sub` -> `pessoa`.
    await expect(
      submissao.submeter(base.cicloId, missaoId, outro),
    ).rejects.toThrow(/somente o responsável/i);

    await expect(
      submissao.submeter(base.cicloId, missaoId, responsavel),
    ).resolves.toMatchObject({ numero: 1 });
  });

  it('papel admin no token sem concessao global nao abre a excecao', async () => {
    await completarDocumentos();
    await expect(
      submissao.submeter(base.cicloId, missaoId, {
        ...outro,
        id: 'sub-papel-admin',
        roles: ['admin'],
      }),
    ).rejects.toThrow('Somente o responsável');
  });

  it('admin envia mesmo sem ser responsavel', async () => {
    await completarDocumentos();

    // Sem esta excecao a PROPESP nao destravaria missao cujo responsavel saiu.
    await expect(
      submissao.submeter(base.cicloId, missaoId, admin),
    ).resolves.toMatchObject({ numero: 1 });
  });

  it('grava a pessoa de quem submeteu, e nao so o sub', async () => {
    await completarDocumentos();
    await submissao.submeter(base.cicloId, missaoId, responsavel);

    const [rodada] = await ctx.db.select().from(s.rodadaAnalise);
    expect(rodada.submetidoPorPessoaId).toBe(pessoaResponsavelId);
    expect(rodada.submetidoPorId).toBe('sub-responsavel');
  });

  // -------------------------------------------------------------------------
  // Estado

  it('coloca a missao em analise e registra auditoria', async () => {
    await completarDocumentos();
    await submissao.submeter(base.cicloId, missaoId, admin);

    const detalhe = await missoes.detalhe(base.cicloId, missaoId);
    expect(detalhe.statusAprovacao).toBe('EM_ANALISE');
    // A dimensao de execucao nao foi tocada.
    expect(detalhe.status).toBe('RASCUNHO');

    const auditoria = await ctx.db
      .select({ campo: s.registroAuditoria.campo })
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, missaoId));
    expect(auditoria.map((a) => a.campo)).toContain('statusAprovacao');
  });

  it('recusa enviar duas vezes', async () => {
    await completarDocumentos();
    await submissao.submeter(base.cicloId, missaoId, admin);

    await expect(
      submissao.submeter(base.cicloId, missaoId, admin),
    ).rejects.toThrow(/já está em análise/i);
  });

  it('missao em analise nao pode ser editada', async () => {
    await completarDocumentos();
    await submissao.submeter(base.cicloId, missaoId, admin);

    // Sem o congelamento, o Comite poderia aprovar um texto diferente do que
    // leu, e a decisao ficaria registrada sobre uma missao ja alterada.
    await expect(
      missoes.atualizar(
        base.cicloId,
        missaoId,
        { titulo: 'Título trocado durante a análise' } as never,
        admin,
        RecorteDeMissoes.irrestrito(),
      ),
    ).rejects.toThrow(/em análise não pode ser editada/i);
  });

  it('reenvio depois de ajustes cria rodada nova sem apagar a anterior', async () => {
    await completarDocumentos();
    const primeira = await submissao.submeter(base.cicloId, missaoId, admin);

    // O Comite devolve para ajustes (CG-038 fara isso; aqui e o efeito dela).
    await ctx.db.insert(s.decisaoComite).values({
      rodadaId: primeira.rodadaId,
      acao: 'SOLICITAR_AJUSTES',
      parecer: 'Detalhar o roteiro.',
    });
    await ctx.db
      .update(s.rodadaAnalise)
      .set({ encerradaEm: new Date() })
      .where(eq(s.rodadaAnalise.id, primeira.rodadaId));
    await ctx.db
      .update(s.missaoComite)
      .set({ statusAprovacao: 'AJUSTES_SOLICITADOS' })
      .where(eq(s.missaoComite.id, missaoId));

    const segunda = await submissao.submeter(base.cicloId, missaoId, admin);
    expect(segunda.numero).toBe(2);

    const rodadas = await ctx.db.select().from(s.rodadaAnalise);
    expect(rodadas).toHaveLength(2);
    const decisoes = await ctx.db.select().from(s.decisaoComite);
    expect(decisoes).toHaveLength(1);
  });

  it('missao aprovada nao volta a analise por reenvio', async () => {
    await completarDocumentos();
    await ctx.db
      .update(s.missaoComite)
      .set({ statusAprovacao: 'APROVADA' })
      .where(eq(s.missaoComite.id, missaoId));

    // Reabrir e ato do `admin` com justificativa (CG-038), nao um reenvio.
    await expect(
      submissao.submeter(base.cicloId, missaoId, admin),
    ).rejects.toThrow(/reabra a análise/i);
  });

  it('missao cancelada nao vai a analise', async () => {
    await completarDocumentos();
    await ctx.db
      .update(s.missaoComite)
      .set({ status: 'CANCELADA' })
      .where(eq(s.missaoComite.id, missaoId));

    await expect(
      submissao.submeter(base.cicloId, missaoId, admin),
    ).rejects.toThrow(/cancelada/i);
  });

  it('missao de outro ciclo nao e alcancada pela rota deste', async () => {
    await expect(
      submissao.submeter(
        '11111111-1111-4111-8111-111111111111',
        missaoId,
        admin,
      ),
    ).rejects.toThrow(/não encontrada/i);
  });
});
