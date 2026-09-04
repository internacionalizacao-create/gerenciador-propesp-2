ALTER TABLE "contato_instituicao" ADD COLUMN "email_normalizado" varchar(240);--> statement-breakpoint
-- O schema anterior permitia e-mails repetidos. Um registro de cada grupo vira
-- canonico para bloquear novas colisoes; os demais ficam para conciliacao
-- humana, sem apagar ou fundir pessoas durante a migration.
WITH "emails_ordenados" AS (
	SELECT "id",
		lower(trim("email")) AS "email_normalizado",
		row_number() OVER (
			PARTITION BY "instituicao_id", lower(trim("email"))
			ORDER BY "criado_em", "id"
		) AS "ordem"
	FROM "contato_instituicao"
	WHERE "email" IS NOT NULL
)
UPDATE "contato_instituicao" AS "contato"
SET "email_normalizado" = "ordenado"."email_normalizado"
FROM "emails_ordenados" AS "ordenado"
WHERE "ordenado"."id" = "contato"."id"
	AND "ordenado"."ordem" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX "contato_instituicao_email_uk" ON "contato_instituicao" USING btree ("instituicao_id","email_normalizado");--> statement-breakpoint
ALTER TABLE "contato_instituicao" ADD CONSTRAINT "contato_instituicao_email_normalizado_ck" CHECK ("contato_instituicao"."email_normalizado" is null or ("contato_instituicao"."email" is not null and "contato_instituicao"."email_normalizado" = lower(trim("contato_instituicao"."email"))));
