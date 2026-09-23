-- A capacidade que PEND-007 monitorava agora existe por exercicio e tem auditoria.
-- As pendencias da composicao da UNICAMP permanecem abertas: a tela permite
-- registrar o dado futuro, mas nao substitui a decisao externa do comite.
UPDATE "pendencia" pe
   SET "status" = 'RESOLVIDA',
       "resolucao" = 'O orçamento passou a ser registrado por área temática e exercício, com edição restrita à gestão, justificativa e auditoria de cada campo alterado.',
       "resolvida_em" = now(),
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE pe."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND pe."codigo" = 'PEND-007'
   AND pe."status" <> 'RESOLVIDA';
