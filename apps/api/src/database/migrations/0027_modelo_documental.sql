CREATE TYPE "public"."categoria_anexo" AS ENUM('PROJETO', 'CONVITE', 'PROGRAMACAO', 'JUSTIFICATIVA', 'ORCAMENTO', 'PASSAGEM', 'BILHETE', 'COMPROVANTE', 'NOTA_FISCAL', 'COMPROVANTE_DIARIAS', 'COTACAO', 'FOTO_REUNIAO', 'FOTO_EVENTO', 'FOTO_VISITA', 'FOTO_ASSINATURA', 'FOTO_INSTITUICAO', 'FOTO_PARTICIPANTES', 'CERTIFICADO', 'ATA', 'NOTICIA', 'PUBLICACAO', 'APRESENTACAO', 'LISTA_PRESENCA', 'DECLARACAO', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."entidade_anexo" AS ENUM('MISSAO_COMITE', 'ATIVIDADE_MISSAO', 'PRESTACAO_CONTAS_MISSAO', 'DESPESA_MISSAO', 'COTACAO_PASSAGEM', 'INSTITUICAO', 'PARCEIRO');--> statement-breakpoint
CREATE TYPE "public"."visibilidade_anexo" AS ENUM('INTERNA', 'RESTRITA');--> statement-breakpoint
ALTER TABLE "anexo" ALTER COLUMN "entidade_tipo" SET DATA TYPE "public"."entidade_anexo" USING "entidade_tipo"::"public"."entidade_anexo";--> statement-breakpoint
ALTER TABLE "anexo" ADD COLUMN "hash_sha256" char(64);--> statement-breakpoint
ALTER TABLE "anexo" ADD COLUMN "categoria" "categoria_anexo" DEFAULT 'OUTRO' NOT NULL;--> statement-breakpoint
ALTER TABLE "anexo" ADD COLUMN "visibilidade" "visibilidade_anexo" DEFAULT 'INTERNA' NOT NULL;--> statement-breakpoint
ALTER TABLE "anexo" ADD COLUMN "versao" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "anexo" ADD COLUMN "substitui_id" uuid;--> statement-breakpoint
ALTER TABLE "anexo" ADD COLUMN "ativo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "anexo" ADD COLUMN "enviado_por_id" varchar(200);--> statement-breakpoint
ALTER TABLE "anexo" ADD COLUMN "legenda" varchar(300);--> statement-breakpoint
ALTER TABLE "anexo" ADD COLUMN "data_evidencia" date;--> statement-breakpoint
ALTER TABLE "anexo" ADD COLUMN "local_evidencia" varchar(240);--> statement-breakpoint
ALTER TABLE "anexo" ADD CONSTRAINT "anexo_substitui_id_anexo_id_fk" FOREIGN KEY ("substitui_id") REFERENCES "public"."anexo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anexo_categoria_idx" ON "anexo" USING btree ("categoria");--> statement-breakpoint
CREATE UNIQUE INDEX "anexo_caminho_uk" ON "anexo" USING btree ("caminho");--> statement-breakpoint
ALTER TABLE "anexo" ADD CONSTRAINT "anexo_versao_ck" CHECK ("anexo"."versao" >= 1);--> statement-breakpoint
ALTER TABLE "anexo" ADD CONSTRAINT "anexo_tamanho_ck" CHECK ("anexo"."tamanho" > 0);