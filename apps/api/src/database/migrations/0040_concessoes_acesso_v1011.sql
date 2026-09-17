CREATE TYPE "public"."tipo_alvo_concessao" AS ENUM('GLOBAL', 'CICLO', 'PPG', 'REDE', 'TEMATICA', 'PARTICIPACAO');--> statement-breakpoint
CREATE TABLE "concessao_acesso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"permissao" varchar(60) NOT NULL,
	"tipo_alvo" "tipo_alvo_concessao" NOT NULL,
	"ciclo_id" uuid,
	"ppg_id" uuid,
	"rede_id" uuid,
	"area_tematica_id" uuid,
	"participacao_id" uuid,
	"origem" varchar(40),
	"justificativa" text NOT NULL,
	"concedido_por_id" varchar(200),
	"concedido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"revogado_em" timestamp with time zone,
	"revogado_por_id" varchar(200),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concessao_alvo_ck" CHECK (("concessao_acesso"."tipo_alvo" = 'GLOBAL' and "concessao_acesso"."ciclo_id" is null and "concessao_acesso"."ppg_id" is null and "concessao_acesso"."rede_id" is null and "concessao_acesso"."area_tematica_id" is null and "concessao_acesso"."participacao_id" is null)
       or ("concessao_acesso"."tipo_alvo" = 'CICLO' and "concessao_acesso"."ciclo_id" is not null and "concessao_acesso"."ppg_id" is null and "concessao_acesso"."rede_id" is null and "concessao_acesso"."area_tematica_id" is null and "concessao_acesso"."participacao_id" is null)
       or ("concessao_acesso"."tipo_alvo" = 'PPG' and "concessao_acesso"."ppg_id" is not null and "concessao_acesso"."ciclo_id" is not null and "concessao_acesso"."rede_id" is null and "concessao_acesso"."area_tematica_id" is null and "concessao_acesso"."participacao_id" is null)
       or ("concessao_acesso"."tipo_alvo" = 'REDE' and "concessao_acesso"."rede_id" is not null and "concessao_acesso"."ciclo_id" is null and "concessao_acesso"."ppg_id" is null and "concessao_acesso"."area_tematica_id" is null and "concessao_acesso"."participacao_id" is null)
       or ("concessao_acesso"."tipo_alvo" = 'TEMATICA' and "concessao_acesso"."area_tematica_id" is not null and "concessao_acesso"."ciclo_id" is null and "concessao_acesso"."ppg_id" is null and "concessao_acesso"."rede_id" is null and "concessao_acesso"."participacao_id" is null)
       or ("concessao_acesso"."tipo_alvo" = 'PARTICIPACAO' and "concessao_acesso"."participacao_id" is not null and "concessao_acesso"."ciclo_id" is null and "concessao_acesso"."ppg_id" is null and "concessao_acesso"."rede_id" is null and "concessao_acesso"."area_tematica_id" is null)),
	CONSTRAINT "concessao_permissao_ck" CHECK ("concessao_acesso"."permissao" ~ '^[a-z-]+:[a-z-]+$'),
	CONSTRAINT "concessao_revogacao_ck" CHECK ("concessao_acesso"."ativo" or "concessao_acesso"."revogado_em" is not null)
);
--> statement-breakpoint
ALTER TABLE "concessao_acesso" ADD CONSTRAINT "concessao_acesso_usuario_id_usuario_sistema_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario_sistema"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessao_acesso" ADD CONSTRAINT "concessao_acesso_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessao_acesso" ADD CONSTRAINT "concessao_acesso_ppg_id_ppg_id_fk" FOREIGN KEY ("ppg_id") REFERENCES "public"."ppg"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessao_acesso" ADD CONSTRAINT "concessao_acesso_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessao_acesso" ADD CONSTRAINT "concessao_acesso_area_tematica_id_area_tematica_id_fk" FOREIGN KEY ("area_tematica_id") REFERENCES "public"."area_tematica"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessao_acesso" ADD CONSTRAINT "concessao_acesso_participacao_id_participacao_ppg_id_fk" FOREIGN KEY ("participacao_id") REFERENCES "public"."participacao_ppg"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "concessao_global_uk" ON "concessao_acesso" USING btree ("usuario_id","permissao") WHERE "concessao_acesso"."tipo_alvo" = 'GLOBAL';--> statement-breakpoint
CREATE UNIQUE INDEX "concessao_ciclo_uk" ON "concessao_acesso" USING btree ("usuario_id","permissao","ciclo_id") WHERE "concessao_acesso"."tipo_alvo" = 'CICLO';--> statement-breakpoint
CREATE UNIQUE INDEX "concessao_ppg_uk" ON "concessao_acesso" USING btree ("usuario_id","permissao","ppg_id","ciclo_id") WHERE "concessao_acesso"."tipo_alvo" = 'PPG';--> statement-breakpoint
CREATE UNIQUE INDEX "concessao_rede_uk" ON "concessao_acesso" USING btree ("usuario_id","permissao","rede_id") WHERE "concessao_acesso"."tipo_alvo" = 'REDE';--> statement-breakpoint
CREATE UNIQUE INDEX "concessao_tematica_uk" ON "concessao_acesso" USING btree ("usuario_id","permissao","area_tematica_id") WHERE "concessao_acesso"."tipo_alvo" = 'TEMATICA';--> statement-breakpoint
CREATE UNIQUE INDEX "concessao_participacao_uk" ON "concessao_acesso" USING btree ("usuario_id","permissao","participacao_id") WHERE "concessao_acesso"."tipo_alvo" = 'PARTICIPACAO';--> statement-breakpoint
CREATE INDEX "concessao_usuario_idx" ON "concessao_acesso" USING btree ("usuario_id","ativo");--> statement-breakpoint
CREATE INDEX "concessao_permissao_idx" ON "concessao_acesso" USING btree ("permissao","ativo");