ALTER TABLE "pessoa" ADD COLUMN "telefone" varchar(80);--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "orcid" varchar(19);--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD COLUMN "area_tematica_id" uuid;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD COLUMN "linha_pesquisa_id" uuid;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD COLUMN "orientador_id" uuid;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_area_tematica_id_area_tematica_id_fk" FOREIGN KEY ("area_tematica_id") REFERENCES "public"."area_tematica"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_linha_pesquisa_id_linha_pesquisa_id_fk" FOREIGN KEY ("linha_pesquisa_id") REFERENCES "public"."linha_pesquisa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_orientador_id_pessoa_id_fk" FOREIGN KEY ("orientador_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pessoa_orcid_uk" ON "pessoa" USING btree ("orcid");--> statement-breakpoint
CREATE INDEX "bolsa_concedida_tematica_idx" ON "bolsa_concedida" USING btree ("area_tematica_id");--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_orcid_ck" CHECK ("pessoa"."orcid" is null or "pessoa"."orcid" ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$');