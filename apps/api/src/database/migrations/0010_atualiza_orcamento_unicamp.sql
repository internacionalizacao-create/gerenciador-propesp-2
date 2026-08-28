-- Atualiza somente os fatos orcamentarios informados pelo Comite UNICAMP.
-- As linhas de bolsa, suas quantidades e as concessoes nao sao alteradas.
UPDATE "orcamento_tematica" o
   SET "valor_bolsas" = CASE at."codigo"
         WHEN 'UNICAMP-T1' THEN 538291.22
         WHEN 'UNICAMP-T2' THEN 270894.75
         WHEN 'UNICAMP-T3' THEN 96835.65
         WHEN 'UNICAMP-T4' THEN 159067.37
       END,
       "custo_bolsas_informado" = CASE
         WHEN o."ano" <> 2027 THEN o."custo_bolsas_informado"
         WHEN at."codigo" = 'UNICAMP-T1' THEN 530737.40
         WHEN at."codigo" = 'UNICAMP-T2' THEN 331122.00
         WHEN at."codigo" = 'UNICAMP-T3' THEN 97308.80
         WHEN at."codigo" = 'UNICAMP-T4' THEN 173690.60
       END,
       "status" = 'DEFINIDO',
       "fonte" = 'Comitê por Área Temática - UNICAMP',
       "observacoes" = 'Orçamento anual e valor utilizado de 2027 informados pelo Comitê UNICAMP. A composição de bolsas será cadastrada manualmente; manutenção permanece a definir.',
       "atualizado_em" = now()
  FROM "area_tematica" at, "rede_coordenadora" rc, "ciclo" c, "programa" p
 WHERE o."area_tematica_id" = at."id"
   AND at."rede_id" = rc."id"
   AND rc."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND at."codigo" IN ('UNICAMP-T1', 'UNICAMP-T2', 'UNICAMP-T3', 'UNICAMP-T4')
   AND o."ano" BETWEEN 2027 AND 2030;--> statement-breakpoint
UPDATE "area_tematica" at
   SET "status_orcamento" = 'DEFINIDO',
       "atualizado_em" = now()
  FROM "rede_coordenadora" rc, "ciclo" c, "programa" p
 WHERE at."rede_id" = rc."id"
   AND rc."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND at."codigo" IN ('UNICAMP-T1', 'UNICAMP-T2', 'UNICAMP-T3', 'UNICAMP-T4');--> statement-breakpoint
UPDATE "rede_coordenadora" rc
   SET "status_orcamento" = 'DEFINIDO',
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE rc."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND rc."nome" = 'UNICAMP';
