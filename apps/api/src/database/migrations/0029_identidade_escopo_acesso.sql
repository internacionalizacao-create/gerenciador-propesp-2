CREATE TYPE "public"."origem_vinculo_usuario" AS ENUM('EMAIL', 'CRIACAO_AUTOMATICA', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."tipo_escopo_acesso" AS ENUM('GLOBAL', 'PPG', 'REDE');--> statement-breakpoint
CREATE TABLE "escopo_acesso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" "tipo_escopo_acesso" NOT NULL,
	"ppg_id" uuid,
	"rede_id" uuid,
	"concedido_por_id" varchar(200),
	"concedido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "escopo_acesso_alvo_ck" CHECK (("escopo_acesso"."tipo" = 'GLOBAL' and "escopo_acesso"."ppg_id" is null and "escopo_acesso"."rede_id" is null)
       or ("escopo_acesso"."tipo" = 'PPG' and "escopo_acesso"."ppg_id" is not null and "escopo_acesso"."rede_id" is null)
       or ("escopo_acesso"."tipo" = 'REDE' and "escopo_acesso"."rede_id" is not null and "escopo_acesso"."ppg_id" is null))
);
--> statement-breakpoint
CREATE TABLE "usuario_sistema" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub" varchar(200) NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"username" varchar(200),
	"email" varchar(240),
	"origem" "origem_vinculo_usuario" NOT NULL,
	"vinculado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"vinculado_por_id" varchar(200),
	"ultimo_acesso_em" timestamp with time zone,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escopo_acesso" ADD CONSTRAINT "escopo_acesso_usuario_id_usuario_sistema_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario_sistema"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escopo_acesso" ADD CONSTRAINT "escopo_acesso_ppg_id_ppg_id_fk" FOREIGN KEY ("ppg_id") REFERENCES "public"."ppg"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escopo_acesso" ADD CONSTRAINT "escopo_acesso_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_sistema" ADD CONSTRAINT "usuario_sistema_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "escopo_acesso_global_uk" ON "escopo_acesso" USING btree ("usuario_id") WHERE "escopo_acesso"."tipo" = 'GLOBAL';--> statement-breakpoint
CREATE UNIQUE INDEX "escopo_acesso_ppg_uk" ON "escopo_acesso" USING btree ("usuario_id","ppg_id") WHERE "escopo_acesso"."tipo" = 'PPG';--> statement-breakpoint
CREATE UNIQUE INDEX "escopo_acesso_rede_uk" ON "escopo_acesso" USING btree ("usuario_id","rede_id") WHERE "escopo_acesso"."tipo" = 'REDE';--> statement-breakpoint
CREATE INDEX "escopo_acesso_usuario_idx" ON "escopo_acesso" USING btree ("usuario_id","ativo");--> statement-breakpoint
CREATE UNIQUE INDEX "usuario_sistema_sub_uk" ON "usuario_sistema" USING btree ("sub");--> statement-breakpoint
CREATE UNIQUE INDEX "usuario_sistema_pessoa_uk" ON "usuario_sistema" USING btree ("pessoa_id");--> statement-breakpoint
CREATE INDEX "usuario_sistema_email_idx" ON "usuario_sistema" USING btree ("email");