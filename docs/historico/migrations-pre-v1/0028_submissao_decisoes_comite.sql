CREATE TYPE "public"."acao_decisao_comite" AS ENUM('APROVAR', 'SOLICITAR_AJUSTES', 'REPROVAR');--> statement-breakpoint
CREATE TYPE "public"."momento_requisito" AS ENUM('SUBMISSAO', 'ENCERRAMENTO');--> statement-breakpoint
CREATE TYPE "public"."origem_rodada_analise" AS ENUM('SUBMISSAO', 'REABERTURA');--> statement-breakpoint
CREATE TYPE "public"."status_aprovacao_missao" AS ENUM('RASCUNHO', 'EM_ANALISE', 'AJUSTES_SOLICITADOS', 'APROVADA', 'REPROVADA');--> statement-breakpoint
CREATE TABLE "decisao_comite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rodada_id" uuid NOT NULL,
	"acao" "acao_decisao_comite" NOT NULL,
	"parecer" text NOT NULL,
	"reuniao_data" date,
	"observacoes" text,
	"decidido_por_id" varchar(200),
	"decidido_por" varchar(200),
	"decidido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisao_comite_parecer_ck" CHECK (length(btrim("decisao_comite"."parecer")) >= 3),
	CONSTRAINT "decisao_comite_reuniao_ck" CHECK (("decisao_comite"."acao" in ('APROVAR', 'REPROVAR')) = ("decisao_comite"."reuniao_data" is not null))
);
--> statement-breakpoint
CREATE TABLE "decisao_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decisao_id" uuid NOT NULL,
	"anexo_id" uuid NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requisito_submissao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"tipo_missao" "tipo_missao",
	"momento" "momento_requisito" DEFAULT 'SUBMISSAO' NOT NULL,
	"categoria" "categoria_anexo" NOT NULL,
	"obrigatorio" boolean DEFAULT true NOT NULL,
	"descricao" varchar(300),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rodada_analise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"origem" "origem_rodada_analise" DEFAULT 'SUBMISSAO' NOT NULL,
	"justificativa" text,
	"submetido_por_id" varchar(200),
	"submetido_por" varchar(200),
	"submetido_por_pessoa_id" uuid,
	"submetido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"encerrada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rodada_analise_numero_ck" CHECK ("rodada_analise"."numero" >= 1),
	CONSTRAINT "rodada_analise_justificativa_ck" CHECK (("rodada_analise"."origem" = 'REABERTURA') = ("rodada_analise"."justificativa" is not null)),
	CONSTRAINT "rodada_analise_encerramento_ck" CHECK ("rodada_analise"."encerrada_em" is null or "rodada_analise"."encerrada_em" >= "rodada_analise"."submetido_em")
);
--> statement-breakpoint
ALTER TABLE "missao_comite" ADD COLUMN "status_aprovacao" "status_aprovacao_missao" DEFAULT 'RASCUNHO' NOT NULL;--> statement-breakpoint
ALTER TABLE "decisao_comite" ADD CONSTRAINT "decisao_comite_rodada_id_rodada_analise_id_fk" FOREIGN KEY ("rodada_id") REFERENCES "public"."rodada_analise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisao_documento" ADD CONSTRAINT "decisao_documento_decisao_id_decisao_comite_id_fk" FOREIGN KEY ("decisao_id") REFERENCES "public"."decisao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisao_documento" ADD CONSTRAINT "decisao_documento_anexo_id_anexo_id_fk" FOREIGN KEY ("anexo_id") REFERENCES "public"."anexo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisito_submissao" ADD CONSTRAINT "requisito_submissao_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rodada_analise" ADD CONSTRAINT "rodada_analise_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rodada_analise" ADD CONSTRAINT "rodada_analise_submetido_por_pessoa_id_pessoa_id_fk" FOREIGN KEY ("submetido_por_pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "decisao_comite_rodada_uk" ON "decisao_comite" USING btree ("rodada_id");--> statement-breakpoint
CREATE INDEX "decisao_comite_acao_idx" ON "decisao_comite" USING btree ("acao","decidido_em");--> statement-breakpoint
CREATE UNIQUE INDEX "decisao_documento_uk" ON "decisao_documento" USING btree ("decisao_id","anexo_id");--> statement-breakpoint
CREATE INDEX "decisao_documento_decisao_idx" ON "decisao_documento" USING btree ("decisao_id");--> statement-breakpoint
CREATE INDEX "decisao_documento_anexo_idx" ON "decisao_documento" USING btree ("anexo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requisito_submissao_tipo_uk" ON "requisito_submissao" USING btree ("ciclo_id","momento","categoria","tipo_missao") WHERE "requisito_submissao"."tipo_missao" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "requisito_submissao_geral_uk" ON "requisito_submissao" USING btree ("ciclo_id","momento","categoria") WHERE "requisito_submissao"."tipo_missao" is null;--> statement-breakpoint
CREATE INDEX "requisito_submissao_consulta_idx" ON "requisito_submissao" USING btree ("ciclo_id","momento","ativo");--> statement-breakpoint
CREATE UNIQUE INDEX "rodada_analise_numero_uk" ON "rodada_analise" USING btree ("missao_id","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "rodada_analise_aberta_uk" ON "rodada_analise" USING btree ("missao_id") WHERE "rodada_analise"."encerrada_em" is null;--> statement-breakpoint
CREATE INDEX "rodada_analise_missao_idx" ON "rodada_analise" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "rodada_analise_fila_idx" ON "rodada_analise" USING btree ("submetido_em") WHERE "rodada_analise"."encerrada_em" is null;