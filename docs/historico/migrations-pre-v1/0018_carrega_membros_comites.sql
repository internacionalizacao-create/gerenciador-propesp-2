WITH dados(nome) AS (
  VALUES
    ('Roberto Sanches Mubarac Sobrinho'),
    ('Patricia Melchionna Albuquerque'),
    ('André Luiz Nunes Zogahib'),
    ('Andréa Monteiro Tarragô'),
    ('Jessica Mie Ferreira Koyama Takahashi'),
    ('Sara do Nascimento Maia'),
    ('Carlos Renato R. de Jesus'),
    ('Elisa Gomes de Lima'),
    ('João Victor Verçosa'),
    ('Katia de Abreu Chulata')
), uea AS (
  SELECT id FROM instituicao
   WHERE nome = 'Universidade do Estado do Amazonas'
   LIMIT 1
)
INSERT INTO pessoa (nome, tipo, instituicao_id)
SELECT d.nome, 'SERVIDOR'::tipo_pessoa, uea.id
  FROM dados d CROSS JOIN uea
 WHERE NOT EXISTS (
   SELECT 1 FROM pessoa p
    WHERE lower(p.nome) = lower(d.nome)
      AND p.instituicao_id = uea.id
 );--> statement-breakpoint

WITH dados(nome, tipo_equipe, funcao, redes, fontes) AS (
  VALUES
    ('Roberto Sanches Mubarac Sobrinho', 'COMITE_GESTOR'::tipo_equipe_gestao, 'Pró-reitor', 'UFMG, UNESP, UNICAMP', 'COMITE_MEMBROS_UFMG.pdf, COMITE_MEMBROS_UNESP.pdf, COMITE_MEMBROS_UNICAMP.pdf'),
    ('Patricia Melchionna Albuquerque', 'COMITE_GESTOR'::tipo_equipe_gestao, 'Presidente da Comissão de Internacionalização da Pós-Graduação', 'UFMG, UNESP, UNICAMP', 'COMITE_MEMBROS_UFMG.pdf, COMITE_MEMBROS_UNESP.pdf, COMITE_MEMBROS_UNICAMP.pdf'),
    ('André Luiz Nunes Zogahib', 'ADMINISTRACAO'::tipo_equipe_gestao, 'Reitor da Universidade do Estado do Amazonas', 'UFMG, UNESP, UNICAMP', 'COMITE_MEMBROS_UFMG.pdf, COMITE_MEMBROS_UNESP.pdf, COMITE_MEMBROS_UNICAMP.pdf'),
    ('Andréa Monteiro Tarragô', 'ADMINISTRACAO'::tipo_equipe_gestao, 'Vice-presidente da Comissão de Internacionalização da Pós-Graduação', 'UFMG, UNESP, UNICAMP', 'COMITE_MEMBROS_UFMG.pdf, COMITE_MEMBROS_UNESP.pdf, COMITE_MEMBROS_UNICAMP.pdf'),
    ('Jessica Mie Ferreira Koyama Takahashi', 'ADMINISTRACAO'::tipo_equipe_gestao, 'Coordenadora de Pesquisa', 'UFMG', 'COMITE_MEMBROS_UFMG.pdf'),
    ('Sara do Nascimento Maia', 'ADMINISTRACAO'::tipo_equipe_gestao, 'Técnica administrativa da Comissão de Internacionalização da Pós-Graduação', 'UFMG', 'COMITE_MEMBROS_UFMG.pdf'),
    ('Carlos Renato R. de Jesus', 'ADMINISTRACAO'::tipo_equipe_gestao, 'Coordenador de Pós-Graduação Lato Sensu', 'UNESP', 'COMITE_MEMBROS_UNESP.pdf'),
    ('Elisa Gomes de Lima', 'ADMINISTRACAO'::tipo_equipe_gestao, 'Técnica administrativa da Comissão de Internacionalização da Pós-Graduação', 'UNESP, UNICAMP', 'COMITE_MEMBROS_UNESP.pdf, COMITE_MEMBROS_UNICAMP.pdf'),
    ('João Victor Verçosa', 'ADMINISTRACAO'::tipo_equipe_gestao, 'Membro interno da Comissão de Internacionalização da Pós-Graduação', 'UNESP', 'COMITE_MEMBROS_UNESP.pdf'),
    ('Katia de Abreu Chulata', 'ADMINISTRACAO'::tipo_equipe_gestao, 'Membro interno da Comissão de Internacionalização da Pós-Graduação', 'UNICAMP', 'COMITE_MEMBROS_UNICAMP.pdf')
), contexto AS (
  SELECT c.id AS ciclo_id, i.id AS instituicao_id
    FROM ciclo c
    JOIN programa pr ON pr.id = c.programa_id
    JOIN instituicao i ON i.nome = 'Universidade do Estado do Amazonas'
   WHERE pr.slug = 'capes-global' AND c.nome = '2027-2030'
   LIMIT 1
)
INSERT INTO membro_equipe_gestao (
  ciclo_id, pessoa_id, tipo_equipe, funcao, data_inicio, observacoes
)
SELECT contexto.ciclo_id, p.id, d.tipo_equipe, d.funcao, DATE '2027-01-01',
       'Composição formal das redes ' || d.redes || '. Fontes: ' || d.fontes || '.'
  FROM dados d CROSS JOIN contexto
  JOIN pessoa p ON lower(p.nome) = lower(d.nome)
               AND p.instituicao_id = contexto.instituicao_id
 WHERE NOT EXISTS (
   SELECT 1 FROM membro_equipe_gestao m
    WHERE m.ciclo_id = contexto.ciclo_id
      AND m.pessoa_id = p.id
      AND m.tipo_equipe = d.tipo_equipe
      AND m.data_fim IS NULL
 );--> statement-breakpoint

WITH dados(nome, tipo_equipe, rede) AS (
  VALUES
    ('Roberto Sanches Mubarac Sobrinho', 'COMITE_GESTOR'::tipo_equipe_gestao, 'UFMG'),
    ('Roberto Sanches Mubarac Sobrinho', 'COMITE_GESTOR'::tipo_equipe_gestao, 'UNESP'),
    ('Roberto Sanches Mubarac Sobrinho', 'COMITE_GESTOR'::tipo_equipe_gestao, 'UNICAMP'),
    ('Patricia Melchionna Albuquerque', 'COMITE_GESTOR'::tipo_equipe_gestao, 'UFMG'),
    ('Patricia Melchionna Albuquerque', 'COMITE_GESTOR'::tipo_equipe_gestao, 'UNESP'),
    ('Patricia Melchionna Albuquerque', 'COMITE_GESTOR'::tipo_equipe_gestao, 'UNICAMP'),
    ('André Luiz Nunes Zogahib', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UFMG'),
    ('André Luiz Nunes Zogahib', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UNESP'),
    ('André Luiz Nunes Zogahib', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UNICAMP'),
    ('Andréa Monteiro Tarragô', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UFMG'),
    ('Andréa Monteiro Tarragô', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UNESP'),
    ('Andréa Monteiro Tarragô', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UNICAMP'),
    ('Jessica Mie Ferreira Koyama Takahashi', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UFMG'),
    ('Sara do Nascimento Maia', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UFMG'),
    ('Carlos Renato R. de Jesus', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UNESP'),
    ('Elisa Gomes de Lima', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UNESP'),
    ('Elisa Gomes de Lima', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UNICAMP'),
    ('João Victor Verçosa', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UNESP'),
    ('Katia de Abreu Chulata', 'ADMINISTRACAO'::tipo_equipe_gestao, 'UNICAMP')
), contexto AS (
  SELECT c.id AS ciclo_id, i.id AS instituicao_id
    FROM ciclo c
    JOIN programa pr ON pr.id = c.programa_id
    JOIN instituicao i ON i.nome = 'Universidade do Estado do Amazonas'
   WHERE pr.slug = 'capes-global' AND c.nome = '2027-2030'
   LIMIT 1
)
INSERT INTO membro_equipe_gestao_rede (membro_equipe_id, rede_id)
SELECT m.id, r.id
  FROM dados d CROSS JOIN contexto
  JOIN pessoa p ON lower(p.nome) = lower(d.nome)
               AND p.instituicao_id = contexto.instituicao_id
  JOIN membro_equipe_gestao m ON m.ciclo_id = contexto.ciclo_id
                              AND m.pessoa_id = p.id
                              AND m.tipo_equipe = d.tipo_equipe
                              AND m.data_fim IS NULL
  JOIN rede_coordenadora r ON r.ciclo_id = contexto.ciclo_id
                           AND r.nome = d.rede
ON CONFLICT (membro_equipe_id, rede_id) DO NOTHING;
