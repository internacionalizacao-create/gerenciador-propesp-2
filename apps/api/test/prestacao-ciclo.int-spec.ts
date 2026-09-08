import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { IdentidadeService } from '../src/auth/identidade.service';
import * as s from '../src/database/schema';
import { NotificacoesService } from '../src/dominio/notificacoes.service';
import { PrestacaoService } from '../src/dominio/prestacao.service';
import {
  criarContextoTeste,
  type ContextoTeste,
  type TestDatabase,
} from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-ciclo',
  name: 'Admin da Prestação',
  roles: ['admin'],
  permissions: ['prestacao:read', 'prestacao:write', 'prestacao:review'],
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
 * Envio, validacao e devolucao da prestacao (CG-054).
 *
 * O criterio de aceite da task e negativo: **somente `VALIDADA` produz
 * execucao oficial do orcamento**. Traduzido para o que se testa aqui — nenhum
 * outro caminho chega a `VALIDADA`, e a validada nao aceita mais alteracao.
 */
describe('Ciclo de vida da prestacao (CG-054)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: PrestacaoService;
  let missaoId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new PrestacaoService(ctx.db, semCanal(ctx.db));
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MCG-950',
        titulo: 'Missão com prestação',
        objetivo: 'Testar o ciclo de vida da prestação',
        dataInicio: '2027-09-01',
        dataFim: '2027-09-05',
      })
      .returning({ id: s.missaoComite.id });
    missaoId = missao.id;
  });

  const despesa = () =>
    ({
      tipo: 'OUTRA',
      exercicio: 2027,
      valorTotal: '500.00',
      descricao: 'Inscrição em evento',
    }) as never;

  /** Prestacao com uma despesa, pronta para ser enviada. */
  async function comDespesa() {
    await service.criar(base.cicloId, missaoId, admin);
    return service.criarDespesa(base.cicloId, missaoId, despesa(), admin);
  }

  async function enviada() {
    await comDespesa();
    return service.enviar(base.cicloId, missaoId, admin);
  }

  // -------------------------------------------------------------------------
  // Envio

  it('recusa enviar prestacao sem nenhuma despesa', async () => {
    await service.criar(base.cicloId, missaoId, admin);

    // Prestacao sem despesa tem total **nulo**, nao zero (CG-050): enviar isso
    // pediria ao revisor que validasse a ausencia de informacao.
    await expect(service.enviar(base.cicloId, missaoId, admin)).rejects.toThrow(
      /ao menos uma despesa/i,
    );
  });

  it('envia e grava a data no fuso institucional', async () => {
    const resultado = await enviada();

    expect(resultado.status).toBe('ENVIADA');
    expect(resultado.enviadaEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(resultado.enviadaPor).toBe('Admin da Prestação');
  });

  it('prestacao enviada nao aceita lancamento', async () => {
    await enviada();

    // Sem isto o revisor validaria um valor diferente do que leu.
    await expect(
      service.criarDespesa(base.cicloId, missaoId, despesa(), admin),
    ).rejects.toThrow(/em analise nao aceita alteracao/i);
  });

  it('recusa enviar duas vezes', async () => {
    await enviada();
    await expect(service.enviar(base.cicloId, missaoId, admin)).rejects.toThrow(
      /em analise nao aceita alteracao/i,
    );
  });

  // -------------------------------------------------------------------------
  // Validacao

  it('valida a prestacao enviada e registra quem e quando', async () => {
    await enviada();
    const validada = await service.validar(
      base.cicloId,
      missaoId,
      { parecer: 'Documentação conferida.' },
      admin,
    );

    expect(validada.status).toBe('VALIDADA');
    expect(validada.validadaEm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(validada.validadaPor).toBe('Admin da Prestação');
    expect(validada.parecer).toBe('Documentação conferida.');
  });

  it('nao valida prestacao que nunca foi enviada', async () => {
    await comDespesa();

    // Validar direto do preenchimento pularia a revisao inteira — e e a
    // validacao que abate o aporte.
    await expect(
      service.validar(base.cicloId, missaoId, {}, admin),
    ).rejects.toThrow(/somente prestacao enviada/i);
  });

  it('nao valida prestacao devolvida sem novo envio', async () => {
    await enviada();
    await service.devolver(
      base.cicloId,
      missaoId,
      { parecer: 'Falta o comprovante.' },
      admin,
    );

    await expect(
      service.validar(base.cicloId, missaoId, {}, admin),
    ).rejects.toThrow(/somente prestacao enviada/i);
  });

  it('prestacao validada congela em definitivo', async () => {
    await enviada();
    await service.validar(base.cicloId, missaoId, {}, admin);

    // Alterar despesa depois mudaria o saldo do aporte sem passar por revisao.
    await expect(
      service.criarDespesa(base.cicloId, missaoId, despesa(), admin),
    ).rejects.toThrow(/validada nao aceita alteracao/i);
    await expect(
      service.devolver(base.cicloId, missaoId, { parecer: 'Mudei' }, admin),
    ).rejects.toThrow(/ja foi validada/i);
    await expect(
      service.validar(base.cicloId, missaoId, {}, admin),
    ).rejects.toThrow(/ja foi validada/i);
  });

  // -------------------------------------------------------------------------
  // Devolucao e reenvio

  it('devolver reabre a edicao e guarda a pendencia', async () => {
    await enviada();
    const devolvida = await service.devolver(
      base.cicloId,
      missaoId,
      { parecer: 'Falta o comprovante da inscrição.' },
      admin,
    );

    expect(devolvida.status).toBe('COM_PENDENCIA');
    expect(devolvida.parecer).toBe('Falta o comprovante da inscrição.');

    // Devolver sem reabrir a edicao deixaria o responsavel sem como atender.
    const corrigida = await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa(),
      admin,
    );
    expect(corrigida.despesas).toHaveLength(2);
  });

  it('o reenvio limpa o parecer da devolucao', async () => {
    await enviada();
    await service.devolver(
      base.cicloId,
      missaoId,
      { parecer: 'Falta o comprovante.' },
      admin,
    );

    const reenviada = await service.enviar(base.cicloId, missaoId, admin);

    // Manter o parecer faria a tela mostrar uma pendencia ja corrigida ao lado
    // do envio novo.
    expect(reenviada.status).toBe('ENVIADA');
    expect(reenviada.parecer).toBeNull();
  });

  it('o vaivem completo fica na auditoria, em ordem', async () => {
    await enviada();
    await service.devolver(
      base.cicloId,
      missaoId,
      { parecer: 'Falta comprovante.' },
      admin,
    );
    await service.enviar(base.cicloId, missaoId, admin);
    await service.validar(base.cicloId, missaoId, { parecer: 'Ok.' }, admin);

    const [prestacao] = await ctx.db
      .select({ id: s.prestacaoContasMissao.id })
      .from(s.prestacaoContasMissao)
      .where(eq(s.prestacaoContasMissao.missaoId, missaoId));

    const trilha = await ctx.db
      .select({
        acao: s.registroAuditoria.acao,
        anterior: s.registroAuditoria.valorAnterior,
        novo: s.registroAuditoria.valorNovo,
      })
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, prestacao.id))
      .orderBy(s.registroAuditoria.ocorridoEm);

    // A prestacao nao tem rodada numerada como a analise da missao: e a trilha
    // que conta o vaivem, e por isso ela precisa estar completa.
    expect(
      trilha.filter((linha) => linha.acao === 'EDICAO').map((l) => l.novo),
    ).toEqual(['ENVIADA', 'COM_PENDENCIA', 'ENVIADA', 'VALIDADA']);
    expect(trilha[0].acao).toBe('CRIACAO');
  });

  it('nao alcanca prestacao de outro ciclo', async () => {
    await enviada();
    await expect(
      service.enviar('11111111-1111-4111-8111-111111111111', missaoId, admin),
    ).rejects.toThrow(/nao encontrada/i);
  });
});
