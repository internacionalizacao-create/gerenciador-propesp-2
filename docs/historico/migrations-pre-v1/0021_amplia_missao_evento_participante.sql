CREATE TYPE "public"."tipo_relacionamento_missao" AS ENUM('REUNIAO_INSTITUCIONAL', 'COOPERACAO_ACADEMICA', 'PESQUISA', 'MOBILIDADE', 'CONVENIO', 'PROJETO', 'EVENTO', 'VISITA_TECNICA', 'OUTRO');--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD COLUMN "estado_regiao" varchar(120);--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD COLUMN "local" varchar(240);--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD COLUMN "endereco" text;--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD COLUMN "contato_instituicao_id" uuid;--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD COLUMN "tipo_relacionamento" "tipo_relacionamento_missao";--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD COLUMN "objetivo_relacionamento" text;--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD COLUMN "evento_tipo" varchar(160);--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD COLUMN "evento_site" varchar(500);--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD COLUMN "objetivo_participacao" text;--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD COLUMN "relacao_internacionalizacao" text;--> statement-breakpoint
ALTER TABLE "missao_comite" ADD COLUMN "tipo" "tipo_missao";--> statement-breakpoint
ALTER TABLE "missao_comite" ADD COLUMN "unidade_departamento" varchar(240);--> statement-breakpoint
ALTER TABLE "missao_participante" ADD COLUMN "cargo" varchar(160);--> statement-breakpoint
ALTER TABLE "missao_participante" ADD COLUMN "area" varchar(160);--> statement-breakpoint
ALTER TABLE "missao_participante" ADD COLUMN "data_inicio" date;--> statement-breakpoint
ALTER TABLE "missao_participante" ADD COLUMN "data_fim" date;--> statement-breakpoint
-- O modelo anterior so representava participacao durante a missao inteira. O
-- backfill preserva exatamente essa semantica, sem inventar um periodo parcial.
UPDATE "missao_participante" AS "mp"
SET "data_inicio" = "m"."data_inicio",
	"data_fim" = "m"."data_fim"
FROM "missao_comite" AS "m"
WHERE "m"."id" = "mp"."missao_id";--> statement-breakpoint
ALTER TABLE "missao_participante" ALTER COLUMN "data_inicio" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "missao_participante" ALTER COLUMN "data_fim" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD CONSTRAINT "atividade_missao_contato_instituicao_id_contato_instituicao_id_fk" FOREIGN KEY ("contato_instituicao_id") REFERENCES "public"."contato_instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atividade_missao_contato_idx" ON "atividade_missao" USING btree ("contato_instituicao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "missao_participante_responsavel_uk" ON "missao_participante" USING btree ("missao_id") WHERE "missao_participante"."papel" = 'RESPONSAVEL';--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD CONSTRAINT "atividade_missao_contato_instituicao_ck" CHECK ("atividade_missao"."contato_instituicao_id" is null or "atividade_missao"."instituicao_id" is not null);--> statement-breakpoint
ALTER TABLE "missao_participante" ADD CONSTRAINT "missao_participante_periodo_ck" CHECK ("missao_participante"."data_fim" >= "missao_participante"."data_inicio");
