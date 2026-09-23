CREATE TYPE "public"."tipo_equipe_gestao" AS ENUM('COMITE_GESTOR', 'ADMINISTRACAO');--> statement-breakpoint
CREATE TABLE "membro_equipe_gestao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"tipo_equipe" "tipo_equipe_gestao" NOT NULL,
	"funcao" varchar(160) NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membro_equipe_gestao_periodo_ck" CHECK ("membro_equipe_gestao"."data_fim" is null or "membro_equipe_gestao"."data_fim" >= "membro_equipe_gestao"."data_inicio")
);
--> statement-breakpoint
ALTER TABLE "membro_equipe_gestao" ADD CONSTRAINT "membro_equipe_gestao_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membro_equipe_gestao" ADD CONSTRAINT "membro_equipe_gestao_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "membro_equipe_gestao_inicio_uk" ON "membro_equipe_gestao" USING btree ("ciclo_id","pessoa_id","tipo_equipe","data_inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "membro_equipe_gestao_ativo_uk" ON "membro_equipe_gestao" USING btree ("ciclo_id","pessoa_id","tipo_equipe") WHERE "membro_equipe_gestao"."data_fim" is null;--> statement-breakpoint
CREATE INDEX "membro_equipe_gestao_ciclo_idx" ON "membro_equipe_gestao" USING btree ("ciclo_id");--> statement-breakpoint
CREATE INDEX "membro_equipe_gestao_pessoa_idx" ON "membro_equipe_gestao" USING btree ("pessoa_id");