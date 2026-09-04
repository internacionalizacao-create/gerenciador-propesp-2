CREATE TYPE "public"."status_prestacao_missao" AS ENUM('EM_PREENCHIMENTO', 'ENVIADA', 'COM_PENDENCIA', 'VALIDADA');--> statement-breakpoint
CREATE TYPE "public"."tipo_despesa_missao" AS ENUM('PASSAGEM', 'DIARIA', 'OUTRA');--> statement-breakpoint
CREATE TABLE "cotacao_passagem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"despesa_id" uuid NOT NULL,
	"empresa" varchar(200) NOT NULL,
	"valor" numeric(14, 2) NOT NULL,
	"obtida_em" date,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotacao_valor_ck" CHECK ("cotacao_passagem"."valor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "despesa_diaria" (
	"despesa_id" uuid PRIMARY KEY NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"pais_id" uuid,
	"cidade" varchar(120),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diaria_periodo_ck" CHECK ("despesa_diaria"."data_fim" >= "despesa_diaria"."data_inicio")
);
--> statement-breakpoint
CREATE TABLE "despesa_missao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prestacao_id" uuid NOT NULL,
	"tipo" "tipo_despesa_missao" NOT NULL,
	"participante_id" uuid,
	"exercicio" integer NOT NULL,
	"quantidade" numeric(10, 2),
	"valor_unitario" numeric(14, 2),
	"valor_total" numeric(14, 2) NOT NULL,
	"data_documento" date,
	"descricao" varchar(300) NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "despesa_valor_total_ck" CHECK ("despesa_missao"."valor_total" >= 0),
	CONSTRAINT "despesa_valor_unitario_ck" CHECK ("despesa_missao"."valor_unitario" is null or "despesa_missao"."valor_unitario" >= 0),
	CONSTRAINT "despesa_quantidade_ck" CHECK ("despesa_missao"."quantidade" is null or "despesa_missao"."quantidade" >= 0),
	CONSTRAINT "despesa_produto_ck" CHECK ("despesa_missao"."quantidade" is null or "despesa_missao"."valor_unitario" is null
          or round("despesa_missao"."quantidade" * "despesa_missao"."valor_unitario", 2) = "despesa_missao"."valor_total"),
	CONSTRAINT "despesa_exercicio_valido_ck" CHECK ("despesa_missao"."exercicio" between 2000 and 2100)
);
--> statement-breakpoint
CREATE TABLE "despesa_passagem" (
	"despesa_id" uuid PRIMARY KEY NOT NULL,
	"empresa" varchar(200),
	"trecho" varchar(300),
	"numero_voo" varchar(40),
	"comprada_em" date,
	"paga_em" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prestacao_contas_missao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"status" "status_prestacao_missao" DEFAULT 'EM_PREENCHIMENTO' NOT NULL,
	"enviada_em" date,
	"enviada_por" varchar(200),
	"validada_em" date,
	"validada_por" varchar(200),
	"parecer" text,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prestacao_envio_ck" CHECK ("prestacao_contas_missao"."status" = 'EM_PREENCHIMENTO' or "prestacao_contas_missao"."enviada_em" is not null),
	CONSTRAINT "prestacao_validacao_ck" CHECK ("prestacao_contas_missao"."status" <> 'VALIDADA' or "prestacao_contas_missao"."validada_em" is not null)
);
--> statement-breakpoint
ALTER TABLE "cotacao_passagem" ADD CONSTRAINT "cotacao_passagem_despesa_id_despesa_passagem_despesa_id_fk" FOREIGN KEY ("despesa_id") REFERENCES "public"."despesa_passagem"("despesa_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesa_diaria" ADD CONSTRAINT "despesa_diaria_despesa_id_despesa_missao_id_fk" FOREIGN KEY ("despesa_id") REFERENCES "public"."despesa_missao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesa_diaria" ADD CONSTRAINT "despesa_diaria_pais_id_pais_id_fk" FOREIGN KEY ("pais_id") REFERENCES "public"."pais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesa_missao" ADD CONSTRAINT "despesa_missao_prestacao_id_prestacao_contas_missao_id_fk" FOREIGN KEY ("prestacao_id") REFERENCES "public"."prestacao_contas_missao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesa_missao" ADD CONSTRAINT "despesa_missao_participante_id_missao_participante_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."missao_participante"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesa_passagem" ADD CONSTRAINT "despesa_passagem_despesa_id_despesa_missao_id_fk" FOREIGN KEY ("despesa_id") REFERENCES "public"."despesa_missao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestacao_contas_missao" ADD CONSTRAINT "prestacao_contas_missao_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cotacao_despesa_idx" ON "cotacao_passagem" USING btree ("despesa_id");--> statement-breakpoint
CREATE INDEX "despesa_prestacao_idx" ON "despesa_missao" USING btree ("prestacao_id");--> statement-breakpoint
CREATE INDEX "despesa_exercicio_idx" ON "despesa_missao" USING btree ("exercicio","tipo");--> statement-breakpoint
CREATE INDEX "despesa_participante_idx" ON "despesa_missao" USING btree ("participante_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prestacao_missao_uk" ON "prestacao_contas_missao" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "prestacao_status_idx" ON "prestacao_contas_missao" USING btree ("status");