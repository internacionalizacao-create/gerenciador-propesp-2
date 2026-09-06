CREATE TYPE "public"."avaliacao_objetivos" AS ENUM('SIM', 'PARCIALMENTE', 'NAO');--> statement-breakpoint
CREATE TABLE "dispensa_requisito_encerramento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"chave" varchar(80) NOT NULL,
	"justificativa" text NOT NULL,
	"dispensada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"dispensada_por" varchar(200),
	"dispensada_por_id" varchar(120),
	"revogada_em" timestamp with time zone,
	"revogada_por" varchar(200),
	"revogada_justificativa" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispensa_requisito_revogacao_ck" CHECK (("dispensa_requisito_encerramento"."revogada_em" is null) = ("dispensa_requisito_encerramento"."revogada_por" is null)
       and ("dispensa_requisito_encerramento"."revogada_em" is not null or "dispensa_requisito_encerramento"."revogada_justificativa" is null))
);
--> statement-breakpoint
ALTER TABLE "missao_comite" ADD COLUMN "avaliacao_objetivos" "avaliacao_objetivos";--> statement-breakpoint
ALTER TABLE "missao_comite" ADD COLUMN "avaliacao_justificativa" text;--> statement-breakpoint
ALTER TABLE "missao_comite" ADD COLUMN "desdobramentos" text;--> statement-breakpoint
ALTER TABLE "dispensa_requisito_encerramento" ADD CONSTRAINT "dispensa_requisito_encerramento_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dispensa_requisito_vigente_uk" ON "dispensa_requisito_encerramento" USING btree ("missao_id","chave") WHERE "dispensa_requisito_encerramento"."revogada_em" is null;--> statement-breakpoint
CREATE INDEX "dispensa_requisito_missao_idx" ON "dispensa_requisito_encerramento" USING btree ("missao_id");--> statement-breakpoint
ALTER TABLE "missao_comite" ADD CONSTRAINT "missao_comite_avaliacao_ck" CHECK (("missao_comite"."avaliacao_objetivos" is not null
            or "missao_comite"."avaliacao_justificativa" is null)
       and ("missao_comite"."avaliacao_objetivos" is null
            or "missao_comite"."avaliacao_objetivos" = 'SIM'
            or "missao_comite"."avaliacao_justificativa" is not null));