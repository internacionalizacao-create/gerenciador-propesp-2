import { readFileSync } from 'node:fs';
import { criarContextoTeste } from './db-teste';
import { criarBase, bolsaValida, criarAcesso } from './fixtures';
import { semearAdministrador } from '../src/database/seed/admin';
import { carregarTiposEventoBolsista } from '../src/database/seed/tipos-evento-bolsista';
import * as s from '../src/database/schema';

async function main() {
  // Este programa so atende ao ambiente descartavel criado pelo runner.
  if (
    process.env.TEST_DATABASE_URL !==
    'postgresql://e2e:e2e@127.0.0.1:35459/gerenciador_test'
  ) {
    throw new Error('Seed E2E recusada fora do ambiente descartável.');
  }
  const usuarios = JSON.parse(
    readFileSync('../../.e2e/usuarios.json', 'utf8'),
  ) as { id: string; username: string }[];
  const ctx = await criarContextoTeste();
  try {
    await ctx.limpar();
    // O truncate leva os tipos de evento externo junto (V1-036).
    await carregarTiposEventoBolsista(ctx.db);
    const base = await criarBase(ctx.db);
    const admin = await semearAdministrador(
      ctx.db,
      usuarios[0].id,
      'admin@example.invalid',
      'Teste admin',
    );
    const leitor = await criarAcesso(ctx.db, {
      sub: usuarios[1].id,
      nome: 'Teste leitor',
      permissoes: ['ppg:read'],
    });
    const semAcesso = await criarAcesso(ctx.db, {
      sub: usuarios[2].id,
      nome: 'Teste sem acesso',
      permissoes: [],
    });
    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ nome: 'Brasil', codigoIso2: 'BR', codigoIso3: 'BRA' })
      .returning();
    await ctx.db.insert(s.participacaoPpg).values({
      areaTematicaId: base.areaTematicaId,
      ppgId: base.ppgId,
      coordenadorTematicaId: base.coordenadorTematicaId,
    });
    // A pagina da tematica so existe com orcamento cadastrado, como na base real.
    await ctx.db.insert(s.orcamentoTematica).values(
      [2027, 2028, 2029, 2030].map((ano) => ({
        areaTematicaId: base.areaTematicaId,
        ano,
        valorBolsas: '500000.00',
        valorManutencao: '0',
        valorMissoes: '0',
        status: 'DEFINIDO' as const,
      })),
    );
    // Segundo PPG da mesma tematica: a movimentacao precisa de dois lados.
    const [ppgVizinho] = await ctx.db
      .insert(s.ppg)
      .values({ nome: 'PPG Vizinho de Teste', sigla: 'PPGVIZ' })
      .returning();
    await ctx.db.insert(s.participacaoPpg).values({
      areaTematicaId: base.areaTematicaId,
      ppgId: ppgVizinho.id,
      coordenadorTematicaId: base.coordenadorTematicaId,
    });
    // PPG sem participacao, para a jornada de associar pela tela (V1-034).
    const [ppgAvulso] = await ctx.db
      .insert(s.ppg)
      .values({ nome: 'PPG Avulso de Teste', sigla: 'PPGAVU' })
      .returning();
    await ctx.db.insert(s.membroEquipeGestao).values({
      cicloId: base.cicloId,
      pessoaId: base.coordenadorTematicaId,
      tipoEquipe: 'COMITE_GESTOR',
      funcao: 'Representante de teste',
      dataInicio: '2025-01-01',
    });
    await ctx.db.insert(s.orcamentoComiteGestor).values({
      cicloId: base.cicloId,
      instituicaoId: base.instituicaoId,
      ano: 2027,
      valorAnual: '100000',
    });
    await ctx.db.insert(s.requisitoSubmissao).values([
      { cicloId: base.cicloId, categoria: 'PROJETO' },
      { cicloId: base.cicloId, categoria: 'JUSTIFICATIVA' },
    ]);
    const [linha] = await ctx.db
      .insert(s.itemPlanejado)
      .values(bolsaValida(base))
      .returning();
    await ctx.db
      .insert(s.planejamentoAnual)
      .values({ itemPlanejadoId: linha.id, ano: 2027, quantidade: 1 });
    console.log(
      JSON.stringify({
        ...base,
        paisId: pais.id,
        linhaId: linha.id,
        ppgVizinhoId: ppgVizinho.id,
        ppgAvulsoId: ppgAvulso.id,
        admin,
        leitor,
        semAcesso,
      }),
    );
  } finally {
    await ctx.encerrar();
  }
}
void main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
