import { and, eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import * as s from '../src/database/schema';
import {
  ContatosParceirosService,
  criarContatoParceiroSchema,
  type CriarContatoParceiro,
} from '../src/dominio/contatos-parceiros.service';
import {
  criarParceiroSchema,
  ParceirosService,
} from '../src/dominio/parceiros.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-contatos',
  name: 'Admin de Contatos',
  roles: ['admin'],
  permissions: [
    'parceiro:read',
    'parceiro:create',
    'parceiro:edit',
    'parceiro:status',
    'parceiro:merge',
    'convenio:create',
    'convenio:edit',
    'convenio:status',
  ],
};

describe('ContatosParceirosService', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let contatos: ContatosParceirosService;
  let parceiros: ParceirosService;
  let parceiroId: string;
  let paisId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    contatos = new ContatosParceirosService(ctx.db);
    parceiros = new ParceirosService(ctx.db);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ codigoIso2: 'FR', codigoIso3: 'FRA', nome: 'Franca' })
      .returning({ id: s.pais.id });
    paisId = pais.id;
    const parceiro = await parceiros.criar(
      criarParceiroSchema.parse({
        nome: 'Universite de Lyon',
        sigla: 'ULYON',
        paisId,
        redeIds: [base.redeId],
        origemRelacionamento: 'PROSPECCAO_INSTITUCIONAL',
      }),
      admin,
    );
    parceiroId = parceiro.id;
  });

  it('cadastra, pesquisa e edita sem copiar valores pessoais para auditoria', async () => {
    const criado = await contatos.criar(
      contatoValido(parceiroId, 'Marie Dupont', {
        email: 'Marie.Dupont@Example.FR',
        telefone: '+33 1 22 33 44 55',
        cargo: 'Diretora Internacional',
        paisId,
        principal: true,
      }),
      admin,
    );
    expect(criado).toMatchObject({
      instituicaoId: parceiroId,
      instituicao: 'Universite de Lyon',
      nome: 'Marie Dupont',
      email: 'Marie.Dupont@Example.FR',
      principal: true,
      ativo: true,
    });

    const buscaPorEmail = await contatos.listar({
      busca: 'dupont@example',
      incluirInativos: false,
    });
    const buscaPorInstituicao = await contatos.listar({
      busca: 'lyon',
      incluirInativos: false,
    });
    expect(buscaPorEmail.map((item) => item.id)).toEqual([criado.id]);
    expect(buscaPorInstituicao.map((item) => item.id)).toEqual([criado.id]);

    const atualizado = await contatos.atualizar(
      criado.id,
      {
        cargo: 'Pro-reitora Internacional',
        email: 'marie.nova@example.fr',
      },
      admin,
    );
    expect(atualizado.cargo).toBe('Pro-reitora Internacional');

    const [persistido] = await ctx.db
      .select({ emailNormalizado: s.contatoInstituicao.emailNormalizado })
      .from(s.contatoInstituicao)
      .where(eq(s.contatoInstituicao.id, criado.id));
    expect(persistido.emailNormalizado).toBe('marie.nova@example.fr');

    const auditorias = await ctx.db
      .select()
      .from(s.registroAuditoria)
      .where(
        and(
          eq(s.registroAuditoria.entidadeTipo, 'CONTATO_INSTITUICAO'),
          eq(s.registroAuditoria.entidadeId, criado.id),
        ),
      );
    const auditoriaSerializada = JSON.stringify(auditorias);
    expect(auditoriaSerializada).not.toContain('Marie Dupont');
    expect(auditoriaSerializada).not.toContain('Marie.Dupont@Example.FR');
    expect(auditoriaSerializada).not.toContain('marie.nova@example.fr');
    expect(auditoriaSerializada).not.toContain('+33 1 22 33 44 55');
    expect(
      auditorias.filter((item) =>
        ['cargo', 'email'].includes(item.campo ?? ''),
      ),
    ).toEqual([
      expect.objectContaining({ valorAnterior: null, valorNovo: null }),
      expect.objectContaining({ valorAnterior: null, valorNovo: null }),
    ]);
  });

  it('bloqueia identidade inequivoca e pede confirmacao para homonimo', async () => {
    const original = await contatos.criar(
      contatoValido(parceiroId, 'Jean Martin', {
        email: 'jean.martin@example.fr',
        telefone: '+33 1 90 90 90 90',
      }),
      admin,
    );

    await expect(
      contatos.criar(
        contatoValido(parceiroId, 'Jean M. Martin', {
          email: 'JEAN.MARTIN@example.fr',
          confirmarPossivelDuplicidade: true,
        }),
        admin,
      ),
    ).rejects.toMatchObject({ status: 409 });

    const homonimo = contatoValido(parceiroId, 'Jean Martin', {
      email: 'outro.jean@example.fr',
    });
    await expect(contatos.criar(homonimo, admin)).rejects.toMatchObject({
      status: 409,
    });
    const confirmado = await contatos.criar(
      { ...homonimo, confirmarPossivelDuplicidade: true },
      admin,
    );
    expect(confirmado.id).not.toBe(original.id);
  });

  it('mantem somente um principal e audita cada troca', async () => {
    const primeiro = await contatos.criar(
      contatoValido(parceiroId, 'Primeiro Contato', { principal: true }),
      admin,
    );
    const segundo = await contatos.criar(
      contatoValido(parceiroId, 'Segundo Contato', { principal: true }),
      admin,
    );
    expect((await contatos.detalhar(primeiro.id)).principal).toBe(false);
    expect(segundo.principal).toBe(true);

    const principalNovo = await contatos.definirPrincipal(primeiro.id, admin);
    expect(principalNovo.principal).toBe(true);
    expect((await contatos.detalhar(segundo.id)).principal).toBe(false);

    const principais = await ctx.db
      .select()
      .from(s.contatoInstituicao)
      .where(
        and(
          eq(s.contatoInstituicao.instituicaoId, parceiroId),
          eq(s.contatoInstituicao.principal, true),
          eq(s.contatoInstituicao.ativo, true),
        ),
      );
    expect(principais).toHaveLength(1);
  });

  it('inativa sem apagar referencia da missao e permite reativacao auditada', async () => {
    const contato = await contatos.criar(
      contatoValido(parceiroId, 'Contato da Missao', {
        email: 'missao@example.fr',
        principal: true,
      }),
      admin,
    );
    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Responsavel da Missao', tipo: 'SERVIDOR' })
      .returning({ id: s.pessoa.id });
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MCG-CONTATO-001',
        titulo: 'Missao com contato protegido',
        objetivo: 'Verificar preservacao da referencia.',
        dataInicio: '2027-10-01',
        dataFim: '2027-10-05',
      })
      .returning({ id: s.missaoComite.id });
    await ctx.db.insert(s.missaoParticipante).values({
      missaoId: missao.id,
      pessoaId: pessoa.id,
      papel: 'RESPONSAVEL',
      dataInicio: '2027-10-01',
      dataFim: '2027-10-05',
    });
    const [atividade] = await ctx.db
      .insert(s.atividadeMissao)
      .values({
        missaoId: missao.id,
        ordem: 1,
        tipo: 'VISITA_TECNICA',
        titulo: 'Visita institucional',
        paisId,
        instituicaoId: parceiroId,
        contatoInstituicaoId: contato.id,
        dataInicio: '2027-10-02',
        dataFim: '2027-10-03',
      })
      .returning({ id: s.atividadeMissao.id });

    const inativo = await contatos.inativar(
      contato.id,
      { justificativa: 'Contato deixou a instituicao.' },
      admin,
    );
    expect(inativo).toMatchObject({ ativo: false, principal: false });
    expect(
      await contatos.listar({
        instituicaoId: parceiroId,
        incluirInativos: false,
      }),
    ).toHaveLength(0);
    const [referencia] = await ctx.db
      .select({ contatoId: s.atividadeMissao.contatoInstituicaoId })
      .from(s.atividadeMissao)
      .where(eq(s.atividadeMissao.id, atividade.id));
    expect(referencia.contatoId).toBe(contato.id);

    const reativado = await contatos.reativar(
      contato.id,
      { justificativa: 'Retorno confirmado pela administracao.' },
      admin,
    );
    expect(reativado).toMatchObject({ ativo: true, principal: false });
  });
});

function contatoValido(
  instituicaoId: string,
  nome: string,
  sobrescrever: Partial<CriarContatoParceiro> = {},
): CriarContatoParceiro {
  return criarContatoParceiroSchema.parse({
    instituicaoId,
    nome,
    ...sobrescrever,
  });
}
