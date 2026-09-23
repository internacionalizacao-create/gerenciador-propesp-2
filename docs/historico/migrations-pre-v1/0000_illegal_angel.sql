CREATE TYPE "public"."destino" AS ENUM('BRASIL', 'EXTERIOR');--> statement-breakpoint
CREATE TYPE "public"."escopo_pendencia" AS ENUM('GERAL', 'REDE', 'AREA_TEMATICA', 'PPG');--> statement-breakpoint
CREATE TYPE "public"."fluxo" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TYPE "public"."nivel_beneficiario" AS ENUM('MESTRADO', 'DOUTORADO', 'POS_DOC', 'DOCENTE', 'MOBILIDADE_BREVE');--> statement-breakpoint
CREATE TYPE "public"."nivel_impacto" AS ENUM('ALTA', 'MEDIA', 'BAIXA');--> statement-breakpoint
CREATE TYPE "public"."origem_pendencia" AS ENUM('MANUAL', 'AUTOMATICA');--> statement-breakpoint
CREATE TYPE "public"."rubrica" AS ENUM('BOLSAS', 'MANUTENCAO', 'MISSOES');--> statement-breakpoint
CREATE TYPE "public"."situacao_participacao" AS ENUM('CONTEMPLADO', 'CADASTRO_PRELIMINAR', 'NAO_CONTEMPLADO');--> statement-breakpoint
CREATE TYPE "public"."status_bolsa_concedida" AS ENUM('SELECIONADO', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA', 'INTERROMPIDA');--> statement-breakpoint
CREATE TYPE "public"."status_ciclo" AS ENUM('PLANEJAMENTO', 'VIGENTE', 'ENCERRADO');--> statement-breakpoint
CREATE TYPE "public"."status_execucao" AS ENUM('NAO_INICIADO', 'EMPENHADO', 'PAGO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."status_item_planejado" AS ENUM('PROGRAMADO', 'PENDENTE', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."status_orcamento" AS ENUM('DEFINIDO', 'A_DEFINIR');--> statement-breakpoint
CREATE TYPE "public"."status_pendencia" AS ENUM('PENDENTE', 'EM_ANALISE', 'MONITORAR', 'RESOLVIDA');--> statement-breakpoint
CREATE TYPE "public"."status_remanejamento" AS ENUM('PROPOSTO', 'AUTORIZADO', 'EXECUTADO', 'REJEITADO');--> statement-breakpoint
CREATE TYPE "public"."modalidade_ppg" AS ENUM('ACADEMICO', 'PROFISSIONAL');--> statement-breakpoint
CREATE TYPE "public"."nivel_ppg" AS ENUM('MESTRADO', 'DOUTORADO', 'MESTRADO_DOUTORADO', 'MESTRADO_PROFISSIONAL');--> statement-breakpoint
CREATE TYPE "public"."situacao_ppg" AS ENUM('ATIVO', 'INATIVO', 'EM_IMPLANTACAO');--> statement-breakpoint
CREATE TYPE "public"."tipo_instituicao" AS ENUM('PROPRIA', 'REDE_COORDENADORA', 'PARCEIRA_INTERNACIONAL');--> statement-breakpoint
CREATE TYPE "public"."tipo_pessoa" AS ENUM('DOCENTE', 'DISCENTE', 'PESQUISADOR', 'EXTERNO');--> statement-breakpoint
CREATE TYPE "public"."papel_comite" AS ENUM('TITULAR', 'SUPLENTE');--> statement-breakpoint
CREATE TYPE "public"."publico_modalidade" AS ENUM('DOCENTE', 'DISCENTE', 'POS_DOC', 'AMBOS');--> statement-breakpoint
CREATE TYPE "public"."mes_implementacao" AS ENUM('JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO');--> statement-breakpoint
CREATE TYPE "public"."tipo_despesa" AS ENUM('MATERIAL_CONSUMO', 'SERVICO', 'EQUIPAMENTO', 'PUBLICACAO', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."tipo_missao" AS ENUM('VISITA_TECNICA', 'EVENTO', 'ARTICULACAO', 'BANCA', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."acao_auditoria" AS ENUM('CRIACAO', 'EDICAO', 'EXCLUSAO');--> statement-breakpoint
CREATE TABLE "instituicao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(240) NOT NULL,
	"sigla" varchar(40),
	"tipo" "tipo_instituicao" NOT NULL,
	"pais_id" uuid,
	"cidade" varchar(120),
	"site" varchar(240),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "linha_pesquisa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ppg_id" uuid NOT NULL,
	"nome" varchar(300) NOT NULL,
	"descricao" text,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo_iso2" char(2) NOT NULL,
	"codigo_iso3" char(3) NOT NULL,
	"nome" varchar(120) NOT NULL,
	"continente" varchar(40),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pessoa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(240) NOT NULL,
	"email" varchar(240),
	"documento" varchar(40),
	"tipo" "tipo_pessoa" NOT NULL,
	"ppg_id" uuid,
	"instituicao_id" uuid,
	"lattes" varchar(240),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ppg" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(300) NOT NULL,
	"sigla" varchar(40) NOT NULL,
	"unidade" varchar(200),
	"nivel" "nivel_ppg",
	"modalidade" "modalidade_ppg",
	"nota_capes" integer,
	"area_capes" varchar(200),
	"situacao" "situacao_ppg" DEFAULT 'ATIVO' NOT NULL,
	"coordenador_id" uuid,
	"vice_coordenador_id" uuid,
	"em_rede" boolean DEFAULT false NOT NULL,
	"rede_academica" varchar(120),
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ppg_nota_capes_ck" CHECK ("ppg"."nota_capes" is null or ("ppg"."nota_capes" between 1 and 7))
);
--> statement-breakpoint
CREATE TABLE "area_tematica" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rede_id" uuid NOT NULL,
	"codigo" varchar(40) NOT NULL,
	"nome" varchar(300) NOT NULL,
	"tema_numero" integer,
	"status_orcamento" "status_orcamento" DEFAULT 'A_DEFINIR' NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ciclo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"programa_id" uuid NOT NULL,
	"nome" varchar(80) NOT NULL,
	"ano_inicio" integer NOT NULL,
	"ano_fim" integer NOT NULL,
	"status" "status_ciclo" DEFAULT 'PLANEJAMENTO' NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membro_comite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area_tematica_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"papel" "papel_comite" DEFAULT 'TITULAR' NOT NULL,
	"desde" varchar(10),
	"ate" varchar(10),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participacao_ppg" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area_tematica_id" uuid NOT NULL,
	"ppg_id" uuid NOT NULL,
	"situacao" "situacao_participacao" DEFAULT 'CADASTRO_PRELIMINAR' NOT NULL,
	"modalidades_previstas" text,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(200) NOT NULL,
	"sigla" varchar(40),
	"slug" varchar(80) NOT NULL,
	"orgao_financiador" varchar(120),
	"descricao" text,
	"usa_redes" boolean DEFAULT false NOT NULL,
	"usa_areas_tematicas" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rede_coordenadora" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"nome" varchar(120) NOT NULL,
	"status_orcamento" "status_orcamento" DEFAULT 'A_DEFINIR' NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_catalogo_bolsa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tabela_valores_id" uuid NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"destino" "destino" NOT NULL,
	"modalidade_id" uuid NOT NULL,
	"vigencia_meses" numeric(4, 1) NOT NULL,
	"valor_usd" numeric(14, 2),
	"valor_brl" numeric(14, 2) NOT NULL,
	"fonte" varchar(200),
	"observacao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_catalogo_valor_brl_ck" CHECK ("item_catalogo_bolsa"."valor_brl" > 0),
	CONSTRAINT "item_catalogo_vigencia_ck" CHECK ("item_catalogo_bolsa"."vigencia_meses" > 0)
);
--> statement-breakpoint
CREATE TABLE "modalidade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(120) NOT NULL,
	"publico_alvo" "publico_modalidade" DEFAULT 'AMBOS' NOT NULL,
	"permite_brasil" boolean DEFAULT false NOT NULL,
	"permite_exterior" boolean DEFAULT false NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tabela_valores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"programa_id" uuid NOT NULL,
	"versao" varchar(40) NOT NULL,
	"data_base" date NOT NULL,
	"cotacao_dolar" numeric(10, 4) NOT NULL,
	"referencia_normativa" text,
	"vigente_de" date NOT NULL,
	"vigente_ate" date,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tabela_valores_vigencia_ck" CHECK ("tabela_valores"."vigente_ate" is null or "tabela_valores"."vigente_ate" >= "tabela_valores"."vigente_de")
);
--> statement-breakpoint
CREATE TABLE "fonte_documental" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"nome" varchar(240) NOT NULL,
	"conteudo_utilizado" text,
	"escopo" varchar(200),
	"status" varchar(40) DEFAULT 'INCORPORADO' NOT NULL,
	"arquivo_origem" varchar(240),
	"data_recebimento" date,
	"referencia_normativa" text,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orcamento_comite_gestor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"ano" integer NOT NULL,
	"valor_anual" numeric(14, 2) NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orcamento_tematica" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area_tematica_id" uuid NOT NULL,
	"ano" integer NOT NULL,
	"valor_bolsas" numeric(14, 2),
	"valor_manutencao" numeric(14, 2),
	"valor_missoes" numeric(14, 2),
	"status" "status_orcamento" DEFAULT 'A_DEFINIR' NOT NULL,
	"fonte" varchar(200),
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orcamento_tematica_definido_ck" CHECK ("orcamento_tematica"."status" <> 'DEFINIDO' or "orcamento_tematica"."valor_bolsas" is not null)
);
--> statement-breakpoint
CREATE TABLE "premissa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"item" varchar(200) NOT NULL,
	"valor" varchar(200) NOT NULL,
	"unidade" varchar(60),
	"natureza" varchar(120),
	"fonte" varchar(200),
	"data_base" date,
	"responsavel" varchar(200),
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bolsa_concedida" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_planejado_id" uuid,
	"programa_id" uuid NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"ppg_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"modalidade_id" uuid NOT NULL,
	"destino" "destino" NOT NULL,
	"nivel_beneficiario" "nivel_beneficiario" NOT NULL,
	"pais_destino_id" uuid,
	"instituicao_destino_id" uuid,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"vigencia_meses" numeric(4, 1) NOT NULL,
	"valor_concedido" numeric(14, 2) NOT NULL,
	"fluxo" "fluxo" NOT NULL,
	"status" "status_bolsa_concedida" DEFAULT 'SELECIONADO' NOT NULL,
	"processo" varchar(120),
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bolsa_concedida_periodo_ck" CHECK ("bolsa_concedida"."data_fim" >= "bolsa_concedida"."data_inicio"),
	CONSTRAINT "bolsa_concedida_valor_ck" CHECK ("bolsa_concedida"."valor_concedido" >= 0)
);
--> statement-breakpoint
CREATE TABLE "item_planejado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"rubrica" "rubrica" NOT NULL,
	"area_tematica_id" uuid,
	"ppg_id" uuid NOT NULL,
	"descricao" text,
	"quantidade_anual" integer DEFAULT 0 NOT NULL,
	"mes_implementacao" "mes_implementacao",
	"valor_unitario_informado" numeric(14, 2),
	"justificativa_estimativa" text,
	"status" "status_item_planejado" DEFAULT 'PROGRAMADO' NOT NULL,
	"texto_fonte" text,
	"validacao_pendencia" text,
	"observacoes" text,
	"destino" "destino",
	"modalidade_id" uuid,
	"vigencia_meses" numeric(4, 1),
	"item_catalogo_id" uuid,
	"fluxo" "fluxo",
	"tipo_missao" "tipo_missao",
	"pais_destino_id" uuid,
	"instituicao_destino_id" uuid,
	"numero_participantes" integer,
	"numero_diarias" integer,
	"inclui_passagem" boolean,
	"tipo_despesa" "tipo_despesa",
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_planejado_qtd_ck" CHECK ("item_planejado"."quantidade_anual" >= 0),
	CONSTRAINT "item_planejado_bolsa_catalogo_ck" CHECK ("item_planejado"."rubrica" <> 'BOLSAS'
           or "item_planejado"."status" <> 'PROGRAMADO'
           or ("item_planejado"."item_catalogo_id" is not null
               and "item_planejado"."destino" is not null
               and "item_planejado"."modalidade_id" is not null
               and "item_planejado"."vigencia_meses" is not null)),
	CONSTRAINT "item_planejado_valor_por_rubrica_ck" CHECK (("item_planejado"."rubrica" = 'BOLSAS' and "item_planejado"."valor_unitario_informado" is null)
           or ("item_planejado"."rubrica" <> 'BOLSAS' and "item_planejado"."item_catalogo_id" is null))
);
--> statement-breakpoint
CREATE TABLE "planejamento_anual" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_planejado_id" uuid NOT NULL,
	"ano" integer NOT NULL,
	"quantidade" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planejamento_anual_qtd_ck" CHECK ("planejamento_anual"."quantidade" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lancamento_execucao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"data" date,
	"ano" integer NOT NULL,
	"area_tematica_id" uuid,
	"ppg_id" uuid,
	"rubrica" "rubrica" NOT NULL,
	"descricao" text,
	"documento_processo" varchar(160),
	"valor_empenhado" numeric(14, 2) DEFAULT '0' NOT NULL,
	"valor_pago" numeric(14, 2) DEFAULT '0' NOT NULL,
	"valor_cancelado" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "status_execucao" DEFAULT 'NAO_INICIADO' NOT NULL,
	"bolsa_concedida_id" uuid,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lancamento_execucao_valores_ck" CHECK ("lancamento_execucao"."valor_empenhado" >= 0 and "lancamento_execucao"."valor_pago" >= 0 and "lancamento_execucao"."valor_cancelado" >= 0)
);
--> statement-breakpoint
CREATE TABLE "remanejamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"data" date,
	"ano" integer NOT NULL,
	"rede_id" uuid,
	"tema_origem_id" uuid,
	"tema_destino_id" uuid,
	"ppg_origem_id" uuid,
	"ppg_destino_id" uuid,
	"ano_origem" integer,
	"ano_destino" integer,
	"rubrica" "rubrica" NOT NULL,
	"valor" numeric(14, 2) NOT NULL,
	"justificativa" text,
	"documento_autorizacao" varchar(200),
	"status" "status_remanejamento" DEFAULT 'PROPOSTO' NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remanejamento_valor_ck" CHECK ("remanejamento"."valor" > 0),
	CONSTRAINT "remanejamento_autorizacao_ck" CHECK ("remanejamento"."status" in ('PROPOSTO', 'REJEITADO')
           or "remanejamento"."documento_autorizacao" is not null)
);
--> statement-breakpoint
CREATE TABLE "anexo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(300) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"tamanho" integer NOT NULL,
	"caminho" varchar(500) NOT NULL,
	"entidade_tipo" varchar(80) NOT NULL,
	"entidade_id" uuid NOT NULL,
	"enviado_por" varchar(200),
	"enviado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pendencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"escopo_tipo" "escopo_pendencia" DEFAULT 'GERAL' NOT NULL,
	"escopo_id" uuid,
	"escopo_descricao" varchar(200),
	"assunto" varchar(240) NOT NULL,
	"descricao" text NOT NULL,
	"impacto" text,
	"nivel_impacto" "nivel_impacto",
	"responsavel_sugerido" varchar(200),
	"prazo_momento" varchar(200),
	"status" "status_pendencia" DEFAULT 'PENDENTE' NOT NULL,
	"origem" "origem_pendencia" DEFAULT 'MANUAL' NOT NULL,
	"resolucao" text,
	"resolvida_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registro_auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entidade_tipo" varchar(80) NOT NULL,
	"entidade_id" uuid NOT NULL,
	"acao" "acao_auditoria" NOT NULL,
	"campo" varchar(120),
	"valor_anterior" text,
	"valor_novo" text,
	"usuario_id" varchar(120),
	"usuario_nome" varchar(200),
	"justificativa" text,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"data_referencia" date
);
--> statement-breakpoint
ALTER TABLE "instituicao" ADD CONSTRAINT "instituicao_pais_id_pais_id_fk" FOREIGN KEY ("pais_id") REFERENCES "public"."pais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linha_pesquisa" ADD CONSTRAINT "linha_pesquisa_ppg_id_ppg_id_fk" FOREIGN KEY ("ppg_id") REFERENCES "public"."ppg"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_ppg_id_ppg_id_fk" FOREIGN KEY ("ppg_id") REFERENCES "public"."ppg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppg" ADD CONSTRAINT "ppg_coordenador_id_pessoa_id_fk" FOREIGN KEY ("coordenador_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppg" ADD CONSTRAINT "ppg_vice_coordenador_id_pessoa_id_fk" FOREIGN KEY ("vice_coordenador_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area_tematica" ADD CONSTRAINT "area_tematica_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ciclo" ADD CONSTRAINT "ciclo_programa_id_programa_id_fk" FOREIGN KEY ("programa_id") REFERENCES "public"."programa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membro_comite" ADD CONSTRAINT "membro_comite_area_tematica_id_area_tematica_id_fk" FOREIGN KEY ("area_tematica_id") REFERENCES "public"."area_tematica"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membro_comite" ADD CONSTRAINT "membro_comite_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participacao_ppg" ADD CONSTRAINT "participacao_ppg_area_tematica_id_area_tematica_id_fk" FOREIGN KEY ("area_tematica_id") REFERENCES "public"."area_tematica"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participacao_ppg" ADD CONSTRAINT "participacao_ppg_ppg_id_ppg_id_fk" FOREIGN KEY ("ppg_id") REFERENCES "public"."ppg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rede_coordenadora" ADD CONSTRAINT "rede_coordenadora_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rede_coordenadora" ADD CONSTRAINT "rede_coordenadora_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_catalogo_bolsa" ADD CONSTRAINT "item_catalogo_bolsa_tabela_valores_id_tabela_valores_id_fk" FOREIGN KEY ("tabela_valores_id") REFERENCES "public"."tabela_valores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_catalogo_bolsa" ADD CONSTRAINT "item_catalogo_bolsa_modalidade_id_modalidade_id_fk" FOREIGN KEY ("modalidade_id") REFERENCES "public"."modalidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tabela_valores" ADD CONSTRAINT "tabela_valores_programa_id_programa_id_fk" FOREIGN KEY ("programa_id") REFERENCES "public"."programa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fonte_documental" ADD CONSTRAINT "fonte_documental_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_comite_gestor" ADD CONSTRAINT "orcamento_comite_gestor_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_comite_gestor" ADD CONSTRAINT "orcamento_comite_gestor_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_tematica" ADD CONSTRAINT "orcamento_tematica_area_tematica_id_area_tematica_id_fk" FOREIGN KEY ("area_tematica_id") REFERENCES "public"."area_tematica"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premissa" ADD CONSTRAINT "premissa_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_item_planejado_id_item_planejado_id_fk" FOREIGN KEY ("item_planejado_id") REFERENCES "public"."item_planejado"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_programa_id_programa_id_fk" FOREIGN KEY ("programa_id") REFERENCES "public"."programa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_ppg_id_ppg_id_fk" FOREIGN KEY ("ppg_id") REFERENCES "public"."ppg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_modalidade_id_modalidade_id_fk" FOREIGN KEY ("modalidade_id") REFERENCES "public"."modalidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_pais_destino_id_pais_id_fk" FOREIGN KEY ("pais_destino_id") REFERENCES "public"."pais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_instituicao_destino_id_instituicao_id_fk" FOREIGN KEY ("instituicao_destino_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_planejado" ADD CONSTRAINT "item_planejado_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_planejado" ADD CONSTRAINT "item_planejado_area_tematica_id_area_tematica_id_fk" FOREIGN KEY ("area_tematica_id") REFERENCES "public"."area_tematica"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_planejado" ADD CONSTRAINT "item_planejado_ppg_id_ppg_id_fk" FOREIGN KEY ("ppg_id") REFERENCES "public"."ppg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_planejado" ADD CONSTRAINT "item_planejado_modalidade_id_modalidade_id_fk" FOREIGN KEY ("modalidade_id") REFERENCES "public"."modalidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_planejado" ADD CONSTRAINT "item_planejado_item_catalogo_id_item_catalogo_bolsa_id_fk" FOREIGN KEY ("item_catalogo_id") REFERENCES "public"."item_catalogo_bolsa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_planejado" ADD CONSTRAINT "item_planejado_pais_destino_id_pais_id_fk" FOREIGN KEY ("pais_destino_id") REFERENCES "public"."pais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_planejado" ADD CONSTRAINT "item_planejado_instituicao_destino_id_instituicao_id_fk" FOREIGN KEY ("instituicao_destino_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planejamento_anual" ADD CONSTRAINT "planejamento_anual_item_planejado_id_item_planejado_id_fk" FOREIGN KEY ("item_planejado_id") REFERENCES "public"."item_planejado"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_execucao" ADD CONSTRAINT "lancamento_execucao_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_execucao" ADD CONSTRAINT "lancamento_execucao_area_tematica_id_area_tematica_id_fk" FOREIGN KEY ("area_tematica_id") REFERENCES "public"."area_tematica"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_execucao" ADD CONSTRAINT "lancamento_execucao_ppg_id_ppg_id_fk" FOREIGN KEY ("ppg_id") REFERENCES "public"."ppg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_execucao" ADD CONSTRAINT "lancamento_execucao_bolsa_concedida_id_bolsa_concedida_id_fk" FOREIGN KEY ("bolsa_concedida_id") REFERENCES "public"."bolsa_concedida"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remanejamento" ADD CONSTRAINT "remanejamento_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remanejamento" ADD CONSTRAINT "remanejamento_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remanejamento" ADD CONSTRAINT "remanejamento_tema_origem_id_area_tematica_id_fk" FOREIGN KEY ("tema_origem_id") REFERENCES "public"."area_tematica"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remanejamento" ADD CONSTRAINT "remanejamento_tema_destino_id_area_tematica_id_fk" FOREIGN KEY ("tema_destino_id") REFERENCES "public"."area_tematica"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remanejamento" ADD CONSTRAINT "remanejamento_ppg_origem_id_ppg_id_fk" FOREIGN KEY ("ppg_origem_id") REFERENCES "public"."ppg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remanejamento" ADD CONSTRAINT "remanejamento_ppg_destino_id_ppg_id_fk" FOREIGN KEY ("ppg_destino_id") REFERENCES "public"."ppg"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencia" ADD CONSTRAINT "pendencia_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instituicao_nome_uk" ON "instituicao" USING btree ("nome");--> statement-breakpoint
CREATE INDEX "instituicao_tipo_idx" ON "instituicao" USING btree ("tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "linha_pesquisa_ppg_nome_uk" ON "linha_pesquisa" USING btree ("ppg_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "pais_iso2_uk" ON "pais" USING btree ("codigo_iso2");--> statement-breakpoint
CREATE UNIQUE INDEX "pais_iso3_uk" ON "pais" USING btree ("codigo_iso3");--> statement-breakpoint
CREATE INDEX "pessoa_nome_idx" ON "pessoa" USING btree ("nome");--> statement-breakpoint
CREATE INDEX "pessoa_ppg_idx" ON "pessoa" USING btree ("ppg_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pessoa_email_uk" ON "pessoa" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "ppg_sigla_uk" ON "ppg" USING btree ("sigla");--> statement-breakpoint
CREATE INDEX "ppg_nome_idx" ON "ppg" USING btree ("nome");--> statement-breakpoint
CREATE UNIQUE INDEX "area_tematica_codigo_uk" ON "area_tematica" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "area_tematica_rede_idx" ON "area_tematica" USING btree ("rede_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ciclo_programa_nome_uk" ON "ciclo" USING btree ("programa_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "membro_comite_uk" ON "membro_comite" USING btree ("area_tematica_id","pessoa_id");--> statement-breakpoint
CREATE INDEX "membro_comite_pessoa_idx" ON "membro_comite" USING btree ("pessoa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participacao_ppg_uk" ON "participacao_ppg" USING btree ("area_tematica_id","ppg_id");--> statement-breakpoint
CREATE INDEX "participacao_ppg_ppg_idx" ON "participacao_ppg" USING btree ("ppg_id");--> statement-breakpoint
CREATE UNIQUE INDEX "programa_slug_uk" ON "programa" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "rede_ciclo_nome_uk" ON "rede_coordenadora" USING btree ("ciclo_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "item_catalogo_codigo_uk" ON "item_catalogo_bolsa" USING btree ("tabela_valores_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "item_catalogo_busca_uk" ON "item_catalogo_bolsa" USING btree ("tabela_valores_id","destino","modalidade_id","vigencia_meses");--> statement-breakpoint
CREATE INDEX "item_catalogo_tabela_idx" ON "item_catalogo_bolsa" USING btree ("tabela_valores_id");--> statement-breakpoint
CREATE UNIQUE INDEX "modalidade_nome_uk" ON "modalidade" USING btree ("nome");--> statement-breakpoint
CREATE UNIQUE INDEX "tabela_valores_programa_versao_uk" ON "tabela_valores" USING btree ("programa_id","versao");--> statement-breakpoint
CREATE UNIQUE INDEX "fonte_documental_ciclo_nome_uk" ON "fonte_documental" USING btree ("ciclo_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "orcamento_comite_gestor_uk" ON "orcamento_comite_gestor" USING btree ("ciclo_id","instituicao_id","ano");--> statement-breakpoint
CREATE UNIQUE INDEX "orcamento_tematica_ano_uk" ON "orcamento_tematica" USING btree ("area_tematica_id","ano");--> statement-breakpoint
CREATE INDEX "orcamento_tematica_ano_idx" ON "orcamento_tematica" USING btree ("ano");--> statement-breakpoint
CREATE UNIQUE INDEX "premissa_ciclo_item_uk" ON "premissa" USING btree ("ciclo_id","item");--> statement-breakpoint
CREATE INDEX "bolsa_concedida_ppg_idx" ON "bolsa_concedida" USING btree ("ppg_id");--> statement-breakpoint
CREATE INDEX "bolsa_concedida_pessoa_idx" ON "bolsa_concedida" USING btree ("pessoa_id");--> statement-breakpoint
CREATE INDEX "bolsa_concedida_ciclo_idx" ON "bolsa_concedida" USING btree ("ciclo_id");--> statement-breakpoint
CREATE INDEX "bolsa_concedida_item_idx" ON "bolsa_concedida" USING btree ("item_planejado_id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_planejado_codigo_uk" ON "item_planejado" USING btree ("ciclo_id","codigo");--> statement-breakpoint
CREATE INDEX "item_planejado_tematica_idx" ON "item_planejado" USING btree ("area_tematica_id");--> statement-breakpoint
CREATE INDEX "item_planejado_ppg_idx" ON "item_planejado" USING btree ("ppg_id");--> statement-breakpoint
CREATE INDEX "item_planejado_rubrica_idx" ON "item_planejado" USING btree ("rubrica");--> statement-breakpoint
CREATE UNIQUE INDEX "planejamento_anual_uk" ON "planejamento_anual" USING btree ("item_planejado_id","ano");--> statement-breakpoint
CREATE INDEX "planejamento_anual_ano_idx" ON "planejamento_anual" USING btree ("ano");--> statement-breakpoint
CREATE UNIQUE INDEX "lancamento_execucao_codigo_uk" ON "lancamento_execucao" USING btree ("ciclo_id","codigo");--> statement-breakpoint
CREATE INDEX "lancamento_execucao_ano_idx" ON "lancamento_execucao" USING btree ("ano");--> statement-breakpoint
CREATE INDEX "lancamento_execucao_tematica_idx" ON "lancamento_execucao" USING btree ("area_tematica_id");--> statement-breakpoint
CREATE INDEX "lancamento_execucao_ppg_idx" ON "lancamento_execucao" USING btree ("ppg_id");--> statement-breakpoint
CREATE UNIQUE INDEX "remanejamento_codigo_uk" ON "remanejamento" USING btree ("ciclo_id","codigo");--> statement-breakpoint
CREATE INDEX "remanejamento_ano_idx" ON "remanejamento" USING btree ("ano");--> statement-breakpoint
CREATE INDEX "remanejamento_status_idx" ON "remanejamento" USING btree ("status");--> statement-breakpoint
CREATE INDEX "anexo_entidade_idx" ON "anexo" USING btree ("entidade_tipo","entidade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pendencia_codigo_uk" ON "pendencia" USING btree ("ciclo_id","codigo");--> statement-breakpoint
CREATE INDEX "pendencia_status_idx" ON "pendencia" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pendencia_escopo_idx" ON "pendencia" USING btree ("escopo_tipo","escopo_id");--> statement-breakpoint
CREATE INDEX "auditoria_entidade_idx" ON "registro_auditoria" USING btree ("entidade_tipo","entidade_id");--> statement-breakpoint
CREATE INDEX "auditoria_ocorrido_idx" ON "registro_auditoria" USING btree ("ocorrido_em");