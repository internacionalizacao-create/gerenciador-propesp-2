-- A equipe confirmou que o calculo da UNESP-T3 e a referencia correta para
-- PEND-001. O saldo divergente do anexo deixa de ser uma fonte valida.
UPDATE "orcamento_tematica" o
   SET "saldo_informado" = 1457.39,
       "observacoes" = 'A equipe validou o saldo calculado de R$ 1.457,39 e orientou desconsiderar o valor divergente do anexo.',
       "atualizado_em" = now()
  FROM "area_tematica" at, "rede_coordenadora" rc, "ciclo" c, "programa" p
 WHERE o."area_tematica_id" = at."id"
   AND at."rede_id" = rc."id"
   AND rc."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND at."codigo" = 'UNESP-T3'
   AND o."ano" = 2027;--> statement-breakpoint
UPDATE "pendencia" pe
   SET "status" = 'RESOLVIDA',
       "resolucao" = 'A equipe validou o cálculo de R$ 1.457,39 para a UNESP-T3 e orientou desconsiderar o valor divergente do anexo.',
       "resolvida_em" = coalesce(pe."resolvida_em", now()),
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE pe."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND pe."codigo" = 'PEND-001';
