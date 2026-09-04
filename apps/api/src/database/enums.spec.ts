import * as s from './schema';

/**
 * Enums do modulo do Comite Gestor (CG-010).
 *
 * O criterio da task e "sem duplicacao semantica": cada vocabulario tem uma
 * fonte so, o enum do banco, e o codigo deriva dela. Estes testes existem para
 * que acrescentar um estado na migration e esquecer de propagar quebre aqui, e
 * nao em producao com um valor que o banco aceita e a API recusa.
 */
describe('Enums do modulo (CG-010)', () => {
  it('tem os enums que a task enumera', () => {
    expect(s.tipoEquipeGestaoEnum.enumValues).toEqual([
      'COMITE_GESTOR',
      'ADMINISTRACAO',
    ]);
    expect(s.papelMissaoEnum.enumValues).toEqual([
      'RESPONSAVEL',
      'PARTICIPANTE',
      'APOIO',
    ]);
    expect(s.statusMissaoComiteEnum.enumValues).toEqual([
      'RASCUNHO',
      'PLANEJADA',
      'CONFIRMADA',
      'CONCLUIDA',
      'CANCELADA',
    ]);
    expect(s.statusAtividadeMissaoEnum.enumValues).toContain('PLANEJADA');
    expect(s.tipoMissaoEnum.enumValues).toContain('VISITA_TECNICA');
  });

  it('separa a situacao da prestacao do estado gravado', () => {
    // `NAO_INICIADA` nao pode existir no banco: ausencia de prestacao e
    // ausencia de linha. Se alguem acrescentar esse valor ao enum, toda missao
    // passaria a precisar de uma prestacao vazia para dizer que nao comecou.
    expect(s.statusPrestacaoMissaoEnum.enumValues).toEqual([
      'EM_PREENCHIMENTO',
      'ENVIADA',
      'COM_PENDENCIA',
      'VALIDADA',
    ]);
    expect(s.statusPrestacaoMissaoEnum.enumValues).not.toContain(
      'NAO_INICIADA',
    );
  });

  it('tem os tipos de despesa homologados na CG-009', () => {
    // A lista e a da secao 24 do documento da equipe de orcamento. Passagem e
    // diaria vem primeiro por serem as unicas com tabela de especializacao.
    expect(s.tipoDespesaMissaoEnum.enumValues).toEqual([
      'PASSAGEM',
      'DIARIA',
      'HOSPEDAGEM',
      'TRANSPORTE',
      'INSCRICAO_EVENTO',
      'SEGURO',
      'OUTRA',
    ]);
  });

  it('nao confunde despesa da missao com despesa da estrutura generica', () => {
    // `tipo_despesa` ja existia para a execucao financeira generica (P11, fora
    // do escopo do CAPES Global). Sao vocabularios diferentes e nao devem ser
    // fundidos so porque o nome se parece.
    expect(s.tipoDespesaEnum.enumValues).not.toEqual(
      s.tipoDespesaMissaoEnum.enumValues,
    );
  });
});
