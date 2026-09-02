CREATE TYPE "public"."papel_missao" AS ENUM('RESPONSAVEL', 'PARTICIPANTE', 'APOIO');--> statement-breakpoint
CREATE TYPE "public"."status_atividade_missao" AS ENUM('PLANEJADA', 'REALIZADA', 'NAO_REALIZADA');--> statement-breakpoint
CREATE TYPE "public"."status_missao_comite" AS ENUM('RASCUNHO', 'PLANEJADA', 'CONFIRMADA', 'CONCLUIDA', 'CANCELADA');--> statement-breakpoint
CREATE TABLE "atividade_missao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"tipo" "tipo_missao" NOT NULL,
	"titulo" varchar(300) NOT NULL,
	"pais_id" uuid NOT NULL,
	"cidade" varchar(120),
	"instituicao_id" uuid,
	"instituicao_nome" varchar(240),
	"evento_nome" varchar(300),
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"planejamento" text,
	"relato_realizado" text,
	"resultados" text,
	"status" "status_atividade_missao" DEFAULT 'PLANEJADA' NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "atividade_missao_ordem_ck" CHECK ("atividade_missao"."ordem" >= 0),
	CONSTRAINT "atividade_missao_periodo_ck" CHECK ("atividade_missao"."data_fim" >= "atividade_missao"."data_inicio"),
	CONSTRAINT "atividade_missao_instituicao_ck" CHECK (num_nonnulls("atividade_missao"."instituicao_id", "atividade_missao"."instituicao_nome") <= 1)
);
--> statement-breakpoint
CREATE TABLE "missao_comite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"titulo" varchar(300) NOT NULL,
	"objetivo" text NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"status" "status_missao_comite" DEFAULT 'RASCUNHO' NOT NULL,
	"relato_geral" text,
	"resultados" text,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "missao_comite_periodo_ck" CHECK ("missao_comite"."data_fim" >= "missao_comite"."data_inicio")
);
--> statement-breakpoint
CREATE TABLE "missao_participante" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"membro_equipe_id" uuid,
	"papel" "papel_missao" DEFAULT 'PARTICIPANTE' NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD CONSTRAINT "atividade_missao_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD CONSTRAINT "atividade_missao_pais_id_pais_id_fk" FOREIGN KEY ("pais_id") REFERENCES "public"."pais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD CONSTRAINT "atividade_missao_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missao_comite" ADD CONSTRAINT "missao_comite_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missao_participante" ADD CONSTRAINT "missao_participante_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missao_participante" ADD CONSTRAINT "missao_participante_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missao_participante" ADD CONSTRAINT "missao_participante_membro_equipe_id_membro_equipe_gestao_id_fk" FOREIGN KEY ("membro_equipe_id") REFERENCES "public"."membro_equipe_gestao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "atividade_missao_ordem_uk" ON "atividade_missao" USING btree ("missao_id","ordem");--> statement-breakpoint
CREATE INDEX "atividade_missao_missao_idx" ON "atividade_missao" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "atividade_missao_pais_idx" ON "atividade_missao" USING btree ("pais_id");--> statement-breakpoint
CREATE INDEX "atividade_missao_instituicao_idx" ON "atividade_missao" USING btree ("instituicao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "missao_comite_codigo_uk" ON "missao_comite" USING btree ("ciclo_id","codigo");--> statement-breakpoint
CREATE INDEX "missao_comite_ciclo_status_idx" ON "missao_comite" USING btree ("ciclo_id","status");--> statement-breakpoint
CREATE INDEX "missao_comite_periodo_idx" ON "missao_comite" USING btree ("data_inicio","data_fim");--> statement-breakpoint
CREATE UNIQUE INDEX "missao_participante_pessoa_uk" ON "missao_participante" USING btree ("missao_id","pessoa_id");--> statement-breakpoint
CREATE INDEX "missao_participante_missao_idx" ON "missao_participante" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "missao_participante_pessoa_idx" ON "missao_participante" USING btree ("pessoa_id");--> statement-breakpoint
CREATE INDEX "missao_participante_equipe_idx" ON "missao_participante" USING btree ("membro_equipe_id");