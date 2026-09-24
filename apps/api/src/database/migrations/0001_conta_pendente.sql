ALTER TYPE "public"."origem_vinculo_usuario" ADD VALUE 'PENDENTE';--> statement-breakpoint
ALTER TABLE "usuario_sistema" ALTER COLUMN "pessoa_id" DROP NOT NULL;