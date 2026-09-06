CREATE TYPE "public"."situacao_convenio" AS ENUM('EM_TRAMITACAO', 'VIGENTE', 'ENCERRADO');--> statement-breakpoint
CREATE TYPE "public"."situacao_produto_missao" AS ENUM('PREVISTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."tipo_acordo_convenio" AS ENUM('INTERCAMBIO_PESQUISA', 'DUPLA_TITULACAO', 'COOPERACAO_TECNICA', 'INTERCAMBIO_ACADEMICO', 'MOBILIDADE_DOCENTE', 'COTUTELA', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."tipo_produto_missao" AS ENUM('CONVENIO', 'PROJETO_PESQUISA', 'PUBLICACAO', 'TESE_COTUTELA', 'PATENTE', 'EVENTO', 'REDE_PESQUISA', 'MOBILIDADE', 'CAPTACAO_RECURSOS', 'OUTRO');--> statement-breakpoint
ALTER TYPE "public"."entidade_anexo" ADD VALUE 'PRODUTO_MISSAO';--> statement-breakpoint
ALTER TYPE "public"."entidade_anexo" ADD VALUE 'CONVENIO';--> statement-breakpoint
CREATE TABLE "convenio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"missao_origem_id" uuid,
	"titulo" varchar(300) NOT NULL,
	"tipo_acordo" "tipo_acordo_convenio" NOT NULL,
	"area" varchar(160),
	"objetivo" text,
	"situacao" "situacao_convenio" DEFAULT 'EM_TRAMITACAO' NOT NULL,
	"numero_processo" varchar(80),
	"data_assinatura" date,
	"data_inicio" date,
	"data_fim" date,
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "convenio_vigencia_ck" CHECK ("convenio"."data_inicio" is null or "convenio"."data_fim" is null or "convenio"."data_fim" >= "convenio"."data_inicio"),
	CONSTRAINT "convenio_assinatura_ck" CHECK ("convenio"."situacao" <> 'VIGENTE' or "convenio"."data_assinatura" is not null)
);
--> statement-breakpoint
CREATE TABLE "convenio_rede" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"convenio_id" uuid NOT NULL,
	"rede_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produto_missao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"tipo" "tipo_produto_missao" NOT NULL,
	"titulo" varchar(300) NOT NULL,
	"descricao" text,
	"situacao" "situacao_produto_missao" DEFAULT 'PREVISTO' NOT NULL,
	"ano" integer,
	"referencia" varchar(500),
	"convenio_id" uuid,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produto_missao_ano_ck" CHECK ("produto_missao"."ano" is null or "produto_missao"."ano" between 2000 and 2100),
	CONSTRAINT "produto_missao_convenio_ck" CHECK (("produto_missao"."tipo" = 'CONVENIO') = ("produto_missao"."convenio_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "produto_missao_instituicao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produto_id" uuid NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produto_missao_rede" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produto_id" uuid NOT NULL,
	"rede_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produto_missao_responsavel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"produto_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"papel" varchar(160),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "missao_comite" ADD COLUMN "sem_produto_declarado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "missao_comite" ADD COLUMN "sem_produto_declarado_por" varchar(200);--> statement-breakpoint
ALTER TABLE "missao_comite" ADD COLUMN "sem_produto_justificativa" text;--> statement-breakpoint
ALTER TABLE "convenio" ADD CONSTRAINT "convenio_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio" ADD CONSTRAINT "convenio_missao_origem_id_missao_comite_id_fk" FOREIGN KEY ("missao_origem_id") REFERENCES "public"."missao_comite"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio_rede" ADD CONSTRAINT "convenio_rede_convenio_id_convenio_id_fk" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenio_rede" ADD CONSTRAINT "convenio_rede_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_missao" ADD CONSTRAINT "produto_missao_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_missao" ADD CONSTRAINT "produto_missao_convenio_id_convenio_id_fk" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenio"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_missao_instituicao" ADD CONSTRAINT "produto_missao_instituicao_produto_id_produto_missao_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto_missao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_missao_instituicao" ADD CONSTRAINT "produto_missao_instituicao_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_missao_rede" ADD CONSTRAINT "produto_missao_rede_produto_id_produto_missao_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto_missao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_missao_rede" ADD CONSTRAINT "produto_missao_rede_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_missao_responsavel" ADD CONSTRAINT "produto_missao_responsavel_produto_id_produto_missao_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produto_missao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_missao_responsavel" ADD CONSTRAINT "produto_missao_responsavel_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "convenio_instituicao_idx" ON "convenio" USING btree ("instituicao_id");--> statement-breakpoint
CREATE INDEX "convenio_missao_origem_idx" ON "convenio" USING btree ("missao_origem_id");--> statement-breakpoint
CREATE INDEX "convenio_situacao_idx" ON "convenio" USING btree ("situacao");--> statement-breakpoint
CREATE UNIQUE INDEX "convenio_rede_uk" ON "convenio_rede" USING btree ("convenio_id","rede_id");--> statement-breakpoint
CREATE INDEX "convenio_rede_convenio_idx" ON "convenio_rede" USING btree ("convenio_id");--> statement-breakpoint
CREATE INDEX "convenio_rede_rede_idx" ON "convenio_rede" USING btree ("rede_id");--> statement-breakpoint
CREATE INDEX "produto_missao_missao_idx" ON "produto_missao" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "produto_missao_convenio_idx" ON "produto_missao" USING btree ("convenio_id");--> statement-breakpoint
CREATE INDEX "produto_missao_tipo_idx" ON "produto_missao" USING btree ("tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "produto_missao_instituicao_uk" ON "produto_missao_instituicao" USING btree ("produto_id","instituicao_id");--> statement-breakpoint
CREATE INDEX "produto_missao_instituicao_produto_idx" ON "produto_missao_instituicao" USING btree ("produto_id");--> statement-breakpoint
CREATE INDEX "produto_missao_instituicao_instituicao_idx" ON "produto_missao_instituicao" USING btree ("instituicao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "produto_missao_rede_uk" ON "produto_missao_rede" USING btree ("produto_id","rede_id");--> statement-breakpoint
CREATE INDEX "produto_missao_rede_produto_idx" ON "produto_missao_rede" USING btree ("produto_id");--> statement-breakpoint
CREATE INDEX "produto_missao_rede_rede_idx" ON "produto_missao_rede" USING btree ("rede_id");--> statement-breakpoint
CREATE UNIQUE INDEX "produto_missao_responsavel_uk" ON "produto_missao_responsavel" USING btree ("produto_id","pessoa_id");--> statement-breakpoint
CREATE INDEX "produto_missao_responsavel_produto_idx" ON "produto_missao_responsavel" USING btree ("produto_id");--> statement-breakpoint
CREATE INDEX "produto_missao_responsavel_pessoa_idx" ON "produto_missao_responsavel" USING btree ("pessoa_id");--> statement-breakpoint
ALTER TABLE "missao_comite" ADD CONSTRAINT "missao_comite_sem_produto_ck" CHECK (("missao_comite"."sem_produto_declarado_em" is null) = ("missao_comite"."sem_produto_declarado_por" is null)
       and ("missao_comite"."sem_produto_declarado_em" is not null or "missao_comite"."sem_produto_justificativa" is null));