ALTER TABLE "bolsa_concedida" ADD COLUMN "pais_origem_id" uuid;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD COLUMN "instituicao_origem_id" uuid;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD COLUMN "pais_origem_nome" varchar(120);--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD COLUMN "instituicao_origem_nome" varchar(240);--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_pais_origem_id_pais_id_fk" FOREIGN KEY ("pais_origem_id") REFERENCES "public"."pais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_instituicao_origem_id_instituicao_id_fk" FOREIGN KEY ("instituicao_origem_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;