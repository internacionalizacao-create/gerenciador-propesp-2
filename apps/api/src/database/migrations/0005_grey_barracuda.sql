CREATE TYPE "public"."status_composicao_anual" AS ENUM('A_DEFINIR', 'EM_ELABORACAO', 'APROVADA');--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "cpf" char(11);--> statement-breakpoint
ALTER TABLE "orcamento_tematica" ADD COLUMN "status_composicao" "status_composicao_anual" DEFAULT 'A_DEFINIR' NOT NULL;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD COLUMN "pais_destino_nome" varchar(120);--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD COLUMN "instituicao_destino_nome" varchar(240);--> statement-breakpoint
CREATE UNIQUE INDEX "pessoa_cpf_uk" ON "pessoa" USING btree ("cpf");--> statement-breakpoint
-- A carga anterior repetia artificialmente a composicao de 2027. Naquele
-- momento a interface nao permitia editar anos isolados, portanto essas copias
-- nao representam decisoes do usuario e devem voltar para "a definir".
UPDATE "planejamento_anual" pa
   SET "quantidade" = 0,
       "atualizado_em" = now()
  FROM "item_planejado" ip,
       "ciclo" c,
       "programa" p
 WHERE pa."item_planejado_id" = ip."id"
   AND ip."ciclo_id" = c."id"
   AND c."programa_id" = p."id"
   AND p."slug" = 'capes-global'
   AND pa."ano" > 2027;--> statement-breakpoint
UPDATE "orcamento_tematica" o
   SET "status_composicao" = 'APROVADA'
  FROM "area_tematica" at,
       "rede_coordenadora" rc
 WHERE o."area_tematica_id" = at."id"
   AND at."rede_id" = rc."id"
   AND o."ano" = 2027
   AND rc."nome" IN ('UNESP', 'UFMG');
