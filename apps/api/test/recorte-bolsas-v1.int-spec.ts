import { ExportacaoService } from '../src/exportacao/exportacao.service';
import { ResultadosService } from '../src/dominio/resultados.service';
import { RelatoriosService } from '../src/dominio/relatorios.service';
import { PrestacaoService } from '../src/dominio/prestacao.service';
import { ParceirosService } from '../src/dominio/parceiros.service';
import { MissoesComiteService } from '../src/dominio/missoes-comite.service';
import { EncerramentoService } from '../src/dominio/encerramento.service';
import { AnexosService } from '../src/dominio/anexos.service';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Response } from 'express';

import type { AuthUser } from '../src/auth/auth-user';
import type { AuthenticatedRequest } from '../src/auth/auth.decorators';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { AcessoV1Service } from '../src/auth/autorizacao-v1/acesso-v1.service';
import type { PermissaoV1 } from '../src/auth/autorizacao-v1/catalogo';
import type { EscopoV1 } from '../src/auth/autorizacao-v1/concessao';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import { IdentidadeService } from '../src/auth/identidade.service';
import * as s from '../src/database/schema';
import { BolsistasController } from '../src/dominio/bolsistas.controller';
import {
  BolsistasService,
  atualizarBolsaConcedidaSchema,
  type CriarBolsaConcedida,
} from '../src/dominio/bolsistas.service';
import { MobilidadeService } from '../src/dominio/mobilidade.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import {
  bolsaValida,
  criarAcesso,
  criarBase,
  type BaseFixture,
} from './fixtures';

const usuario: AuthUser = {
  id: 'operador-v1015',
  name: 'Operador',
  roles: [],
  permissions: [],
};
const edicao = {
  dataInicio: '2027-03-01',
  dataFim: '2027-08-31',
  status: 'EM_ANDAMENTO' as const,
};
const produto = {
  tipo: 'ARTIGO' as const,
  titulo: 'Produto de teste',
  prazoEntrega: '2027-12-01',
  status: 'PREVISTO' as const,
  instituicaoColaboracao: 'Universidade',
  paisColaboracao: 'Brasil',
};

describe('V1-015: alcance por acao e dados pessoais', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let bolsas: BolsistasService;
  let mobilidade: MobilidadeService;
  let resolver: AcessoV1Service;
  let app: INestApplication;
  let exportacao: ExportacaoService;
  let url: string;
  let contaId: string;
  let tematica2: string;
  let participacao: string;
  let ciclo2: string;
  let item1: string;
  let item2: string;
  let pais: string;
  let dentro: string;
  let fora: string;
  let legado: string;
  let semTematica: string;
  let outroCiclo: string;
  let pessoaDentro: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    const identidade = new IdentidadeService(ctx.db);
    bolsas = new BolsistasService(ctx.db, identidade);
    mobilidade = new MobilidadeService(ctx.db, identidade);
    resolver = new AcessoV1Service(ctx.db);
    const modulo = await Test.createTestingModule({
      controllers: [BolsistasController],
      providers: [
        { provide: BolsistasService, useValue: bolsas },
        { provide: MobilidadeService, useValue: mobilidade },
        ExportacaoService,
        // Outros dominios nao participam da exportacao de mobilidade.
        ...[
          AnexosService,
          EncerramentoService,
          MissoesComiteService,
          ParceirosService,
          PrestacaoService,
          RelatoriosService,
          ResultadosService,
        ].map((provide) => ({ provide, useValue: {} })),
      ],
    }).compile();
    exportacao = modulo.get(ExportacaoService);
    app = modulo.createNestApplication();
    // Autenticacao substituida pela identidade ficticia; concessoes, guard,
    // controller, validacao, SQL e transacoes sao reais.
    app.use((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      resolver
        .resolver(usuario.id)
        .then((acesso) => {
          req.acesso = acesso;
          req.user = { ...usuario, permissions: acesso.permissoes };
          next();
        })
        .catch(next);
    });
    app.useGlobalGuards(new PermissionsGuard(app.get(Reflector)));
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    contaId = (await criarAcesso(ctx.db, { sub: usuario.id, permissoes: [] }))
      .usuarioId;
    tematica2 = (
      await ctx.db
        .insert(s.areaTematica)
        .values({ redeId: base.redeId, codigo: 'T2', nome: 'Temática 2' })
        .returning()
    )[0].id;
    participacao = (
      await ctx.db
        .insert(s.participacaoPpg)
        .values({
          ppgId: base.ppgId,
          areaTematicaId: base.areaTematicaId,
          coordenadorTematicaId: base.coordenadorTematicaId,
          situacao: 'CONTEMPLADO',
        })
        .returning()
    )[0].id;
    ciclo2 = (
      await ctx.db
        .insert(s.ciclo)
        .values({
          programaId: base.programaId,
          nome: '2031-2034',
          anoInicio: 2031,
          anoFim: 2034,
        })
        .returning()
    )[0].id;
    item1 = (
      await ctx.db
        .insert(s.itemPlanejado)
        .values(bolsaValida(base, 'BOL-A'))
        .returning()
    )[0].id;
    item2 = (
      await ctx.db
        .insert(s.itemPlanejado)
        .values({ ...bolsaValida(base, 'BOL-B'), areaTematicaId: tematica2 })
        .returning()
    )[0].id;
    await ctx.db.insert(s.planejamentoAnual).values(
      [item1, item2].map((id) => ({
        itemPlanejadoId: id,
        ano: 2027,
        quantidade: 10,
      })),
    );
    pais = (
      await ctx.db
        .insert(s.pais)
        .values({ nome: 'Brasil', codigoIso2: 'BR', codigoIso3: 'BRA' })
        .returning()
    )[0].id;
    const pessoa = (
      await ctx.db
        .insert(s.pessoa)
        .values({
          nome: 'Pessoa dentro',
          cpf: '52998224725',
          email: 'dentro@example.test',
          telefone: '92999990000',
          tipo: 'DISCENTE',
        })
        .returning()
    )[0];
    pessoaDentro = pessoa.id;
    dentro = await inserirBolsa(
      'Dentro',
      base.areaTematicaId,
      item1,
      base.cicloId,
      pessoa.id,
    );
    fora = await inserirBolsa('Fora', tematica2, item1);
    legado = await inserirBolsa('Legado', null, item1);
    semTematica = await inserirBolsa('Sem temática', null, null);
    outroCiclo = await inserirBolsa('Outro ciclo', null, null, ciclo2);
    await ctx.db.insert(s.produtoBolsa).values(
      [dentro, fora, legado].map((id) => ({
        bolsaConcedidaId: id,
        titulo: `Produto ${id}`,
        tipo: 'ARTIGO' as const,
        prazoEntrega: '2027-12-01',
      })),
    );
  });

  async function inserirBolsa(
    nome: string,
    areaTematicaId: string | null,
    itemPlanejadoId: string | null,
    cicloId = base.cicloId,
    pessoaId?: string,
  ) {
    pessoaId ??= (
      await ctx.db
        .insert(s.pessoa)
        .values({ nome, tipo: 'DISCENTE' })
        .returning()
    )[0].id;
    return (
      await ctx.db
        .insert(s.bolsaConcedida)
        .values({
          programaId: base.programaId,
          cicloId,
          ppgId: base.ppgId,
          pessoaId,
          areaTematicaId,
          itemPlanejadoId,
          modalidadeId: base.modalidadeId,
          destino: 'EXTERIOR',
          nivelBeneficiario: 'DOUTORADO',
          ...edicao,
          vigenciaMeses: '6',
          valorConcedido: '100.00',
          fluxo: 'OUT',
        })
        .returning()
    )[0].id;
  }

  async function conceder(
    permissao: PermissaoV1,
    alvo: EscopoV1 = { tipo: 'GLOBAL' },
  ) {
    await ctx.db.insert(s.concessaoAcesso).values({
      usuarioId: contaId,
      permissao,
      justificativa: 'Teste de alcance por ação.',
      ...colunasDoAlvo(alvo),
    });
  }
  const alvo = () => ({
    tipo: 'PARTICIPACAO' as const,
    participacaoId: participacao,
  });
  const ppg = () => ({
    tipo: 'PPG' as const,
    ppgId: base.ppgId,
    cicloId: base.cicloId,
  });
  const dto = (): CriarBolsaConcedida => ({
    itemPlanejadoId: item1,
    nome: 'Pessoa nova',
    cpf: '11144477735',
    email: 'nova@example.test',
    telefone: '92911112222',
    nivelBeneficiario: 'DOUTORADO',
    paisOrigemId: pais,
    modoInstituicaoOrigem: 'livre',
    instituicaoOrigemNome: 'UEA',
    paisDestinoNome: 'Portugal',
    instituicaoDestinoNome: 'Universidade',
    ...edicao,
  });
  const ids = async () =>
    (await bolsas.listar(usuario)).map((b) => b.id).sort();

  it('participacao usa a tematica da bolsa, fallback do item e nega nao classificada', async () => {
    await conceder('bolsa:read', alvo());
    await conceder('plano:read');
    await conceder('produto:read', alvo());
    expect(await ids()).toEqual([dentro, legado].sort());
    await expect(bolsas.detalhar(fora, usuario)).rejects.toMatchObject({
      status: 404,
    });
    expect((await mobilidade.producao(usuario)).length).toBe(2);
    expect((await mobilidade.panorama(usuario, {})).totais).toMatchObject({
      mobilidades: 2,
      valor: '200.00',
    });
    await conceder('bolsa:read', {
      tipo: 'TEMATICA',
      tematicaId: base.areaTematicaId,
    });
    expect(await ids()).toEqual([dentro, legado].sort());
  });

  it('PPG mais ciclo nao libera o mesmo PPG em outro ciclo; global permite correcao', async () => {
    await conceder('bolsa:read', ppg());
    expect(await ids()).toEqual([dentro, fora, legado, semTematica].sort());
    await expect(bolsas.detalhar(outroCiclo, usuario)).rejects.toMatchObject({
      status: 404,
    });
    await conceder('bolsa:read');
    expect(await ids()).toHaveLength(5);
  });

  it('rede e ciclo recortam bolsas sem exigir alcance separado por PPG', async () => {
    await conceder('bolsa:read', { tipo: 'REDE', redeId: base.redeId });
    expect(await ids()).toEqual([dentro, fora, legado].sort());
    await conceder('bolsa:read', { tipo: 'CICLO', cicloId: base.cicloId });
    expect(await ids()).toEqual([dentro, fora, legado, semTematica].sort());
  });

  it('campos pessoais e produtos sao projetados por capacidade no mesmo alvo', async () => {
    await conceder('bolsa:read');
    let bolsa = await bolsas.detalhar(dentro, usuario);
    expect(bolsa).toMatchObject({
      cpf: null,
      email: null,
      telefone: null,
      produtosPendentes: null,
      produtos: [],
      podeLerProdutos: false,
    });
    await conceder('pessoa:read-cpf', {
      tipo: 'TEMATICA',
      tematicaId: tematica2,
    });
    expect((await bolsas.detalhar(dentro, usuario)).cpf).toBeNull();
    await conceder('pessoa:read-cpf', alvo());
    await conceder('pessoa:read-contato', alvo());
    await conceder('produto:read', alvo());
    bolsa = await bolsas.detalhar(dentro, usuario);
    expect(bolsa).toMatchObject({
      cpf: '52998224725',
      email: 'dentro@example.test',
      telefone: '92999990000',
      podeLerProdutos: true,
    });
    expect(bolsa.produtos).toHaveLength(1);
    expect((await bolsas.detalhar(fora, usuario)).produtos).toEqual([]);
    expect(
      (await mobilidade.panorama(usuario, {})).porRede.find(
        (r) => r.chave === base.redeId,
      )?.produtos,
    ).toBeNull();
  });

  it('exportacao exige intersecao com leitura e preserva a projecao de CPF', async () => {
    await conceder('bolsa:read');
    expect(await mobilidade.relatorio(usuario, {})).toEqual([]);
    await conceder('bolsa:export', alvo());
    const linhas = await mobilidade.relatorio(usuario, {});
    expect(linhas).toHaveLength(2);
    expect(linhas.every((l) => l.cpf === null && l.produtos === null)).toBe(
      true,
    );
    await conceder('pessoa:read-cpf', alvo());
    expect(
      (await mobilidade.relatorio(usuario, {})).find(
        (l) => l.bolsista === 'Pessoa dentro',
      )?.cpf,
    ).toBe('52998224725');
    await ctx.db
      .delete(s.concessaoAcesso)
      .where(
        and(
          eq(s.concessaoAcesso.usuarioId, contaId),
          eq(s.concessaoAcesso.permissao, 'bolsa:read'),
        ),
      );
    await conceder('bolsa:read', { tipo: 'TEMATICA', tematicaId: tematica2 });
    expect(await mobilidade.relatorio(usuario, {})).toEqual([]);
  });

  it('CSV, XLSX e PDF reais preservam alcance e nao reintroduzem CPF', async () => {
    await conceder('bolsa:read');
    await conceder('bolsa:export', alvo());
    const pasta = await mkdtemp(join(tmpdir(), 'v1015-exportacao-'));
    try {
      for (const revelaCpf of [false, true]) {
        if (revelaCpf) await conceder('pessoa:read-cpf', alvo());
        for (const formato of ['csv', 'xlsx', 'pdf'] as const) {
          const arquivo = await exportacao.relatorioDeMobilidade(
            usuario,
            {},
            formato,
          );
          const caminho = join(pasta, `mobilidade.${formato}`);
          await writeFile(caminho, arquivo.conteudo);
          const texto =
            formato === 'csv'
              ? arquivo.conteudo.toString('utf8')
              : formato === 'xlsx'
                ? execFileSync(
                    'unzip',
                    ['-p', caminho, 'xl/worksheets/sheet1.xml'],
                    { encoding: 'utf8' },
                  )
                : execFileSync('pdftotext', ['-raw', caminho, '-'], {
                    encoding: 'utf8',
                  });
          expect(texto.replace(/\s/g, '')).toContain('Pessoadentro');
          expect(texto.replace(/\s/g, '').includes('52998224725')).toBe(
            revelaCpf,
          );
          expect(texto).not.toContain('dentro@example.test');
          expect(texto).not.toContain('Fora');
          expect(texto).not.toContain('Outro ciclo');
        }
      }
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  });

  it('criacao e referencias usam a propria acao mesmo com leitura global', async () => {
    await conceder('bolsa:read');
    await conceder('bolsa:create', alvo());
    const acesso = await resolver.resolver(usuario.id);
    expect(
      (await bolsas.opcoesPlanejamento(acesso.alcance('bolsa:create'))).map(
        (o) => o.id,
      ),
    ).toEqual([item1]);
    await expect(
      bolsas.criar({ ...dto(), itemPlanejadoId: item2 }, usuario),
    ).rejects.toMatchObject({ status: 404 });
    const criada = await bolsas.criar(dto(), usuario);
    expect(criada).toMatchObject({ cpf: null, email: null, telefone: null });
    expect(
      (
        await ctx.db
          .select()
          .from(s.pessoa)
          .where(eq(s.pessoa.id, criada.pessoaId))
      )[0].cpf,
    ).toBe(dto().cpf);
  });

  it('escrita sem leitura conclui sem erro posterior e sem devolver dados pessoais', async () => {
    await conceder('bolsa:create', alvo());
    const criada = await bolsas.criar(dto(), usuario);
    expect(criada.id).toBeTruthy();
    expect(criada.cpf).toBeNull();
    expect(await bolsas.listar(usuario)).toEqual([]);
    await conceder('bolsa:edit', alvo());
    expect((await bolsas.atualizar(criada.id, edicao, usuario)).id).toBe(
      criada.id,
    );
    await conceder('produto:create', alvo());
    expect(
      (await bolsas.criarProduto(criada.id, produto, usuario)).titulo,
    ).toBe(produto.titulo);
  });

  it('edicao e produtos recusam alvo fora da acao mesmo com leitura global', async () => {
    await conceder('bolsa:read');
    await conceder('bolsa:edit', alvo());
    await conceder('produto:create', alvo());
    await conceder('produto:edit', alvo());
    await expect(
      bolsas.atualizar(fora, { ...edicao, status: 'CANCELADA' }, usuario),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      bolsas.criarProduto(fora, produto, usuario),
    ).rejects.toMatchObject({ status: 404 });
    const [produtoFora] = await ctx.db
      .select()
      .from(s.produtoBolsa)
      .where(eq(s.produtoBolsa.bolsaConcedidaId, fora));
    await expect(
      bolsas.atualizarProduto(dentro, produtoFora.id, produto, usuario),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await ctx.db
          .select()
          .from(s.bolsaConcedida)
          .where(eq(s.bolsaConcedida.id, fora))
      )[0].status,
    ).toBe(edicao.status);
  });

  it('CPF ausente e preservado; correcao exige capacidade e rollback e atomico', async () => {
    await conceder('bolsa:read');
    await conceder('bolsa:edit', alvo());
    await conceder('pessoa:read-cpf', alvo());
    await bolsas.atualizar(dentro, edicao, usuario);
    expect((await bolsas.detalhar(dentro, usuario)).cpf).toBe('52998224725');
    await expect(
      bolsas.atualizar(dentro, { ...edicao, cpf: '11144477735' }, usuario),
    ).rejects.toMatchObject({ status: 403 });
    await conceder('pessoa:edit-cpf', alvo());
    await expect(
      bolsas.atualizar(
        dentro,
        {
          ...edicao,
          cpf: '11144477735',
          dataInicio: '2028-03-01',
          dataFim: '2028-08-31',
        },
        usuario,
      ),
    ).rejects.toThrow('Não existe vaga');
    expect((await bolsas.detalhar(dentro, usuario)).cpf).toBe('52998224725');
    expect(
      (
        await bolsas.atualizar(
          dentro,
          { ...edicao, cpf: '11144477735' },
          usuario,
        )
      ).cpf,
    ).toBe('11144477735');
    const auditoria = await ctx.db
      .select()
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, pessoaDentro));
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({
      campo: 'cpf',
      usuarioId: usuario.id,
      valorAnterior: null,
      valorNovo: null,
    });
    expect(
      atualizarBolsaConcedidaSchema.safeParse({
        ...edicao,
        cpf: '***.982.247-**',
      }).success,
    ).toBe(false);
  });

  it('correcao nao altera pessoa compartilhada com bolsa fora do alcance', async () => {
    await inserirBolsa(
      'Compartilhada',
      tematica2,
      null,
      base.cicloId,
      pessoaDentro,
    );
    await conceder('bolsa:edit', alvo());
    await conceder('pessoa:edit-cpf', alvo());
    await conceder('bolsa:read', alvo());
    expect((await bolsas.detalhar(dentro, usuario)).podeAlterarCpf).toBe(false);
    await expect(
      bolsas.atualizar(dentro, { ...edicao, cpf: '11144477735' }, usuario),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (
        await ctx.db
          .select()
          .from(s.pessoa)
          .where(eq(s.pessoa.id, pessoaDentro))
      )[0].cpf,
    ).toBe('52998224725');
  });

  it('duplicidade nao sobrescreve pessoa por e-mail nem revela cadastro alheio', async () => {
    await conceder('bolsa:create', alvo());
    await expect(
      bolsas.criar({ ...dto(), email: 'dentro@example.test' }, usuario),
    ).rejects.toThrow('Solicite revisão do cadastro');
    const [original] = await ctx.db
      .select()
      .from(s.pessoa)
      .where(eq(s.pessoa.id, pessoaDentro));
    expect(original).toMatchObject({
      nome: 'Pessoa dentro',
      cpf: '52998224725',
      email: 'dentro@example.test',
    });
    await ctx.db
      .update(s.pessoa)
      .set({ cpf: '11144477735' })
      .where(
        eq(
          s.pessoa.id,
          (
            await ctx.db
              .select()
              .from(s.bolsaConcedida)
              .where(eq(s.bolsaConcedida.id, fora))
          )[0].pessoaId,
        ),
      );
    await expect(bolsas.criar(dto(), usuario)).rejects.toThrow(
      'Solicite revisão do cadastro',
    );
    expect(await ctx.db.select().from(s.bolsaConcedida)).toHaveLength(5);
  });

  it('produto de missao exige as duas acoes no registro e nao herda bolsa global', async () => {
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MCG-TESTE',
        titulo: 'Missão',
        objetivo: 'Cooperação',
        dataInicio: '2027-03-01',
        dataFim: '2027-03-05',
      })
      .returning();
    await ctx.db
      .insert(s.missaoRede)
      .values({ missaoId: missao.id, redeId: base.redeId });
    await ctx.db.insert(s.produtoMissao).values({
      missaoId: missao.id,
      tipo: 'REDE_PESQUISA',
      titulo: 'Rede científica',
      ano: 2027,
    });
    await conceder('bolsa:read');
    await conceder('produto:read');
    await conceder('missao:read', { tipo: 'REDE', redeId: base.redeId });
    expect(
      (await mobilidade.producao(usuario)).filter((p) => p.origem === 'MISSAO'),
    ).toEqual([]);
    await conceder('produto-missao:read', { tipo: 'CICLO', cicloId: ciclo2 });
    expect(
      (await mobilidade.producao(usuario)).filter((p) => p.origem === 'MISSAO'),
    ).toEqual([]);
    await conceder('produto-missao:read', {
      tipo: 'REDE',
      redeId: base.redeId,
    });
    expect(
      (await mobilidade.producao(usuario)).filter((p) => p.origem === 'MISSAO'),
    ).toHaveLength(1);
  });

  it('HTTP separa leitura de produtos, valida CPF e aplica revogacao na proxima chamada', async () => {
    expect((await fetch(`${url}/bolsistas`)).status).toBe(403);
    await conceder('bolsa:read', alvo());
    let resposta = await fetch(`${url}/bolsistas/${dentro}`);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({
      cpf: null,
      email: null,
      telefone: null,
      produtos: [],
    });
    expect((await fetch(`${url}/bolsistas/${fora}`)).status).toBe(404);
    expect((await fetch(`${url}/bolsistas/referencias`)).status).toBe(403);
    await conceder('bolsa:edit', alvo());
    resposta = await fetch(`${url}/bolsistas/${dentro}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...edicao, cpf: '***.982.247-**' }),
    });
    expect(resposta.status).toBe(400);
    await ctx.db
      .delete(s.concessaoAcesso)
      .where(
        and(
          eq(s.concessaoAcesso.usuarioId, contaId),
          eq(s.concessaoAcesso.permissao, 'bolsa:read'),
        ),
      );
    expect((await fetch(`${url}/bolsistas/${dentro}`)).status).toBe(403);
  });
});
