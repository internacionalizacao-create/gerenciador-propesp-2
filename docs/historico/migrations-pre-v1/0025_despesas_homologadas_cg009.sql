ALTER TYPE "public"."tipo_despesa_missao" ADD VALUE 'HOSPEDAGEM' BEFORE 'OUTRA';--> statement-breakpoint
ALTER TYPE "public"."tipo_despesa_missao" ADD VALUE 'TRANSPORTE' BEFORE 'OUTRA';--> statement-breakpoint
ALTER TYPE "public"."tipo_despesa_missao" ADD VALUE 'INSCRICAO_EVENTO' BEFORE 'OUTRA';--> statement-breakpoint
ALTER TYPE "public"."tipo_despesa_missao" ADD VALUE 'SEGURO' BEFORE 'OUTRA';--> statement-breakpoint
ALTER TABLE "despesa_passagem" ADD COLUMN "origem" varchar(200);--> statement-breakpoint
ALTER TABLE "despesa_passagem" ADD COLUMN "destino" varchar(200);--> statement-breakpoint
ALTER TABLE "despesa_passagem" ADD COLUMN "data_voo" date;--> statement-breakpoint
ALTER TABLE "despesa_passagem" ADD COLUMN "forma_pagamento" varchar(120);