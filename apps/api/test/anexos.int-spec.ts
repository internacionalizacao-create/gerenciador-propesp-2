import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AuthUser } from '../src/auth/auth-user';
import { ArmazenamentoService } from '../src/arquivos/armazenamento.service';
import * as s from '../src/database/schema';
import {
  AnexosService,
  type ArquivoRecebido,
} from '../src/dominio/anexos.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-anexos',
  name: 'Admin de Anexos',
  roles: ['admin'],
  permissions: [
    'missao:read',
    'missao:edit',
    'prestacao:read',
    'prestacao:write',
    'parceiro:read',
    'parceiro:write',
  ],
};

/** Tem leitura de missao, mas nenhuma permissao de prestacao nem de parceiro. */
const somenteMissao: AuthUser = {
  id: 'leitor-missao',
  name: 'Leitor de Missões',
  roles: ['coordenador'],
  permissions: ['missao:read'],
};

const bytes = (hex: string, sobra = 64) =>
  Buffer.concat([Buffer.from(hex, 'hex'), Buffer.alloc(sobra, 0x41)]);

const arquivo = (nome: string, conteudo: Buffer): ArquivoRecebido => ({
  originalname: nome,
  buffer: conteudo,
  size: conteudo.length,
});

const PDF = () => arquivo('projeto.pdf', bytes('255044462d312e34'));
const PNG = () => arquivo('foto.png', bytes('89504e470d0a1a0a'));
const EXE = () => arquivo('nota.pdf', bytes('4d5a90000300'));

describe('AnexosService (CG-051)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: AnexosService;
  let raiz: string;
  let missaoId: string;
  let parceiroId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    raiz = await mkdtemp(join(tmpdir(), 'anexos-teste-'));
    process.env.ARQUIVOS_DIR = raiz;
    service = new AnexosService(ctx.db, new ArmazenamentoService());
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
        codigo: 'MCG-600',
        titulo: 'Missão com documentos',
        objetivo: 'Testar anexos',
        dataInicio: '2027-03-01',
        dataFim: '2027-03-10',
      })
      .returning({ id: s.missaoComite.id });
    missaoId = missao.id;

    const [parceiro] = await ctx.db
      .insert(s.instituicao)
      .values({
        nome: 'Universidade Anexo',
        nomeNormalizado: 'universidade anexo',
        tipo: 'PARCEIRA_INTERNACIONAL',
      })
      .returning({ id: s.instituicao.id });
    parceiroId = parceiro.id;
  });

  function envio(sobrescrever: Record<string, unknown> = {}) {
    return {
      entidadeTipo: 'MISSAO_COMITE' as const,
      entidadeId: missaoId,
      categoria: 'PROJETO' as const,
      visibilidade: 'INTERNA' as const,
      ...sobrescrever,
    } as never;
  }

  it('guarda o arquivo, calcula o hash e nunca devolve o caminho', async () => {
    const salvo = await service.enviar(envio(), PDF(), admin);

    expect(salvo).toMatchObject({
      nome: 'projeto.pdf',
      mimeType: 'application/pdf',
      categoria: 'PROJETO',
      versao: 1,
      ativo: true,
    });
    // SHA-256 tem 64 hexadecimais.
    expect(salvo.hashSha256).toMatch(/^[0-9a-f]{64}$/);
    // O caminho interno nao pode vazar em campo nenhum da resposta.
    expect(JSON.stringify(salvo)).not.toContain(raiz);
    expect('caminho' in salvo).toBe(false);
  });

  it('a chave de armazenamento nao contem o nome enviado', async () => {
    // Nome vira caminho previsivel e vaza dado; por isso a chave e opaca.
    const salvo = await service.enviar(envio(), PDF(), admin);
    const [linha] = await ctx.db.select().from(s.anexo);
    expect(linha.caminho).not.toContain('projeto');
    expect(linha.caminho).toMatch(/^\d{4}\/[0-9a-f-]{36}$/);
    expect(linha.id).toBe(salvo.id);
  });

  it('recusa executavel com extensao de PDF', async () => {
    // O criterio de aceite: arquivo invalido e recusado.
    await expect(service.enviar(envio(), EXE(), admin)).rejects.toThrow(
      /Formato nao aceito/i,
    );
    // E nada foi gravado em disco nem no banco.
    expect(await ctx.db.select().from(s.anexo)).toEqual([]);
  });

  it('recusa arquivo acima do limite', async () => {
    const gigante = arquivo(
      'grande.pdf',
      Buffer.concat([
        Buffer.from('255044462d312e34', 'hex'),
        Buffer.alloc(26 * 1024 * 1024, 0x41),
      ]),
    );
    await expect(service.enviar(envio(), gigante, admin)).rejects.toThrow(
      /excede o limite/i,
    );
  });

  it('recusa upload apontando para entidade inexistente', async () => {
    // `entidade_id` nao tem chave estrangeira; sem esta checagem o upload
    // criaria um orfao no ato.
    await expect(
      service.enviar(
        envio({ entidadeId: '11111111-1111-4111-8111-111111111111' }),
        PDF(),
        admin,
      ),
    ).rejects.toThrow(/nao existe/i);
  });

  it('aplica a permissao da entidade de destino, nao uma do documento', async () => {
    // Quem so tem `missao:read` le documento de missao, mas nao anexa nela nem
    // enxerga documento de parceiro.
    await service.enviar(envio(), PDF(), admin);

    expect(
      await service.listar(
        {
          entidadeTipo: 'MISSAO_COMITE',
          entidadeId: missaoId,
          incluirInativos: false,
        },
        somenteMissao,
      ),
    ).toHaveLength(1);

    await expect(service.enviar(envio(), PDF(), somenteMissao)).rejects.toThrow(
      /missao:edit/,
    );

    await expect(
      service.listar(
        {
          entidadeTipo: 'INSTITUICAO',
          entidadeId: parceiroId,
          incluirInativos: false,
        },
        somenteMissao,
      ),
    ).rejects.toThrow(/parceiro:read/);
  });

  it('substituir cria versao nova e preserva a anterior', async () => {
    const primeira = await service.enviar(envio(), PDF(), admin);
    const segunda = await service.substituir(primeira.id, PNG(), admin);

    expect(segunda).toMatchObject({
      versao: 2,
      substituiId: primeira.id,
      ativo: true,
      nome: 'foto.png',
    });

    // A anterior sai da listagem, mas continua existindo e legivel pelo id —
    // um parecer que a citou precisa continuar podendo mostra-la.
    const ativos = await service.listar(
      {
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missaoId,
        incluirInativos: false,
      },
      admin,
    );
    expect(ativos.map((a) => a.id)).toEqual([segunda.id]);

    const baixada = await service.baixar(primeira.id, admin);
    expect(baixada.nome).toBe('projeto.pdf');

    // Os dois arquivos coexistem no armazenamento.
    const anos = await readdir(raiz);
    const gravados = await readdir(join(raiz, anos[0]));
    expect(gravados.length).toBeGreaterThanOrEqual(2);
  });

  it('historico devolve a cadeia de versoes, da mais nova para a mais antiga', async () => {
    const v1 = await service.enviar(envio(), PDF(), admin);
    const v2 = await service.substituir(v1.id, PNG(), admin);
    const v3 = await service.substituir(v2.id, PDF(), admin);

    const historico = await service.historico(v3.id, admin);
    expect(historico.map((a) => a.versao)).toEqual([3, 2, 1]);
    expect(historico.map((a) => a.id)).toEqual([v3.id, v2.id, v1.id]);
  });

  it('documento restrito nao aparece nem baixa para quem nao enviou', async () => {
    // A CG-057 exige que a galeria nao exponha arquivo privado; sem visibilidade
    // essa exigencia nao teria como ser cumprida.
    const restrito = await service.enviar(
      envio({ visibilidade: 'RESTRITA' }),
      PDF(),
      admin,
    );

    expect(
      await service.listar(
        {
          entidadeTipo: 'MISSAO_COMITE',
          entidadeId: missaoId,
          incluirInativos: false,
        },
        somenteMissao,
      ),
    ).toEqual([]);

    await expect(service.baixar(restrito.id, somenteMissao)).rejects.toThrow(
      /restrito/i,
    );

    // Quem enviou continua vendo.
    expect((await service.baixar(restrito.id, admin)).nome).toBe('projeto.pdf');
  });

  it('inativar exige justificativa e deixa trilha, sem apagar', async () => {
    const salvo = await service.enviar(envio(), PDF(), admin);
    const depois = await service.inativar(
      salvo.id,
      { justificativa: 'Documento enviado por engano.' },
      admin,
    );
    expect(depois.ativo).toBe(false);

    // Nao ha exclusao: o arquivo continua no banco e baixavel pelo id.
    expect(await ctx.db.select().from(s.anexo)).toHaveLength(1);
    expect((await service.baixar(salvo.id, admin)).nome).toBe('projeto.pdf');

    const trilha = await ctx.db.select().from(s.registroAuditoria);
    expect(trilha).toEqual([
      expect.objectContaining({
        entidadeTipo: 'ANEXO',
        acao: 'EXCLUSAO',
        justificativa: 'Documento enviado por engano.',
      }),
    ]);
  });

  it('anexa a parceiro com a permissao de parceiro', async () => {
    const salvo = await service.enviar(
      envio({
        entidadeTipo: 'INSTITUICAO',
        entidadeId: parceiroId,
        categoria: 'OUTRO',
      }),
      PDF(),
      admin,
    );
    expect(salvo.entidadeTipo).toBe('INSTITUICAO');
  });
});
