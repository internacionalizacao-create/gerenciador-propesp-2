ALTER TABLE "pais" ADD COLUMN "codigo_numerico" char(3);--> statement-breakpoint
CREATE UNIQUE INDEX "pais_numerico_uk" ON "pais" USING btree ("codigo_numerico");