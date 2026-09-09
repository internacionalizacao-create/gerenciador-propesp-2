import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import * as s from '../src/database/schema';
import { executarSeed } from '../src/database/seed/seed';
import { CatalogoService } from '../src/dominio/catalogo.service';
import { ContextoService } from '../src/dominio/contexto.service';
import { PlanoService } from '../src/dominio/plano.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';

const ADMIN: AuthUser = {
  id: 'sub-admin-catalogo',
  name: 'Gestao PROPESP',
  roles: ['admin'],
  permissions: ['catalogo:write'],
};

/**
 * Escrita no catalogo de bolsas (P15) e nas modalidades (P23).
 *
 * O que estes casos protegem e a assimetria que a decisao de 2026-09-08
 * comprou: **acrescentar item e livre, alterar item em uso nao e**. Sem ela, a
 * equipe nao consegue cadastrar a composicao manualmente (PEND-005); com ela
 * frouxa demais, um reajuste digitado hoje mudaria o custo de um planejamento
 * aprovado no ano passado.
 */
describe('Catalogo de bolsas — escrita', () => {
  let ctx: ContextoTeste;
  let catalogo: CatalogoService;
  let plano: PlanoService;
  let contexto: ContextoService;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    await ctx.limpar();
    await executarSeed(ctx.db);

    catalogo = new CatalogoService(ctx.db);
    plano = new PlanoService(ctx.db, catalogo);
    contexto = new ContextoService(ctx.db);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  async function modalidadeId(nome: string): Promise<string> {
    const [modalidade] = await ctx.db
      .select({ id: s.modalidade.id })
      .from(s.modalidade)
      .where(eq(s.modalidade.nome, nome))
      .limit(1);
    return modalidade.id;
  }

  it('publica item novo e ele passa a resolver preco em RN-01', async () => {
    const id = await modalidadeId('Capacitação');
    const tabela = await catalogo.tabelaVigente('capes-global');

    // Antes de publicar, a combinacao nao existe e o plano recusaria a linha.
    await expect(
      catalogo.resolverItem(tabela.id, 'BRASIL', id, '11.0'),
    ).rejects.toThrow(UnprocessableEntityException);

    const criado = await catalogo.criarItem(
      'capes-global',
      {
        destino: 'BRASIL',
        modalidadeId: id,
        vigenciaMeses: '11.0',
        valorBrl: '123456.78',
        valorUsd: null,
        fonte: 'Portaria de teste',
        observacao: null,
      },
      ADMIN,
    );

    expect(criado.codigo).toMatch(/^CAT-\d{3}$/);

    const resolvido = await catalogo.resolverItem(
      tabela.id,
      'BRASIL',
      id,
      '11',
    );
    expect(resolvido.id).toBe(criado.id);
    expect(resolvido.valorBrl).toBe('123456.78');

    const [auditoria] = await ctx.db
      .select({ acao: s.registroAuditoria.acao })
      .from(s.registroAuditoria)
      .where(
        and(
          eq(s.registroAuditoria.entidadeTipo, 'ITEM_CATALOGO_BOLSA'),
          eq(s.registroAuditoria.entidadeId, criado.id),
        ),
      );
    expect(auditoria.acao).toBe('CRIACAO');
  });

  it('recusa item repetido para a mesma busca de preco', async () => {
    const id = await modalidadeId('Capacitação');
    await expect(
      catalogo.criarItem(
        'capes-global',
        {
          destino: 'BRASIL',
          modalidadeId: id,
          // Mesma vigencia do caso anterior, escrita de outro jeito: a
          // unicidade e numerica, e "11" e "11.0" sao a mesma linha.
          vigenciaMeses: '11',
          valorBrl: '1.00',
          valorUsd: null,
          fonte: 'Portaria de teste',
          observacao: null,
        },
        ADMIN,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('marca o destino coberto na modalidade ao publicar o primeiro item', async () => {
    const nova = await catalogo.criarModalidade(
      { nome: 'Estagio Senior de Teste', publicoAlvo: 'DOCENTE', ativa: true },
      ADMIN,
    );

    const [antes] = await ctx.db
      .select({ exterior: s.modalidade.permiteExterior })
      .from(s.modalidade)
      .where(eq(s.modalidade.id, nova.id));
    expect(antes.exterior).toBe(false);

    await catalogo.criarItem(
      'capes-global',
      {
        destino: 'EXTERIOR',
        modalidadeId: nova.id,
        vigenciaMeses: '3',
        valorBrl: '50000.00',
        valorUsd: '7500.00',
        fonte: 'Portaria de teste',
        observacao: null,
      },
      ADMIN,
    );

    const [depois] = await ctx.db
      .select({ exterior: s.modalidade.permiteExterior })
      .from(s.modalidade)
      .where(eq(s.modalidade.id, nova.id));
    expect(depois.exterior).toBe(true);
  });

  it('deixa editar por inteiro o item que nenhuma linha usa', async () => {
    const id = await modalidadeId('Capacitação');
    const item = await catalogo.criarItem(
      'capes-global',
      {
        destino: 'BRASIL',
        modalidadeId: id,
        vigenciaMeses: '9',
        valorBrl: '10000.00',
        valorUsd: null,
        fonte: 'Portaria de teste',
        observacao: null,
      },
      ADMIN,
    );

    const editado = await catalogo.atualizarItem(
      item.id,
      {
        destino: 'BRASIL',
        modalidadeId: id,
        vigenciaMeses: '9',
        valorBrl: '11000.00',
        valorUsd: null,
        fonte: 'Portaria de teste, retificada',
        observacao: 'Valor corrigido antes de qualquer uso.',
        justificativa: 'Digitacao errada no cadastro inicial.',
      },
      ADMIN,
    );

    expect(editado.valorBrl).toBe('11000.00');

    const campos = await ctx.db
      .select({ campo: s.registroAuditoria.campo })
      .from(s.registroAuditoria)
      .where(
        and(
          eq(s.registroAuditoria.entidadeTipo, 'ITEM_CATALOGO_BOLSA'),
          eq(s.registroAuditoria.entidadeId, item.id),
          eq(s.registroAuditoria.acao, 'EDICAO'),
        ),
      );
    // Uma linha por campo alterado, e nenhuma para o que ficou igual.
    expect(campos.map((c) => c.campo).sort()).toEqual([
      'fonte',
      'observacao',
      'valorBrl',
    ]);
  });

  it('recusa mudar valor de item que ja custeia uma linha do plano, e aceita corrigir a fonte', async () => {
    const ciclo = await contexto.resolver('capes-global', '2027-2030');
    const id = await modalidadeId('Capacitação');

    const item = await catalogo.criarItem(
      'capes-global',
      {
        destino: 'BRASIL',
        modalidadeId: id,
        vigenciaMeses: '8',
        valorBrl: '20000.00',
        valorUsd: null,
        fonte: 'Portaria de teste',
        observacao: null,
      },
      ADMIN,
    );

    const [participacao] = await ctx.db
      .select({
        ppgId: s.participacaoPpg.ppgId,
        areaTematicaId: s.participacaoPpg.areaTematicaId,
      })
      .from(s.participacaoPpg)
      .limit(1);

    await plano.criar(ciclo, {
      rubrica: 'BOLSAS',
      ppgId: participacao.ppgId,
      areaTematicaId: participacao.areaTematicaId,
      destino: 'BRASIL',
      modalidadeId: id,
      vigenciaMeses: 8,
      quantidadeAnual: 1,
      ano: 2027,
    });

    const base = {
      destino: 'BRASIL' as const,
      modalidadeId: id,
      vigenciaMeses: '8',
      valorBrl: '20000.00',
      valorUsd: null,
      fonte: 'Portaria de teste',
      observacao: null,
      justificativa: 'Reajuste anunciado pela CAPES.',
    };

    // O valor esta trancado: mudar aqui mudaria, sem aviso, o custo de um
    // planejamento ja calculado.
    await expect(
      catalogo.atualizarItem(item.id, { ...base, valorBrl: '25000.00' }, ADMIN),
    ).rejects.toThrow(ConflictException);

    // A fonte nao entra em calculo nenhum e continua editavel.
    const corrigido = await catalogo.atualizarItem(
      item.id,
      { ...base, fonte: 'Portaria no 33, de 16 de fevereiro de 2023' },
      ADMIN,
    );
    expect(corrigido.fonte).toBe('Portaria no 33, de 16 de fevereiro de 2023');

    // E nao se apaga a base de calculo de uma linha existente.
    await expect(catalogo.removerItem(item.id, ADMIN)).rejects.toThrow(
      ConflictException,
    );

    const listados = (await catalogo.tabelaVigente('capes-global')).itens;
    expect(listados.find((i) => i.id === item.id)?.usos).toBe(1);
  });

  it('remove item nunca usado e recusa edicao sem mudanca', async () => {
    const id = await modalidadeId('Capacitação');
    const item = await catalogo.criarItem(
      'capes-global',
      {
        destino: 'BRASIL',
        modalidadeId: id,
        vigenciaMeses: '7',
        valorBrl: '15000.00',
        valorUsd: null,
        fonte: 'Portaria de teste',
        observacao: null,
      },
      ADMIN,
    );

    await expect(
      catalogo.atualizarItem(
        item.id,
        {
          destino: 'BRASIL',
          modalidadeId: id,
          vigenciaMeses: '7.0',
          valorBrl: '15000.00',
          valorUsd: null,
          fonte: 'Portaria de teste',
          observacao: null,
          justificativa: 'Nenhuma alteracao real.',
        },
        ADMIN,
      ),
    ).rejects.toThrow(BadRequestException);

    await catalogo.removerItem(item.id, ADMIN);
    await expect(
      catalogo.atualizarItem(
        item.id,
        {
          destino: 'BRASIL',
          modalidadeId: id,
          vigenciaMeses: '7',
          valorBrl: '15000.00',
          valorUsd: null,
          fonte: 'Portaria de teste',
          observacao: null,
          justificativa: 'Item ja removido.',
        },
        ADMIN,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('nao aceita item novo em modalidade inativa', async () => {
    const modalidade = await catalogo.criarModalidade(
      { nome: 'Modalidade Descontinuada', publicoAlvo: 'AMBOS', ativa: false },
      ADMIN,
    );

    await expect(
      catalogo.criarItem(
        'capes-global',
        {
          destino: 'BRASIL',
          modalidadeId: modalidade.id,
          vigenciaMeses: '2',
          valorBrl: '1000.00',
          valorUsd: null,
          fonte: 'Portaria de teste',
          observacao: null,
        },
        ADMIN,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('recusa modalidade com nome repetido e inativa em vez de excluir', async () => {
    await expect(
      catalogo.criarModalidade(
        { nome: 'Capacitação', publicoAlvo: 'AMBOS', ativa: true },
        ADMIN,
      ),
    ).rejects.toThrow(ConflictException);

    const alvo = await modalidadeId('Modalidade Descontinuada');
    const atualizada = await catalogo.atualizarModalidade(
      alvo,
      { nome: 'Modalidade Descontinuada', publicoAlvo: 'DOCENTE', ativa: true },
      ADMIN,
    );
    expect(atualizada.ativa).toBe(true);
    expect(atualizada.publicoAlvo).toBe('DOCENTE');
  });
});
