CREATE TYPE "public"."estagio_relacionamento" AS ENUM('IDENTIFICADA', 'CONTATO_INICIADO', 'COOPERACAO_EM_AVALIACAO');--> statement-breakpoint
CREATE TYPE "public"."origem_relacionamento" AS ENUM('RECEBEU_BOLSISTA', 'INDICACAO_PESQUISADOR', 'CONTATO_PPG', 'EVENTO_INTERNACIONAL', 'PROSPECCAO_INSTITUCIONAL', 'OUTRO');--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "origem_relacionamento" "origem_relacionamento";--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "origem_observacao" text;--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "estagio_relacionamento" "estagio_relacionamento" DEFAULT 'IDENTIFICADA' NOT NULL;--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "areas_atuacao" text;--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "programa_relacionado" varchar(240);--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "grupo_pesquisa" varchar(240);--> statement-breakpoint
CREATE INDEX "instituicao_estagio_idx" ON "instituicao" USING btree ("estagio_relacionamento");