/**
 * Composicoes formalizadas nos tres PDFs recebidos em 2026-09-01.
 *
 * A repeticao entre redes e intencional: a seed consolida a pessoa em um unico
 * vinculo de equipe e preserva as redes na tabela de associacao.
 */
export const composicoesComiteGestor = [
  ...gestao('UFMG', 'COMITE_MEMBROS_UFMG.pdf'),
  ...administracao('UFMG', 'COMITE_MEMBROS_UFMG.pdf', [
    [
      'André Luiz Nunes Zogahib',
      'Reitor da Universidade do Estado do Amazonas',
    ],
    [
      'Andréa Monteiro Tarragô',
      'Vice-presidente da Comissão de Internacionalização da Pós-Graduação',
    ],
    ['Jessica Mie Ferreira Koyama Takahashi', 'Coordenadora de Pesquisa'],
    [
      'Sara do Nascimento Maia',
      'Técnica administrativa da Comissão de Internacionalização da Pós-Graduação',
    ],
  ]),
  ...gestao('UNESP', 'COMITE_MEMBROS_UNESP.pdf'),
  ...administracao('UNESP', 'COMITE_MEMBROS_UNESP.pdf', [
    [
      'André Luiz Nunes Zogahib',
      'Reitor da Universidade do Estado do Amazonas',
    ],
    ['Carlos Renato R. de Jesus', 'Coordenador de Pós-Graduação Lato Sensu'],
    [
      'Andréa Monteiro Tarragô',
      'Vice-presidente da Comissão de Internacionalização da Pós-Graduação',
    ],
    [
      'Elisa Gomes de Lima',
      'Técnica administrativa da Comissão de Internacionalização da Pós-Graduação',
    ],
    [
      'João Victor Verçosa',
      'Membro interno da Comissão de Internacionalização da Pós-Graduação',
    ],
  ]),
  ...gestao('UNICAMP', 'COMITE_MEMBROS_UNICAMP.pdf'),
  ...administracao('UNICAMP', 'COMITE_MEMBROS_UNICAMP.pdf', [
    [
      'André Luiz Nunes Zogahib',
      'Reitor da Universidade do Estado do Amazonas',
    ],
    [
      'Andréa Monteiro Tarragô',
      'Vice-presidente da Comissão de Internacionalização da Pós-Graduação',
    ],
    [
      'Elisa Gomes de Lima',
      'Técnica administrativa da Comissão de Internacionalização da Pós-Graduação',
    ],
    [
      'Katia de Abreu Chulata',
      'Membro interno da Comissão de Internacionalização da Pós-Graduação',
    ],
  ]),
] as const;

type Rede = 'UFMG' | 'UNESP' | 'UNICAMP';
type TipoEquipe = 'COMITE_GESTOR' | 'ADMINISTRACAO';
type PessoaFuncao = readonly [nome: string, funcao: string];

function gestao(rede: Rede, fonte: string) {
  return montar(rede, fonte, 'COMITE_GESTOR', [
    ['Roberto Sanches Mubarac Sobrinho', 'Pró-reitor'],
    [
      'Patricia Melchionna Albuquerque',
      'Presidente da Comissão de Internacionalização da Pós-Graduação',
    ],
  ]);
}

function administracao(
  rede: Rede,
  fonte: string,
  pessoas: readonly PessoaFuncao[],
) {
  return montar(rede, fonte, 'ADMINISTRACAO', pessoas);
}

function montar(
  rede: Rede,
  fonte: string,
  tipoEquipe: TipoEquipe,
  pessoas: readonly PessoaFuncao[],
) {
  return pessoas.map(([nome, funcao]) => ({
    rede,
    fonte,
    tipoEquipe,
    nome,
    funcao,
  }));
}
