ALTER TYPE "public"."entidade_anexo" ADD VALUE 'EVENTO_BOLSISTA';--> statement-breakpoint
ALTER TYPE "public"."entidade_anexo" ADD VALUE 'REMANEJAMENTO';--> statement-breakpoint
CREATE TABLE "evento_bolsista" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bolsa_concedida_id" uuid NOT NULL,
	"tipo" varchar(40) NOT NULL,
	"data_ato" date NOT NULL,
	"justificativa" text NOT NULL,
	"referencia_externa" varchar(200),
	"previsao_retorno" date,
	"bolsa_substituta_id" uuid,
	"status_anterior" "status_bolsa_concedida" NOT NULL,
	"status_posterior" "status_bolsa_concedida" NOT NULL,
	"chave_idempotencia" uuid NOT NULL,
	"registrado_por_id" varchar(120) NOT NULL,
	"registrado_por_nome" varchar(200),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_bolsista_substituta_ck" CHECK ("evento_bolsista"."bolsa_substituta_id" is null
           or "evento_bolsista"."bolsa_substituta_id" <> "evento_bolsista"."bolsa_concedida_id"),
	CONSTRAINT "evento_bolsista_justificativa_ck" CHECK (length(trim("evento_bolsista"."justificativa")) > 0)
);
--> statement-breakpoint
CREATE TABLE "tipo_evento_bolsista" (
	"codigo" varchar(40) PRIMARY KEY NOT NULL,
	"rotulo" varchar(120) NOT NULL,
	"descricao" text,
	"estados_origem" "status_bolsa_concedida"[] NOT NULL,
	"estado_destino" "status_bolsa_concedida",
	"aceita_substituta" boolean DEFAULT false NOT NULL,
	"aceita_previsao_retorno" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipo_evento_bolsista_origem_ck" CHECK (cardinality("tipo_evento_bolsista"."estados_origem") > 0)
);
--> statement-breakpoint
ALTER TABLE "remanejamento" DROP CONSTRAINT "remanejamento_autorizacao_ck";--> statement-breakpoint
ALTER TABLE "remanejamento" ADD COLUMN "modalidade_id" uuid;--> statement-breakpoint
ALTER TABLE "remanejamento" ADD COLUMN "quantidade" integer;--> statement-breakpoint
ALTER TABLE "remanejamento" ADD COLUMN "chave_idempotencia" uuid;--> statement-breakpoint
ALTER TABLE "remanejamento" ADD COLUMN "registrado_por_id" varchar(120);--> statement-breakpoint
ALTER TABLE "remanejamento" ADD COLUMN "registrado_por_nome" varchar(200);--> statement-breakpoint
ALTER TABLE "evento_bolsista" ADD CONSTRAINT "evento_bolsista_bolsa_concedida_id_bolsa_concedida_id_fk" FOREIGN KEY ("bolsa_concedida_id") REFERENCES "public"."bolsa_concedida"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_bolsista" ADD CONSTRAINT "evento_bolsista_tipo_tipo_evento_bolsista_codigo_fk" FOREIGN KEY ("tipo") REFERENCES "public"."tipo_evento_bolsista"("codigo") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_bolsista" ADD CONSTRAINT "evento_bolsista_bolsa_substituta_id_bolsa_concedida_id_fk" FOREIGN KEY ("bolsa_substituta_id") REFERENCES "public"."bolsa_concedida"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "evento_bolsista_chave_uk" ON "evento_bolsista" USING btree ("chave_idempotencia");--> statement-breakpoint
CREATE UNIQUE INDEX "evento_bolsista_substituta_uk" ON "evento_bolsista" USING btree ("bolsa_substituta_id") WHERE "evento_bolsista"."bolsa_substituta_id" is not null;--> statement-breakpoint
CREATE INDEX "evento_bolsista_bolsa_idx" ON "evento_bolsista" USING btree ("bolsa_concedida_id");--> statement-breakpoint
ALTER TABLE "remanejamento" ADD CONSTRAINT "remanejamento_modalidade_id_modalidade_id_fk" FOREIGN KEY ("modalidade_id") REFERENCES "public"."modalidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "remanejamento_chave_uk" ON "remanejamento" USING btree ("chave_idempotencia");--> statement-breakpoint
ALTER TABLE "remanejamento" ADD CONSTRAINT "remanejamento_quantidade_ck" CHECK ("remanejamento"."quantidade" is null or "remanejamento"."quantidade" > 0);--> statement-breakpoint
-- Tipos iniciais do contrato V1-036 (§4). Sao dado, nao enum: um tipo novo
-- entra por insert, sem migration. A seed repete esta lista por upsert, em
-- `seed/tipos-evento-bolsista.ts` — mude os dois juntos.
INSERT INTO "tipo_evento_bolsista" ("codigo", "rotulo", "descricao", "estados_origem", "estado_destino", "aceita_substituta", "aceita_previsao_retorno", "ordem") VALUES
  ('DESISTENCIA', 'Desistência', 'O bolsista desistiu da bolsa na CAPES. A vaga volta a ficar disponível.', '{SELECIONADO,EM_ANDAMENTO}', 'CANCELADA', false, false, 10),
  ('INTERRUPCAO', 'Interrupção', 'A bolsa foi interrompida na CAPES. A vaga continua ocupada.', '{EM_ANDAMENTO}', 'INTERROMPIDA', false, true, 20),
  ('FALECIMENTO', 'Falecimento', 'A bolsa foi encerrada por falecimento. A situação exibida é Interrompida; a causa fica só no evento.', '{SELECIONADO,EM_ANDAMENTO,INTERROMPIDA}', 'INTERROMPIDA', false, false, 30),
  ('SUBSTITUICAO', 'Substituição', 'Outro bolsista assumiu a vaga na CAPES. A bolsa que sai é cancelada e a que entra fica ligada a ela.', '{SELECIONADO,EM_ANDAMENTO}', 'CANCELADA', true, false, 40),
  ('CONCLUSAO_ANTECIPADA', 'Conclusão antecipada', 'A bolsa foi concluída na CAPES antes da data prevista.', '{EM_ANDAMENTO}', 'CONCLUIDA', false, false, 50)
ON CONFLICT ("codigo") DO NOTHING;
