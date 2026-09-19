import { eq, sql } from 'drizzle-orm';

import { AcessoV1Service } from '../src/auth/autorizacao-v1/acesso-v1.service';
import {
  administradoresRecuperaveis,
  executarBootstrap,
} from '../src/auth/autorizacao-v1/bootstrap';
import {
  DesativacaoRecusada,
  executarDesativacao,
} from '../src/auth/autorizacao-v1/desativacao';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import * as s from '../src/database/schema';
import { criarContextoTeste, type ContextoTeste } from './db-teste';

/**
 * V1-021e — ensaio de ativacao e rollback, com contas ficticias.
 *
 * A ficha pede "ensaio com contas ficticias e smoke nominal autorizado apos
 * ativacao". O smoke nominal depende do ambiente institucional e da lista de
 * pessoas do responsavel; **o ensaio nao depende de nenhum dos dois**, e e ele
 * que responde a pergunta que importa antes de ligar qualquer coisa: se der
 * errado, da para voltar?
 *
 * O roteiro ensaiado e o do runbook (`docs/ativacao-acesso-v1.md`):
 *
 *   1. instalacao nova nao tem administrador nenhum;
 *   2. o bootstrap cria o primeiro, e so ele;
 *   3. as contas de demonstracao saem **depois** do definitivo, nunca antes;
 *   4. perdido o administrador, a recuperacao devolve o acesso;
 *   5. o rollback **preserva a restricao** — nunca reabre leitura global.
 */

const OPERADOR = 'cli:ensaio@teste';

describe('V1-021e: ensaio de ativacao, desativacao e rollback', () => {
  let ctx: ContextoTeste;
  let resolver: AcessoV1Service;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    resolver = new AcessoV1Service(ctx.db);
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
  });

  /** Conta local ativa, como o primeiro login a criaria. */
  async function conta(sub: string, nome: string, email: string) {
    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome, email, tipo: 'SERVIDOR' })
      .returning({ id: s.pessoa.id });
    const [linha] = await ctx.db
      .insert(s.usuarioSistema)
      .values({ sub, pessoaId: pessoa.id, email, origem: 'MANUAL' })
      .returning({ id: s.usuarioSistema.id });
    return linha.id;
  }

  const bootstrap = (sub: string, modo: 'BOOTSTRAP' | 'RECUPERACAO') =>
    executarBootstrap(ctx.db, {
      sub,
      motivo: 'Ensaio de ativação.',
      modo,
      aplicar: true,
      operador: OPERADOR,
    });

  const desativar = (subs: string[], opcoes: { reativar?: boolean } = {}) =>
    executarDesativacao(ctx.db, {
      subs,
      motivo: 'Ensaio de ativação.',
      aplicar: true,
      operador: OPERADOR,
      ...opcoes,
    });

  // --------------------------------------------------------- o dia um --

  it('instalacao nova nao tem administrador, e o bootstrap cria exatamente um', async () => {
    await conta('sub-adm', 'Administradora', 'adm@propesp.local');
    expect(await administradoresRecuperaveis(ctx.db)).toEqual([]);

    await bootstrap('sub-adm', 'BOOTSTRAP');

    expect(await administradoresRecuperaveis(ctx.db)).toEqual([
      'adm@propesp.local',
    ]);
    // E **so** gestao de acesso: o administrador do bootstrap nao ganha o
    // plano e as bolsas de brinde.
    const acesso = await resolver.resolver('sub-adm');
    expect(acesso.permissoes).toEqual([
      'acesso:delegate',
      'acesso:manage-identidade',
      'acesso:read',
      'acesso:write',
    ]);
  });

  // ------------------------------------ retirar a demonstracao, na ordem --

  it('recusa desativar a conta que ainda e o unico administrador', async () => {
    await conta('sub-demo', 'Conta de demonstração', 'demo@propesp.local');
    await bootstrap('sub-demo', 'BOOTSTRAP');

    // A ordem inversa e o erro classico da implantacao: desliga-se a conta
    // provisoria antes de configurar a definitiva, e ninguem mais entra.
    await expect(desativar(['sub-demo'])).rejects.toBeInstanceOf(
      DesativacaoRecusada,
    );
    const [linha] = await ctx.db
      .select({ ativo: s.usuarioSistema.ativo })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.sub, 'sub-demo'));
    expect(linha.ativo).toBe(true);
  });

  it('com o definitivo configurado, a demonstracao sai', async () => {
    await conta('sub-demo', 'Conta de demonstração', 'demo@propesp.local');
    await conta('sub-adm', 'Administradora', 'adm@propesp.local');
    await bootstrap('sub-demo', 'BOOTSTRAP');
    // O segundo vem por recuperacao: o bootstrap recusa quando ja ha um.
    await bootstrap('sub-adm', 'RECUPERACAO');

    const previa = await desativar(['sub-demo']);
    expect(previa.itens[0].efeito).toBe('DESATIVAR');
    expect(previa.administradoresRestantes).toEqual(['adm@propesp.local']);

    // Conta desativada fecha tudo de uma vez, `acesso:*` incluido — senao
    // quem administra acesso se reativaria sozinho.
    const acesso = await resolver.resolver('sub-demo');
    expect(acesso.ativo).toBe(false);
    expect(acesso.permissoes).toEqual([]);
  });

  it('desativar preserva as concessoes, e reativar devolve o acesso intacto', async () => {
    const id = await conta('sub-op', 'Operadora', 'op@propesp.local');
    await conta('sub-adm', 'Administradora', 'adm@propesp.local');
    await bootstrap('sub-adm', 'BOOTSTRAP');
    await ctx.db.insert(s.concessaoAcesso).values({
      usuarioId: id,
      permissao: 'plano:read',
      justificativa: 'Ensaio.',
      ...colunasDoAlvo({ tipo: 'GLOBAL' }),
    });

    await desativar(['sub-op']);
    expect((await resolver.resolver('sub-op')).permissoes).toEqual([]);

    // As linhas continuam la: revoga-las apagaria a configuracao que a
    // reativacao precisa devolver, e reconstrui-la a mao e onde se erra.
    const guardadas = await ctx.db
      .select({ ativo: s.concessaoAcesso.ativo })
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.usuarioId, id));
    expect(guardadas).toEqual([{ ativo: true }]);

    await desativar(['sub-op'], { reativar: true });
    expect((await resolver.resolver('sub-op')).permissoes).toEqual([
      'plano:read',
    ]);
  });

  it('lote com um sub errado nao desativa nenhum dos outros', async () => {
    await conta('sub-a', 'Conta A', 'a@propesp.local');
    await conta('sub-adm', 'Administradora', 'adm@propesp.local');
    await bootstrap('sub-adm', 'BOOTSTRAP');

    await expect(desativar(['sub-a', 'sub-inexistente'])).rejects.toThrow(
      /Sem conta local/,
    );
    const [linha] = await ctx.db
      .select({ ativo: s.usuarioSistema.ativo })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.sub, 'sub-a'));
    expect(linha.ativo).toBe(true);
  });

  // ------------------------------------------------- perder e recuperar --

  it('administrador perdido volta pela recuperacao, e nao por reabrir o sistema', async () => {
    await conta('sub-adm', 'Administradora', 'adm@propesp.local');
    await conta('sub-nova', 'Nova administradora', 'nova@propesp.local');
    await bootstrap('sub-adm', 'BOOTSTRAP');

    // A pessoa saiu da instituicao: as concessoes dela sao revogadas.
    await ctx.db
      .update(s.concessaoAcesso)
      .set({ ativo: false, revogadoEm: sql`now()` });
    expect(await administradoresRecuperaveis(ctx.db)).toEqual([]);

    // Sem administrador, o bootstrap volta a ser o caminho — e **nao** existe
    // um "modo aberto" enquanto se resolve: o sistema segue fechado.
    const semNinguem = await resolver.resolver('sub-nova');
    expect(semNinguem.permissoes).toEqual([]);

    await bootstrap('sub-nova', 'BOOTSTRAP');
    expect(await administradoresRecuperaveis(ctx.db)).toEqual([
      'nova@propesp.local',
    ]);
  });

  it('recuperacao nao reativa conta desativada', async () => {
    await conta('sub-demo', 'Conta de demonstração', 'demo@propesp.local');
    await conta('sub-adm', 'Administradora', 'adm@propesp.local');
    await bootstrap('sub-demo', 'BOOTSTRAP');
    await bootstrap('sub-adm', 'RECUPERACAO');
    await desativar(['sub-demo']);

    // Se a recuperacao reativasse, desativar uma conta seria sugestao: bastaria
    // rodar o outro comando para desfaze-la sem que ninguem decidisse isso.
    await expect(bootstrap('sub-demo', 'RECUPERACAO')).rejects.toThrow(
      /inativa/i,
    );
  });

  // ------------------------------------------------------- o rollback --

  it('o rollback preserva a restricao: volta o acesso de quem devia ter, nao de todos', async () => {
    const operadora = await conta('sub-op', 'Operadora', 'op@propesp.local');
    await conta('sub-adm', 'Administradora', 'adm@propesp.local');
    await conta('sub-terceira', 'Terceira', 'terceira@propesp.local');
    await bootstrap('sub-adm', 'BOOTSTRAP');
    await ctx.db.insert(s.concessaoAcesso).values({
      usuarioId: operadora,
      permissao: 'plano:read',
      justificativa: 'Ensaio.',
      ...colunasDoAlvo({ tipo: 'GLOBAL' }),
    });

    // Cenario: alguem revoga demais durante a ativacao e a equipe para.
    await ctx.db
      .update(s.concessaoAcesso)
      .set({ ativo: false, revogadoEm: sql`now()` })
      .where(eq(s.concessaoAcesso.usuarioId, operadora));
    expect((await resolver.resolver('sub-op')).permissoes).toEqual([]);

    // O rollback e reconceder a quem devia ter — **nao** existe chave que
    // reabra a leitura para todos, e a ausencia dessa chave e o desenho: o
    // modo permissivo saiu na V1-012 e nao voltou.
    //
    // E reconceder **reativa a linha**, nao cria outra: os indices de
    // unicidade cobrem a linha inativa de proposito, para a consulta de acesso
    // nunca ter de escolher entre versoes da mesma concessao. Quem quiser a
    // historia do vaivem le `registro_auditoria`.
    await ctx.db
      .update(s.concessaoAcesso)
      .set({ ativo: true, revogadoEm: null, justificativa: 'Rollback.' })
      .where(eq(s.concessaoAcesso.usuarioId, operadora));

    expect((await resolver.resolver('sub-op')).permissoes).toEqual([
      'plano:read',
    ]);
    const linhas = await ctx.db
      .select({ id: s.concessaoAcesso.id })
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.usuarioId, operadora));
    expect(linhas).toHaveLength(1);
    // E a terceira conta, que nunca teve nada, continua sem nada depois do
    // rollback: voltar atras nao pode ser mais permissivo do que o comeco.
    expect((await resolver.resolver('sub-terceira')).permissoes).toEqual([]);
  });
});
