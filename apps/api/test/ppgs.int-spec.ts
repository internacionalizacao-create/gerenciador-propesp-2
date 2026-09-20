import { ConflictException } from '@nestjs/common';

import { IdentidadeService } from '../src/auth/identidade.service';
import { PpgsService, ppgSchema } from '../src/dominio/ppgs.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';

describe('Cadastro de PPGs', () => {
  let ctx: ContextoTeste;
  let ppgs: PpgsService;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    ppgs = new PpgsService(ctx.db, new IdentidadeService(ctx.db));
  });
  beforeEach(async () => ctx.limpar());
  afterAll(async () => ctx?.encerrar());

  it('grava o cadastro minimo com campos opcionais nulos', async () => {
    const criado = await ppgs.criar(
      ppgSchema.parse({
        nome: 'Programa de Teste',
        sigla: 'PPGT',
        notaCapes: null,
        nivel: null,
        modalidade: null,
        emRede: false,
        linhasPesquisa: [],
      }),
    );
    expect(criado).toMatchObject({
      sigla: 'PPGT',
      notaCapes: null,
      emRede: false,
      linhasPesquisa: [],
    });
    expect(criado.id).toBeDefined();
  });

  it('grava linhas de pesquisa e conceito CAPES nos limites aceitos', async () => {
    const criado = await ppgs.criar(
      ppgSchema.parse({
        nome: 'a'.repeat(300),
        sigla: 'PPGT',
        unidade: 'a'.repeat(200),
        areaCapes: 'a'.repeat(200),
        redeAcademica: 'a'.repeat(120),
        observacoes: 'a'.repeat(2000),
        notaCapes: 7,
        linhasPesquisa: ['a'.repeat(300)],
      }),
    );
    expect(criado.notaCapes).toBe(7);
    expect(criado.linhasPesquisa).toHaveLength(1);
    expect(criado.linhasPesquisa[0].nome).toHaveLength(300);
  });

  it('devolve erro de campo para cadastro com sigla repetida', async () => {
    const dto = ppgSchema.parse({ nome: 'Programa de Teste', sigla: 'PPGT' });
    await ppgs.criar(dto);
    try {
      await ppgs.criar(dto);
      throw new Error('Deveria recusar a sigla repetida.');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ConflictException);
      expect((erro as ConflictException).getResponse()).toMatchObject({
        erros: [
          {
            campo: 'sigla',
            mensagem:
              'Esta sigla já está cadastrada. Informe outra sigla ou edite o PPG existente.',
          },
        ],
      });
    }
  });

  it('recusa sigla repetida na edicao e preserva o cadastro anterior', async () => {
    await ppgs.criar(
      ppgSchema.parse({ nome: 'Primeiro programa', sigla: 'PPGA' }),
    );
    const outro = await ppgs.criar(
      ppgSchema.parse({ nome: 'Segundo programa', sigla: 'PPGB' }),
    );
    await expect(
      ppgs.atualizar(outro.id, { sigla: 'PPGA' }),
    ).rejects.toBeInstanceOf(ConflictException);
    const preservado = await ppgs.atualizar(outro.id, {});
    expect(preservado.sigla).toBe('PPGB');
  });
});
