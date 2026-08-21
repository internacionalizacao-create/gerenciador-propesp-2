CREATE TYPE "public"."status_produto_bolsa" AS ENUM('PREVISTO', 'EM_DESENVOLVIMENTO', 'ENTREGUE', 'VALIDADO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."tipo_produto_bolsa" AS ENUM('ARTIGO', 'TRABALHO', 'PROJETO', 'RELATORIO', 'PUBLICACAO', 'LIVRO', 'CAPITULO_LIVRO', 'PATENTE', 'EVENTO', 'OUTRO');--> statement-breakpoint
CREATE TABLE "produto_bolsa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bolsa_concedida_id" uuid NOT NULL,
	"tipo" "tipo_produto_bolsa" NOT NULL,
	"titulo" varchar(400) NOT NULL,
	"descricao" text,
	"prazo_entrega" date NOT NULL,
	"status" "status_produto_bolsa" DEFAULT 'PREVISTO' NOT NULL,
	"data_entrega" date,
	"doi" varchar(240),
	"link" varchar(500),
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produto_bolsa_entrega_ck" CHECK ("produto_bolsa"."status" not in ('ENTREGUE', 'VALIDADO') or "produto_bolsa"."data_entrega" is not null)
);
--> statement-breakpoint
ALTER TABLE "produto_bolsa" ADD CONSTRAINT "produto_bolsa_bolsa_concedida_id_bolsa_concedida_id_fk" FOREIGN KEY ("bolsa_concedida_id") REFERENCES "public"."bolsa_concedida"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "produto_bolsa_concessao_idx" ON "produto_bolsa" USING btree ("bolsa_concedida_id");--> statement-breakpoint
CREATE INDEX "produto_bolsa_prazo_idx" ON "produto_bolsa" USING btree ("prazo_entrega");--> statement-breakpoint
CREATE INDEX "produto_bolsa_status_idx" ON "produto_bolsa" USING btree ("status");