CREATE TABLE "contato_instituicao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"nome" varchar(240) NOT NULL,
	"nome_normalizado" varchar(240) NOT NULL,
	"cargo" varchar(160),
	"departamento" varchar(240),
	"area" varchar(160),
	"email" varchar(240),
	"telefone" varchar(80),
	"pais_id" uuid,
	"idioma_comunicacao" varchar(80),
	"principal" boolean DEFAULT false NOT NULL,
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contato_instituicao_nome_normalizado_ck" CHECK (length(trim("contato_instituicao"."nome_normalizado")) > 0),
	CONSTRAINT "contato_instituicao_principal_ativo_ck" CHECK ("contato_instituicao"."principal" is false or "contato_instituicao"."ativo" is true)
);
--> statement-breakpoint
CREATE TABLE "instituicao_rede" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"rede_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "nome_normalizado" varchar(240);--> statement-breakpoint
UPDATE "instituicao"
SET "nome_normalizado" = trim(
	regexp_replace(
		translate(
			lower("nome"),
			'áàâãäéèêëíìîïóòôõöúùûüçñ',
			'aaaaaeeeeiiiiooooouuuucn'
		),
		'[^[:alnum:]]+',
		' ',
		'g'
	)
);--> statement-breakpoint
ALTER TABLE "instituicao" ALTER COLUMN "nome_normalizado" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "estado_regiao" varchar(120);--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "tipo_organizacao" varchar(120);--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "faculdade_departamento" varchar(240);--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "email_institucional" varchar(240);--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "telefone" varchar(80);--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "endereco" text;--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "observacoes" text;--> statement-breakpoint
ALTER TABLE "instituicao" ADD COLUMN "cadastro_provisorio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contato_instituicao" ADD CONSTRAINT "contato_instituicao_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato_instituicao" ADD CONSTRAINT "contato_instituicao_pais_id_pais_id_fk" FOREIGN KEY ("pais_id") REFERENCES "public"."pais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instituicao_rede" ADD CONSTRAINT "instituicao_rede_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instituicao_rede" ADD CONSTRAINT "instituicao_rede_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contato_instituicao_instituicao_nome_idx" ON "contato_instituicao" USING btree ("instituicao_id","nome_normalizado");--> statement-breakpoint
CREATE INDEX "contato_instituicao_pais_idx" ON "contato_instituicao" USING btree ("pais_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contato_instituicao_principal_ativo_uk" ON "contato_instituicao" USING btree ("instituicao_id") WHERE "contato_instituicao"."principal" is true and "contato_instituicao"."ativo" is true;--> statement-breakpoint
CREATE UNIQUE INDEX "instituicao_rede_uk" ON "instituicao_rede" USING btree ("instituicao_id","rede_id");--> statement-breakpoint
CREATE INDEX "instituicao_rede_rede_idx" ON "instituicao_rede" USING btree ("rede_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instituicao_nome_normalizado_uk" ON "instituicao" USING btree ("nome_normalizado");--> statement-breakpoint
ALTER TABLE "instituicao" ADD CONSTRAINT "instituicao_nome_normalizado_ck" CHECK (length(trim("instituicao"."nome_normalizado")) > 0);
