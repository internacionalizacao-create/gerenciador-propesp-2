-- Confirma os nomes oficiais informados pelo comite da UNICAMP.
UPDATE "area_tematica" at
   SET "nome" = CASE at."codigo"
         WHEN 'UNICAMP-T2' THEN 'Educação, Saberes e Culturas'
         WHEN 'UNICAMP-T3' THEN 'Biodiversidade e Transformação Territorial Sustentável'
       END,
       "atualizado_em" = now()
  FROM "rede_coordenadora" rc, "ciclo" c, "programa" p
 WHERE at."rede_id" = rc."id"
   AND rc."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND at."codigo" IN ('UNICAMP-T2', 'UNICAMP-T3');--> statement-breakpoint
-- PEND-004 foi respondida pelos tetos anuais por tematica. A composicao das
-- bolsas continua separadamente em PEND-005 e PEN-013.
UPDATE "pendencia" pe
   SET "status" = 'RESOLVIDA',
       "resolucao" = 'A nova planilha definiu o orçamento de bolsas da UNICAMP por temática; a manutenção sem valor permanece tratada separadamente.',
       "resolvida_em" = coalesce(pe."resolvida_em", now()),
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE pe."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND pe."codigo" = 'PEND-004';--> statement-breakpoint
-- PROFSAUDE pertence somente a Saude, Natureza e Sociedade.
UPDATE "pendencia" pe
   SET "escopo_tipo" = 'AREA_TEMATICA',
       "escopo_descricao" = 'UNICAMP · UNICAMP-T1',
       "status" = 'RESOLVIDA',
       "resolucao" = 'A equipe confirmou que o PROFSAÚDE pertence apenas à UNICAMP-T1 — Saúde, Natureza e Sociedade.',
       "resolvida_em" = coalesce(pe."resolvida_em", now()),
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE pe."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND pe."codigo" = 'PEND-006';--> statement-breakpoint
-- No CAPES Global nao ha entrada em caixa nem execucao financeira na UEA.
UPDATE "pendencia" pe
   SET "escopo_tipo" = 'GERAL',
       "escopo_descricao" = 'GERAL · Todas',
       "assunto" = 'Fluxo financeiro institucional',
       "descricao" = 'Confirmar se os recursos do CAPES Global entram no caixa da UEA ou são pagos diretamente pela CAPES.',
       "impacto" = 'Define se o Gerenciador precisa acompanhar execução financeira interna.',
       "nivel_impacto" = 'ALTA',
       "responsavel_sugerido" = 'PROPESP / Rede coordenadora',
       "prazo_momento" = null,
       "status" = 'RESOLVIDA',
       "resolucao" = 'Todos os recursos são pagos diretamente pela CAPES; não há entrada em caixa nem execução financeira na UEA.',
       "resolvida_em" = coalesce(pe."resolvida_em", now()),
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE pe."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND pe."codigo" = 'PEN-011';--> statement-breakpoint
-- A classificacao e determinada pelo destino da mobilidade.
UPDATE "pendencia" pe
   SET "escopo_tipo" = 'GERAL',
       "escopo_descricao" = 'GERAL · Todas',
       "assunto" = 'Critério IN/OUT',
       "descricao" = 'Validar institucionalmente IN como entrada no Brasil e OUT como destino no exterior.',
       "impacto" = 'Define a classificação dos indicadores de mobilidade.',
       "nivel_impacto" = 'MEDIA',
       "responsavel_sugerido" = 'Comissão de Internacionalização',
       "prazo_momento" = null,
       "status" = 'RESOLVIDA',
       "resolucao" = 'IN significa entrada no Brasil e OUT significa destino no exterior.',
       "resolvida_em" = coalesce(pe."resolvida_em", now()),
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE pe."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND pe."codigo" = 'PEN-012';--> statement-breakpoint
-- Os tetos da UNICAMP estao definidos, mas a composicao das bolsas permanece
-- pendente. O item nao e encerrado nem consolidado sem decisao do produto.
UPDATE "pendencia" pe
   SET "escopo_tipo" = 'REDE',
       "escopo_descricao" = 'UNICAMP · Todas',
       "assunto" = 'Composição de bolsas da UNICAMP',
       "descricao" = 'Os orçamentos anuais por temática estão definidos, mas modalidades, quantidades, vigências, implementação e distribuição das bolsas ainda não foram definidas.',
       "impacto" = 'Impede calcular bolsas, beneficiários e custo da composição da UNICAMP.',
       "nivel_impacto" = 'ALTA',
       "responsavel_sugerido" = 'Comitê UNICAMP',
       "prazo_momento" = 'Após a definição das bolsas',
       "status" = 'PENDENTE',
       "resolucao" = null,
       "resolvida_em" = null,
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE pe."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND pe."codigo" = 'PEN-013';
