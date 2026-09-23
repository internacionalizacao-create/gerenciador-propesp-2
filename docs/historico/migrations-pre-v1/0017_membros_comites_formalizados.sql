-- O PostgreSQL so permite usar um valor novo de enum depois do commit da
-- transacao que o criou. O migrador agrupa todas as migrations pendentes;
-- esta fronteira permite que a carga idempotente da 0018 use SERVIDOR.
ALTER TYPE "public"."tipo_pessoa" ADD VALUE IF NOT EXISTS 'SERVIDOR' BEFORE 'DOCENTE';--> statement-breakpoint
COMMIT;--> statement-breakpoint
BEGIN;--> statement-breakpoint
CREATE TABLE "membro_equipe_gestao_rede" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membro_equipe_id" uuid NOT NULL,
	"rede_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membro_equipe_gestao_rede" ADD CONSTRAINT "membro_equipe_gestao_rede_membro_equipe_id_membro_equipe_gestao_id_fk" FOREIGN KEY ("membro_equipe_id") REFERENCES "public"."membro_equipe_gestao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membro_equipe_gestao_rede" ADD CONSTRAINT "membro_equipe_gestao_rede_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "membro_equipe_gestao_rede_uk" ON "membro_equipe_gestao_rede" USING btree ("membro_equipe_id","rede_id");--> statement-breakpoint
CREATE INDEX "membro_equipe_gestao_rede_membro_idx" ON "membro_equipe_gestao_rede" USING btree ("membro_equipe_id");--> statement-breakpoint
CREATE INDEX "membro_equipe_gestao_rede_rede_idx" ON "membro_equipe_gestao_rede" USING btree ("rede_id");
