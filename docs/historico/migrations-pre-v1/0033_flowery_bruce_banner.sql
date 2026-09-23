CREATE TYPE "public"."estado_entrega_notificacao" AS ENUM('NAO_APLICAVEL', 'PENDENTE', 'ENTREGUE', 'FALHOU');--> statement-breakpoint
CREATE TYPE "public"."tipo_notificacao" AS ENUM('MISSAO_SUBMETIDA', 'DECISAO_COMITE', 'ANALISE_REABERTA', 'PRESTACAO_DEVOLVIDA', 'PRESTACAO_VALIDADA', 'PRESTACAO_PENDENTE');--> statement-breakpoint
CREATE TABLE "notificacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_notificacao" NOT NULL,
	"destinatario_id" uuid NOT NULL,
	"missao_id" uuid NOT NULL,
	"titulo" varchar(240) NOT NULL,
	"corpo" text NOT NULL,
	"origem_por" varchar(200),
	"lida_em" timestamp with time zone,
	"entrega_estado" "estado_entrega_notificacao" DEFAULT 'NAO_APLICAVEL' NOT NULL,
	"entrega_tentativas" integer DEFAULT 0 NOT NULL,
	"entrega_ultimo_erro" text,
	"entregue_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notificacao_entrega_ck" CHECK (("notificacao"."entrega_estado" = 'ENTREGUE') = ("notificacao"."entregue_em" is not null))
);
--> statement-breakpoint
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_destinatario_id_pessoa_id_fk" FOREIGN KEY ("destinatario_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notificacao_destinatario_idx" ON "notificacao" USING btree ("destinatario_id","lida_em");--> statement-breakpoint
CREATE INDEX "notificacao_missao_idx" ON "notificacao" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "notificacao_entrega_idx" ON "notificacao" USING btree ("entrega_estado") WHERE "notificacao"."entrega_estado" = 'PENDENTE';--> statement-breakpoint
CREATE UNIQUE INDEX "notificacao_pendencia_uk" ON "notificacao" USING btree ("missao_id","destinatario_id","tipo") WHERE "notificacao"."tipo" = 'PRESTACAO_PENDENTE';