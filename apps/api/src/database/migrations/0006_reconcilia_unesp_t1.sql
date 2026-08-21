-- A composicao atualizada da UNESP-T1 foi confirmada pela equipe ao responder
-- PEND-002. Ela tambem reconcilia PEND-003: o custo de R$ 261.095,80 deixa
-- exatamente R$ 268,75 do teto de R$ 261.364,55.
UPDATE "item_planejado" ip
   SET "texto_fonte" = '1 bolsa de Doutorado Sanduíche de 6 meses (REAMEC).',
       "validacao_pendencia" = 'Conforme composição atualizada confirmada pela equipe.',
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE ip."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND ip."codigo" = 'BOL-006';--> statement-breakpoint
UPDATE "item_planejado" ip
   SET "status" = 'CANCELADO',
       "validacao_pendencia" = 'Linha substituída pela composição atualizada da UNESP-T1; preservada apenas como histórico.',
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE ip."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND ip."codigo" = 'BOL-007';--> statement-breakpoint
UPDATE "item_planejado" ip
   SET "vigencia_meses" = 5.0,
       "item_catalogo_id" = (
         SELECT ic."id"
           FROM "item_catalogo_bolsa" ic
           JOIN "modalidade" m ON m."id" = ic."modalidade_id"
           JOIN "tabela_valores" tv ON tv."id" = ic."tabela_valores_id"
           JOIN "programa" pc ON pc."id" = tv."programa_id"
          WHERE pc."slug" = 'capes-global'
            AND ic."destino" = 'EXTERIOR'
            AND m."nome" = 'Doutorado Sanduíche'
            AND ic."vigencia_meses" = 5.0
          LIMIT 1
       ),
       "texto_fonte" = '1 bolsa de Doutorado Sanduíche de 5 meses (PPGEEC), no valor de R$ 71.896,90.',
       "validacao_pendencia" = 'Vigência de 5 meses confirmada pela equipe na composição atualizada.',
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE ip."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND ip."codigo" = 'BOL-008';--> statement-breakpoint
UPDATE "item_planejado" ip
   SET "vigencia_meses" = 0.5,
       "item_catalogo_id" = (
         SELECT ic."id"
           FROM "item_catalogo_bolsa" ic
           JOIN "modalidade" m ON m."id" = ic."modalidade_id"
           JOIN "tabela_valores" tv ON tv."id" = ic."tabela_valores_id"
           JOIN "programa" pc ON pc."id" = tv."programa_id"
          WHERE pc."slug" = 'capes-global'
            AND ic."destino" = 'EXTERIOR'
            AND m."nome" = 'Capacitação'
            AND ic."vigencia_meses" = 0.5
          LIMIT 1
       ),
       "texto_fonte" = '1 bolsa de Capacitação de 15 dias (PPGEEC), no valor de R$ 22.669,60.',
       "validacao_pendencia" = 'Conforme composição atualizada confirmada pela equipe.',
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE ip."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND ip."codigo" = 'BOL-009';--> statement-breakpoint
UPDATE "item_planejado" ip
   SET "quantidade_anual" = 3,
       "vigencia_meses" = 1.0,
       "item_catalogo_id" = (
         SELECT ic."id"
           FROM "item_catalogo_bolsa" ic
           JOIN "modalidade" m ON m."id" = ic."modalidade_id"
           JOIN "tabela_valores" tv ON tv."id" = ic."tabela_valores_id"
           JOIN "programa" pc ON pc."id" = tv."programa_id"
          WHERE pc."slug" = 'capes-global'
            AND ic."destino" = 'EXTERIOR'
            AND m."nome" = 'Capacitação'
            AND ic."vigencia_meses" = 1.0
          LIMIT 1
       ),
       "texto_fonte" = '3 bolsas de Capacitação de 1 mês (PPGICH), totalizando R$ 83.627,10.',
       "validacao_pendencia" = 'Conforme composição atualizada confirmada pela equipe.',
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE ip."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND ip."codigo" = 'BOL-010';--> statement-breakpoint
UPDATE "planejamento_anual" pa
   SET "quantidade" = ip."quantidade_anual",
       "atualizado_em" = now()
  FROM "item_planejado" ip, "ciclo" c, "programa" p
 WHERE pa."item_planejado_id" = ip."id"
   AND ip."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND pa."ano" = 2027
   AND ip."codigo" IN ('BOL-006', 'BOL-008', 'BOL-009', 'BOL-010');--> statement-breakpoint
UPDATE "orcamento_tematica" o
   SET "custo_bolsas_informado" = 261095.80,
       "saldo_informado" = 268.75,
       "observacoes" = 'Composição atualizada confirmada pela equipe: custo de R$ 261.095,80 e saldo de R$ 268,75, conciliados sem divergência.',
       "atualizado_em" = now()
  FROM "area_tematica" at, "rede_coordenadora" rc, "ciclo" c, "programa" p
 WHERE o."area_tematica_id" = at."id"
   AND at."rede_id" = rc."id"
   AND rc."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND at."codigo" = 'UNESP-T1'
   AND o."ano" = 2027;--> statement-breakpoint
UPDATE "pendencia" pe
   SET "status" = 'RESOLVIDA',
       "resolucao" = CASE pe."codigo"
         WHEN 'PEND-002' THEN 'A composição atualizada confirma vigência de 5 meses para a BOL-008.'
         WHEN 'PEND-003' THEN 'A composição atualizada totaliza R$ 261.095,80 e deixa saldo de R$ 268,75 na UNESP-T1, sem divergência.'
       END,
       "resolvida_em" = now(),
       "atualizado_em" = now()
  FROM "ciclo" c, "programa" p
 WHERE pe."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND pe."codigo" IN ('PEND-002', 'PEND-003');
