CREATE TYPE "public"."acao_decisao_comite" AS ENUM('APROVAR', 'SOLICITAR_AJUSTES', 'REPROVAR');--> statement-breakpoint
CREATE TYPE "public"."avaliacao_objetivos" AS ENUM('SIM', 'PARCIALMENTE', 'NAO');--> statement-breakpoint
CREATE TYPE "public"."categoria_anexo" AS ENUM('PROJETO', 'CONVITE', 'PROGRAMACAO', 'JUSTIFICATIVA', 'ORCAMENTO', 'PASSAGEM', 'BILHETE', 'COMPROVANTE', 'NOTA_FISCAL', 'COMPROVANTE_DIARIAS', 'COTACAO', 'FOTO_REUNIAO', 'FOTO_EVENTO', 'FOTO_VISITA', 'FOTO_ASSINATURA', 'FOTO_INSTITUICAO', 'FOTO_PARTICIPANTES', 'CERTIFICADO', 'ATA', 'NOTICIA', 'PUBLICACAO', 'APRESENTACAO', 'LISTA_PRESENCA', 'DECLARACAO', 'CARTA_ACEITE', 'PLANO_TRABALHO', 'RELATORIO', 'DOCUMENTO_IDENTIDADE', 'PASSAPORTE', 'COMPROVANTE_RESIDENCIA', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."destino" AS ENUM('BRASIL', 'EXTERIOR');--> statement-breakpoint
CREATE TYPE "public"."entidade_anexo" AS ENUM('MISSAO_COMITE', 'ATIVIDADE_MISSAO', 'PRESTACAO_CONTAS_MISSAO', 'DESPESA_MISSAO', 'COTACAO_PASSAGEM', 'INSTITUICAO', 'PARCEIRO', 'PRODUTO_MISSAO', 'CONVENIO', 'BOLSA_CONCEDIDA', 'DECISAO_COMITE', 'EVENTO_BOLSISTA', 'REMANEJAMENTO');--> statement-breakpoint
CREATE TYPE "public"."escopo_pendencia" AS ENUM('GERAL', 'REDE', 'AREA_TEMATICA', 'PPG');--> statement-breakpoint
CREATE TYPE "public"."estagio_relacionamento" AS ENUM('IDENTIFICADA', 'CONTATO_INICIADO', 'COOPERACAO_EM_AVALIACAO');--> statement-breakpoint
CREATE TYPE "public"."fluxo" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TYPE "public"."momento_requisito" AS ENUM('SUBMISSAO', 'ENCERRAMENTO');--> statement-breakpoint
CREATE TYPE "public"."nivel_beneficiario" AS ENUM('MESTRADO', 'DOUTORADO', 'POS_DOC', 'DOCENTE', 'MOBILIDADE_BREVE');--> statement-breakpoint
CREATE TYPE "public"."nivel_impacto" AS ENUM('ALTA', 'MEDIA', 'BAIXA');--> statement-breakpoint
CREATE TYPE "public"."origem_pendencia" AS ENUM('MANUAL', 'AUTOMATICA');--> statement-breakpoint
CREATE TYPE "public"."origem_relacionamento" AS ENUM('RECEBEU_BOLSISTA', 'INDICACAO_PESQUISADOR', 'CONTATO_PPG', 'EVENTO_INTERNACIONAL', 'PROSPECCAO_INSTITUCIONAL', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."origem_rodada_analise" AS ENUM('SUBMISSAO', 'REABERTURA');--> statement-breakpoint
CREATE TYPE "public"."origem_vinculo_usuario" AS ENUM('EMAIL', 'CRIACAO_AUTOMATICA', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."rubrica" AS ENUM('BOLSAS', 'MANUTENCAO', 'MISSOES');--> statement-breakpoint
CREATE TYPE "public"."situacao_convenio" AS ENUM('EM_TRAMITACAO', 'VIGENTE', 'ENCERRADO');--> statement-breakpoint
CREATE TYPE "public"."situacao_participacao" AS ENUM('CONTEMPLADO', 'CADASTRO_PRELIMINAR', 'NAO_CONTEMPLADO');--> statement-breakpoint
CREATE TYPE "public"."situacao_produto_missao" AS ENUM('PREVISTO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."status_aprovacao_missao" AS ENUM('RASCUNHO', 'EM_ANALISE', 'AJUSTES_SOLICITADOS', 'APROVADA', 'REPROVADA');--> statement-breakpoint
CREATE TYPE "public"."status_bolsa_concedida" AS ENUM('SELECIONADO', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA', 'INTERROMPIDA');--> statement-breakpoint
CREATE TYPE "public"."status_ciclo" AS ENUM('PLANEJAMENTO', 'VIGENTE', 'ENCERRADO');--> statement-breakpoint
CREATE TYPE "public"."status_composicao_anual" AS ENUM('A_DEFINIR', 'EM_ELABORACAO', 'APROVADA');--> statement-breakpoint
CREATE TYPE "public"."status_execucao" AS ENUM('NAO_INICIADO', 'EMPENHADO', 'PAGO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."status_item_planejado" AS ENUM('PROGRAMADO', 'PENDENTE', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."status_orcamento" AS ENUM('DEFINIDO', 'A_DEFINIR');--> statement-breakpoint
CREATE TYPE "public"."status_pendencia" AS ENUM('PENDENTE', 'EM_ANALISE', 'MONITORAR', 'RESOLVIDA');--> statement-breakpoint
CREATE TYPE "public"."status_prestacao_missao" AS ENUM('EM_PREENCHIMENTO', 'ENVIADA', 'COM_PENDENCIA', 'VALIDADA');--> statement-breakpoint
CREATE TYPE "public"."status_produto_bolsa" AS ENUM('PREVISTO', 'EM_DESENVOLVIMENTO', 'ENTREGUE', 'VALIDADO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."status_remanejamento" AS ENUM('PROPOSTO', 'AUTORIZADO', 'EXECUTADO', 'REJEITADO');--> statement-breakpoint
CREATE TYPE "public"."tipo_acordo_convenio" AS ENUM('INTERCAMBIO_PESQUISA', 'DUPLA_TITULACAO', 'COOPERACAO_TECNICA', 'INTERCAMBIO_ACADEMICO', 'MOBILIDADE_DOCENTE', 'COTUTELA', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."tipo_alvo_concessao" AS ENUM('GLOBAL', 'CICLO', 'PPG', 'REDE', 'TEMATICA', 'PARTICIPACAO');--> statement-breakpoint
CREATE TYPE "public"."tipo_despesa_missao" AS ENUM('PASSAGEM', 'DIARIA', 'HOSPEDAGEM', 'TRANSPORTE', 'INSCRICAO_EVENTO', 'SEGURO', 'OUTRA');--> statement-breakpoint
CREATE TYPE "public"."tipo_produto_bolsa" AS ENUM('ARTIGO', 'TRABALHO', 'PROJETO', 'RELATORIO', 'PUBLICACAO', 'LIVRO', 'CAPITULO_LIVRO', 'PATENTE', 'EVENTO', 'TESE_COTUTELA', 'ORIENTACAO_CONJUNTA', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."tipo_produto_missao" AS ENUM('CONVENIO', 'PROJETO_PESQUISA', 'PUBLICACAO', 'TESE_COTUTELA', 'PATENTE', 'EVENTO', 'REDE_PESQUISA', 'MOBILIDADE', 'CAPTACAO_RECURSOS', 'ORIENTACAO_CONJUNTA', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."visibilidade_anexo" AS ENUM('INTERNA', 'RESTRITA', 'PESSOAL');--> statement-breakpoint
CREATE TYPE "public"."modalidade_ppg" AS ENUM('ACADEMICO', 'PROFISSIONAL');--> statement-breakpoint
CREATE TYPE "public"."nivel_ppg" AS ENUM('MESTRADO', 'DOUTORADO', 'MESTRADO_DOUTORADO', 'MESTRADO_PROFISSIONAL');--> statement-breakpoint
CREATE TYPE "public"."situacao_ppg" AS ENUM('ATIVO', 'INATIVO', 'EM_IMPLANTACAO');--> statement-breakpoint
CREATE TYPE "public"."tipo_instituicao" AS ENUM('PROPRIA', 'REDE_COORDENADORA', 'PARCEIRA_INTERNACIONAL');--> statement-breakpoint
CREATE TYPE "public"."tipo_pessoa" AS ENUM('SERVIDOR', 'DOCENTE', 'DISCENTE', 'PESQUISADOR', 'EXTERNO');--> statement-breakpoint
CREATE TYPE "public"."papel_comite" AS ENUM('TITULAR', 'SUPLENTE');--> statement-breakpoint
CREATE TYPE "public"."publico_modalidade" AS ENUM('DOCENTE', 'DISCENTE', 'POS_DOC', 'AMBOS');--> statement-breakpoint
CREATE TYPE "public"."mes_implementacao" AS ENUM('JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO');--> statement-breakpoint
CREATE TYPE "public"."tipo_despesa" AS ENUM('MATERIAL_CONSUMO', 'SERVICO', 'EQUIPAMENTO', 'PUBLICACAO', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."tipo_missao" AS ENUM('VISITA_TECNICA', 'EVENTO', 'ARTICULACAO', 'BANCA', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."acao_auditoria" AS ENUM('CRIACAO', 'EDICAO', 'EXCLUSAO');--> statement-breakpoint
CREATE TYPE "public"."papel_missao" AS ENUM('RESPONSAVEL', 'PARTICIPANTE', 'APOIO');--> statement-breakpoint
CREATE TYPE "public"."status_atividade_missao" AS ENUM('PLANEJADA', 'REALIZADA', 'NAO_REALIZADA');--> statement-breakpoint
CREATE TYPE "public"."status_missao_comite" AS ENUM('RASCUNHO', 'PLANEJADA', 'CONFIRMADA', 'CONCLUIDA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."tipo_equipe_gestao" AS ENUM('COMITE_GESTOR', 'ADMINISTRACAO');--> statement-breakpoint
CREATE TYPE "public"."tipo_relacionamento_missao" AS ENUM('REUNIAO_INSTITUCIONAL', 'COOPERACAO_ACADEMICA', 'PESQUISA', 'MOBILIDADE', 'CONVENIO', 'PROJETO', 'EVENTO', 'VISITA_TECNICA', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."estado_entrega_notificacao" AS ENUM('NAO_APLICAVEL', 'PENDENTE', 'ENTREGUE', 'FALHOU');--> statement-breakpoint
CREATE TYPE "public"."tipo_notificacao" AS ENUM('MISSAO_SUBMETIDA', 'DECISAO_COMITE', 'ANALISE_REABERTA', 'PRESTACAO_DEVOLVIDA', 'PRESTACAO_VALIDADA', 'PRESTACAO_PENDENTE');--> statement-breakpoint
CREATE TABLE "instituicao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(240) NOT NULL,
	"nome_normalizado" varchar(240) NOT NULL,
	"sigla" varchar(40),
	"tipo" "tipo_instituicao" NOT NULL,
	"pais_id" uuid,
	"cidade" varchar(120),
	"estado_regiao" varchar(120),
	"tipo_organizacao" varchar(120),
	"faculdade_departamento" varchar(240),
	"site" varchar(240),
	"email_institucional" varchar(240),
	"telefone" varchar(80),
	"endereco" text,
	"origem_relacionamento" "origem_relacionamento",
	"origem_observacao" text,
	"estagio_relacionamento" "estagio_relacionamento" DEFAULT 'IDENTIFICADA' NOT NULL,
	"areas_atuacao" text,
	"programa_relacionado" varchar(240),
	"grupo_pesquisa" varchar(240),
	"observacoes" text,
	"cadastro_provisorio" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"substituida_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instituicao_nome_normalizado_ck" CHECK (length(trim("instituicao"."nome_normalizado")) > 0),
	CONSTRAINT "instituicao_substituida_inativa_ck" CHECK ("instituicao"."substituida_por_id" is null or ("instituicao"."ativo" is false and "instituicao"."substituida_por_id" <> "instituicao"."id"))
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
	"codigo_numerico" char(3),
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
	"cpf" char(11),
	"tipo" "tipo_pessoa" NOT NULL,
	"ppg_id" uuid,
	"instituicao_id" uuid,
	"lattes" varchar(240),
	"telefone" varchar(80),
	"orcid" varchar(19),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pessoa_orcid_ck" CHECK ("pessoa"."orcid" is null or "pessoa"."orcid" ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$')
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
	"coordenador_tematica_id" uuid NOT NULL,
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
	"custo_bolsas_informado" numeric(14, 2),
	"saldo_informado" numeric(14, 2),
	"status" "status_orcamento" DEFAULT 'A_DEFINIR' NOT NULL,
	"status_composicao" "status_composicao_anual" DEFAULT 'A_DEFINIR' NOT NULL,
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
	"area_tematica_id" uuid,
	"pessoa_id" uuid NOT NULL,
	"linha_pesquisa_id" uuid,
	"orientador_id" uuid,
	"modalidade_id" uuid NOT NULL,
	"destino" "destino" NOT NULL,
	"nivel_beneficiario" "nivel_beneficiario" NOT NULL,
	"pais_origem_id" uuid,
	"instituicao_origem_id" uuid,
	"pais_origem_nome" varchar(120),
	"instituicao_origem_nome" varchar(240),
	"pais_destino_id" uuid,
	"instituicao_destino_id" uuid,
	"pais_destino_nome" varchar(120),
	"instituicao_destino_nome" varchar(240),
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
CREATE TABLE "produto_bolsa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bolsa_concedida_id" uuid NOT NULL,
	"tipo" "tipo_produto_bolsa" NOT NULL,
	"titulo" varchar(400) NOT NULL,
	"descricao" text,
	"prazo_entrega" date NOT NULL,
	"status" "status_produto_bolsa" DEFAULT 'PREVISTO' NOT NULL,
	"data_entrega" date,
	"doi" varchar(240),
	"link" varchar(500),
	"instituicao_colaboracao" varchar(240),
	"pais_colaboracao" varchar(120),
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produto_bolsa_entrega_ck" CHECK ("produto_bolsa"."status" not in ('ENTREGUE', 'VALIDADO') or "produto_bolsa"."data_entrega" is not null)
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
	"modalidade_id" uuid,
	"quantidade" integer,
	"valor" numeric(14, 2) NOT NULL,
	"justificativa" text,
	"documento_autorizacao" varchar(200),
	"status" "status_remanejamento" DEFAULT 'PROPOSTO' NOT NULL,
	"observacoes" text,
	"chave_idempotencia" uuid,
	"registrado_por_id" varchar(120),
	"registrado_por_nome" varchar(200),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remanejamento_valor_ck" CHECK ("remanejamento"."valor" > 0),
	CONSTRAINT "remanejamento_quantidade_ck" CHECK ("remanejamento"."quantidade" is null or "remanejamento"."quantidade" > 0)
);
--> statement-breakpoint
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
CREATE TABLE "anexo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(300) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"tamanho" integer NOT NULL,
	"caminho" varchar(500) NOT NULL,
	"hash_sha256" char(64),
	"categoria" "categoria_anexo" DEFAULT 'OUTRO' NOT NULL,
	"visibilidade" "visibilidade_anexo" DEFAULT 'INTERNA' NOT NULL,
	"entidade_tipo" "entidade_anexo" NOT NULL,
	"entidade_id" uuid NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"substitui_id" uuid,
	"ativo" boolean DEFAULT true NOT NULL,
	"enviado_por_id" varchar(200),
	"enviado_por" varchar(200),
	"enviado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"legenda" varchar(300),
	"data_evidencia" date,
	"local_evidencia" varchar(240),
	"autoria" varchar(200),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anexo_versao_ck" CHECK ("anexo"."versao" >= 1),
	CONSTRAINT "anexo_tamanho_ck" CHECK ("anexo"."tamanho" > 0)
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
CREATE TABLE "atividade_missao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"tipo" "tipo_missao" NOT NULL,
	"titulo" varchar(300) NOT NULL,
	"pais_id" uuid NOT NULL,
	"cidade" varchar(120),
	"estado_regiao" varchar(120),
	"local" varchar(240),
	"endereco" text,
	"instituicao_id" uuid,
	"instituicao_nome" varchar(240),
	"contato_instituicao_id" uuid,
	"tipo_relacionamento" "tipo_relacionamento_missao",
	"objetivo_relacionamento" text,
	"evento_nome" varchar(300),
	"evento_tipo" varchar(160),
	"evento_site" varchar(500),
	"objetivo_participacao" text,
	"relacao_internacionalizacao" text,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"planejamento" text,
	"relato_realizado" text,
	"resultados" text,
	"status" "status_atividade_missao" DEFAULT 'PLANEJADA' NOT NULL,
	"nao_prevista" boolean DEFAULT false NOT NULL,
	"justificativa_inclusao" text,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "atividade_missao_ordem_ck" CHECK ("atividade_missao"."ordem" >= 0),
	CONSTRAINT "atividade_missao_periodo_ck" CHECK ("atividade_missao"."data_fim" >= "atividade_missao"."data_inicio"),
	CONSTRAINT "atividade_missao_instituicao_ck" CHECK (num_nonnulls("atividade_missao"."instituicao_id", "atividade_missao"."instituicao_nome") <= 1),
	CONSTRAINT "atividade_missao_contato_instituicao_ck" CHECK ("atividade_missao"."contato_instituicao_id" is null or "atividade_missao"."instituicao_id" is not null),
	CONSTRAINT "atividade_missao_nao_prevista_ck" CHECK ("atividade_missao"."nao_prevista" is false or "atividade_missao"."justificativa_inclusao" is not null)
);
--> statement-breakpoint
CREATE TABLE "dispensa_requisito_encerramento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"chave" varchar(80) NOT NULL,
	"justificativa" text NOT NULL,
	"dispensada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"dispensada_por" varchar(200),
	"dispensada_por_id" varchar(120),
	"revogada_em" timestamp with time zone,
	"revogada_por" varchar(200),
	"revogada_justificativa" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispensa_requisito_revogacao_ck" CHECK (("dispensa_requisito_encerramento"."revogada_em" is null) = ("dispensa_requisito_encerramento"."revogada_por" is null)
       and ("dispensa_requisito_encerramento"."revogada_em" is not null or "dispensa_requisito_encerramento"."revogada_justificativa" is null))
);
--> statement-breakpoint
CREATE TABLE "membro_equipe_gestao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"tipo_equipe" "tipo_equipe_gestao" NOT NULL,
	"funcao" varchar(160) NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membro_equipe_gestao_periodo_ck" CHECK ("membro_equipe_gestao"."data_fim" is null or "membro_equipe_gestao"."data_fim" >= "membro_equipe_gestao"."data_inicio")
);
--> statement-breakpoint
CREATE TABLE "membro_equipe_gestao_rede" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membro_equipe_id" uuid NOT NULL,
	"rede_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missao_comite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"tipo" "tipo_missao",
	"unidade_departamento" varchar(240),
	"titulo" varchar(300) NOT NULL,
	"objetivo" text NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"status" "status_missao_comite" DEFAULT 'RASCUNHO' NOT NULL,
	"status_aprovacao" "status_aprovacao_missao" DEFAULT 'RASCUNHO' NOT NULL,
	"relato_geral" text,
	"resultados" text,
	"sem_produto_declarado_em" timestamp with time zone,
	"sem_produto_declarado_por" varchar(200),
	"sem_produto_justificativa" text,
	"avaliacao_objetivos" "avaliacao_objetivos",
	"avaliacao_justificativa" text,
	"desdobramentos" text,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "missao_comite_periodo_ck" CHECK ("missao_comite"."data_fim" >= "missao_comite"."data_inicio"),
	CONSTRAINT "missao_comite_sem_produto_ck" CHECK (("missao_comite"."sem_produto_declarado_em" is null) = ("missao_comite"."sem_produto_declarado_por" is null)
       and ("missao_comite"."sem_produto_declarado_em" is not null or "missao_comite"."sem_produto_justificativa" is null)),
	CONSTRAINT "missao_comite_avaliacao_ck" CHECK (("missao_comite"."avaliacao_objetivos" is not null
            or "missao_comite"."avaliacao_justificativa" is null)
       and ("missao_comite"."avaliacao_objetivos" is null
            or "missao_comite"."avaliacao_objetivos" = 'SIM'
            or "missao_comite"."avaliacao_justificativa" is not null))
);
--> statement-breakpoint
CREATE TABLE "missao_participante" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"membro_equipe_id" uuid,
	"papel" "papel_missao" DEFAULT 'PARTICIPANTE' NOT NULL,
	"cargo" varchar(160),
	"area" varchar(160),
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "missao_participante_periodo_ck" CHECK ("missao_participante"."data_fim" >= "missao_participante"."data_inicio")
);
--> statement-breakpoint
CREATE TABLE "missao_rede" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"rede_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contato_instituicao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"nome" varchar(240) NOT NULL,
	"nome_normalizado" varchar(240) NOT NULL,
	"cargo" varchar(160),
	"departamento" varchar(240),
	"area" varchar(160),
	"email" varchar(240),
	"email_normalizado" varchar(240),
	"telefone" varchar(80),
	"pais_id" uuid,
	"idioma_comunicacao" varchar(80),
	"principal" boolean DEFAULT false NOT NULL,
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contato_instituicao_nome_normalizado_ck" CHECK (length(trim("contato_instituicao"."nome_normalizado")) > 0),
	CONSTRAINT "contato_instituicao_principal_ativo_ck" CHECK ("contato_instituicao"."principal" is false or "contato_instituicao"."ativo" is true),
	CONSTRAINT "contato_instituicao_email_normalizado_ck" CHECK ("contato_instituicao"."email_normalizado" is null or ("contato_instituicao"."email" is not null and "contato_instituicao"."email_normalizado" = lower(trim("contato_instituicao"."email"))))
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
CREATE TABLE "cotacao_passagem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"despesa_id" uuid NOT NULL,
	"empresa" varchar(200) NOT NULL,
	"valor" numeric(14, 2) NOT NULL,
	"obtida_em" date,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cotacao_valor_ck" CHECK ("cotacao_passagem"."valor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "despesa_diaria" (
	"despesa_id" uuid PRIMARY KEY NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"pais_id" uuid,
	"cidade" varchar(120),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diaria_periodo_ck" CHECK ("despesa_diaria"."data_fim" >= "despesa_diaria"."data_inicio")
);
--> statement-breakpoint
CREATE TABLE "despesa_missao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prestacao_id" uuid NOT NULL,
	"tipo" "tipo_despesa_missao" NOT NULL,
	"participante_id" uuid,
	"exercicio" integer NOT NULL,
	"quantidade" numeric(10, 2),
	"valor_unitario" numeric(14, 2),
	"valor_total" numeric(14, 2) NOT NULL,
	"data_documento" date,
	"descricao" varchar(300) NOT NULL,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "despesa_valor_total_ck" CHECK ("despesa_missao"."valor_total" >= 0),
	CONSTRAINT "despesa_valor_unitario_ck" CHECK ("despesa_missao"."valor_unitario" is null or "despesa_missao"."valor_unitario" >= 0),
	CONSTRAINT "despesa_quantidade_ck" CHECK ("despesa_missao"."quantidade" is null or "despesa_missao"."quantidade" >= 0),
	CONSTRAINT "despesa_produto_ck" CHECK ("despesa_missao"."quantidade" is null or "despesa_missao"."valor_unitario" is null
          or round("despesa_missao"."quantidade" * "despesa_missao"."valor_unitario", 2) = "despesa_missao"."valor_total"),
	CONSTRAINT "despesa_exercicio_valido_ck" CHECK ("despesa_missao"."exercicio" between 2000 and 2100)
);
--> statement-breakpoint
CREATE TABLE "despesa_passagem" (
	"despesa_id" uuid PRIMARY KEY NOT NULL,
	"empresa" varchar(200),
	"origem" varchar(200),
	"destino" varchar(200),
	"numero_voo" varchar(40),
	"data_voo" date,
	"comprada_em" date,
	"forma_pagamento" varchar(120),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prestacao_contas_missao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"status" "status_prestacao_missao" DEFAULT 'EM_PREENCHIMENTO' NOT NULL,
	"enviada_em" date,
	"enviada_por" varchar(200),
	"validada_em" date,
	"validada_por" varchar(200),
	"parecer" text,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prestacao_envio_ck" CHECK ("prestacao_contas_missao"."status" = 'EM_PREENCHIMENTO' or "prestacao_contas_missao"."enviada_em" is not null),
	CONSTRAINT "prestacao_validacao_ck" CHECK ("prestacao_contas_missao"."status" <> 'VALIDADA' or "prestacao_contas_missao"."validada_em" is not null)
);
--> statement-breakpoint
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
CREATE TABLE "decisao_comite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rodada_id" uuid NOT NULL,
	"acao" "acao_decisao_comite" NOT NULL,
	"parecer" text NOT NULL,
	"reuniao_data" date,
	"observacoes" text,
	"decidido_por_id" varchar(200),
	"decidido_por" varchar(200),
	"decidido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisao_comite_parecer_ck" CHECK (length(btrim("decisao_comite"."parecer")) >= 3),
	CONSTRAINT "decisao_comite_reuniao_ck" CHECK (("decisao_comite"."acao" in ('APROVAR', 'REPROVAR')) = ("decisao_comite"."reuniao_data" is not null))
);
--> statement-breakpoint
CREATE TABLE "decisao_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decisao_id" uuid NOT NULL,
	"anexo_id" uuid NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requisito_submissao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ciclo_id" uuid NOT NULL,
	"tipo_missao" "tipo_missao",
	"momento" "momento_requisito" DEFAULT 'SUBMISSAO' NOT NULL,
	"categoria" "categoria_anexo" NOT NULL,
	"obrigatorio" boolean DEFAULT true NOT NULL,
	"descricao" varchar(300),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rodada_analise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"origem" "origem_rodada_analise" DEFAULT 'SUBMISSAO' NOT NULL,
	"justificativa" text,
	"submetido_por_id" varchar(200),
	"submetido_por" varchar(200),
	"submetido_por_pessoa_id" uuid,
	"submetido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"encerrada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rodada_analise_numero_ck" CHECK ("rodada_analise"."numero" >= 1),
	CONSTRAINT "rodada_analise_justificativa_ck" CHECK (("rodada_analise"."origem" = 'REABERTURA') = ("rodada_analise"."justificativa" is not null)),
	CONSTRAINT "rodada_analise_encerramento_ck" CHECK ("rodada_analise"."encerrada_em" is null or "rodada_analise"."encerrada_em" >= "rodada_analise"."submetido_em")
);
--> statement-breakpoint
CREATE TABLE "concessao_acesso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"permissao" varchar(60) NOT NULL,
	"tipo_alvo" "tipo_alvo_concessao" NOT NULL,
	"ciclo_id" uuid,
	"ppg_id" uuid,
	"rede_id" uuid,
	"area_tematica_id" uuid,
	"participacao_id" uuid,
	"origem" varchar(40),
	"justificativa" text NOT NULL,
	"concedido_por_id" varchar(200),
	"concedido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"revogado_em" timestamp with time zone,
	"revogado_por_id" varchar(200),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concessao_alvo_ck" CHECK (("concessao_acesso"."tipo_alvo" = 'GLOBAL' and "concessao_acesso"."ciclo_id" is null and "concessao_acesso"."ppg_id" is null and "concessao_acesso"."rede_id" is null and "concessao_acesso"."area_tematica_id" is null and "concessao_acesso"."participacao_id" is null)
       or ("concessao_acesso"."tipo_alvo" = 'CICLO' and "concessao_acesso"."ciclo_id" is not null and "concessao_acesso"."ppg_id" is null and "concessao_acesso"."rede_id" is null and "concessao_acesso"."area_tematica_id" is null and "concessao_acesso"."participacao_id" is null)
       or ("concessao_acesso"."tipo_alvo" = 'PPG' and "concessao_acesso"."ppg_id" is not null and "concessao_acesso"."ciclo_id" is not null and "concessao_acesso"."rede_id" is null and "concessao_acesso"."area_tematica_id" is null and "concessao_acesso"."participacao_id" is null)
       or ("concessao_acesso"."tipo_alvo" = 'REDE' and "concessao_acesso"."rede_id" is not null and "concessao_acesso"."ciclo_id" is null and "concessao_acesso"."ppg_id" is null and "concessao_acesso"."area_tematica_id" is null and "concessao_acesso"."participacao_id" is null)
       or ("concessao_acesso"."tipo_alvo" = 'TEMATICA' and "concessao_acesso"."area_tematica_id" is not null and "concessao_acesso"."ciclo_id" is null and "concessao_acesso"."ppg_id" is null and "concessao_acesso"."rede_id" is null and "concessao_acesso"."participacao_id" is null)
       or ("concessao_acesso"."tipo_alvo" = 'PARTICIPACAO' and "concessao_acesso"."participacao_id" is not null and "concessao_acesso"."ciclo_id" is null and "concessao_acesso"."ppg_id" is null and "concessao_acesso"."rede_id" is null and "concessao_acesso"."area_tematica_id" is null)),
	CONSTRAINT "concessao_permissao_ck" CHECK ("concessao_acesso"."permissao" ~ '^[a-z-]+:[a-z-]+$'),
	CONSTRAINT "concessao_revogacao_ck" CHECK ("concessao_acesso"."ativo" or "concessao_acesso"."revogado_em" is not null)
);
--> statement-breakpoint
CREATE TABLE "usuario_sistema" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sub" varchar(200) NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"username" varchar(200),
	"email" varchar(240),
	"origem" "origem_vinculo_usuario" NOT NULL,
	"vinculado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"vinculado_por_id" varchar(200),
	"ultimo_acesso_em" timestamp with time zone,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_notificacao" NOT NULL,
	"destinatario_id" uuid NOT NULL,
	"missao_id" uuid NOT NULL,
	"titulo" varchar(240) NOT NULL,
	"corpo" text NOT NULL,
	"origem_por" varchar(200),
	"lida_em" timestamp with time zone,
	"entrega_estado" "estado_entrega_notificacao" DEFAULT 'NAO_APLICAVEL' NOT NULL,
	"entrega_tentativas" integer DEFAULT 0 NOT NULL,
	"entrega_ultimo_erro" text,
	"entregue_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notificacao_entrega_ck" CHECK (("notificacao"."entrega_estado" = 'ENTREGUE') = ("notificacao"."entregue_em" is not null))
);
--> statement-breakpoint
ALTER TABLE "instituicao" ADD CONSTRAINT "instituicao_pais_id_pais_id_fk" FOREIGN KEY ("pais_id") REFERENCES "public"."pais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instituicao" ADD CONSTRAINT "instituicao_substituida_por_id_instituicao_id_fk" FOREIGN KEY ("substituida_por_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "participacao_ppg" ADD CONSTRAINT "participacao_ppg_coordenador_tematica_id_pessoa_id_fk" FOREIGN KEY ("coordenador_tematica_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_area_tematica_id_area_tematica_id_fk" FOREIGN KEY ("area_tematica_id") REFERENCES "public"."area_tematica"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_linha_pesquisa_id_linha_pesquisa_id_fk" FOREIGN KEY ("linha_pesquisa_id") REFERENCES "public"."linha_pesquisa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_orientador_id_pessoa_id_fk" FOREIGN KEY ("orientador_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_modalidade_id_modalidade_id_fk" FOREIGN KEY ("modalidade_id") REFERENCES "public"."modalidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_pais_origem_id_pais_id_fk" FOREIGN KEY ("pais_origem_id") REFERENCES "public"."pais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bolsa_concedida" ADD CONSTRAINT "bolsa_concedida_instituicao_origem_id_instituicao_id_fk" FOREIGN KEY ("instituicao_origem_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "produto_bolsa" ADD CONSTRAINT "produto_bolsa_bolsa_concedida_id_bolsa_concedida_id_fk" FOREIGN KEY ("bolsa_concedida_id") REFERENCES "public"."bolsa_concedida"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "remanejamento" ADD CONSTRAINT "remanejamento_modalidade_id_modalidade_id_fk" FOREIGN KEY ("modalidade_id") REFERENCES "public"."modalidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_bolsista" ADD CONSTRAINT "evento_bolsista_bolsa_concedida_id_bolsa_concedida_id_fk" FOREIGN KEY ("bolsa_concedida_id") REFERENCES "public"."bolsa_concedida"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_bolsista" ADD CONSTRAINT "evento_bolsista_tipo_tipo_evento_bolsista_codigo_fk" FOREIGN KEY ("tipo") REFERENCES "public"."tipo_evento_bolsista"("codigo") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_bolsista" ADD CONSTRAINT "evento_bolsista_bolsa_substituta_id_bolsa_concedida_id_fk" FOREIGN KEY ("bolsa_substituta_id") REFERENCES "public"."bolsa_concedida"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anexo" ADD CONSTRAINT "anexo_substitui_id_anexo_id_fk" FOREIGN KEY ("substitui_id") REFERENCES "public"."anexo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencia" ADD CONSTRAINT "pendencia_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD CONSTRAINT "atividade_missao_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD CONSTRAINT "atividade_missao_pais_id_pais_id_fk" FOREIGN KEY ("pais_id") REFERENCES "public"."pais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD CONSTRAINT "atividade_missao_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade_missao" ADD CONSTRAINT "atividade_missao_contato_instituicao_id_contato_instituicao_id_fk" FOREIGN KEY ("contato_instituicao_id") REFERENCES "public"."contato_instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensa_requisito_encerramento" ADD CONSTRAINT "dispensa_requisito_encerramento_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membro_equipe_gestao" ADD CONSTRAINT "membro_equipe_gestao_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membro_equipe_gestao" ADD CONSTRAINT "membro_equipe_gestao_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membro_equipe_gestao_rede" ADD CONSTRAINT "membro_equipe_gestao_rede_membro_equipe_id_membro_equipe_gestao_id_fk" FOREIGN KEY ("membro_equipe_id") REFERENCES "public"."membro_equipe_gestao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membro_equipe_gestao_rede" ADD CONSTRAINT "membro_equipe_gestao_rede_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missao_comite" ADD CONSTRAINT "missao_comite_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missao_participante" ADD CONSTRAINT "missao_participante_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missao_participante" ADD CONSTRAINT "missao_participante_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missao_participante" ADD CONSTRAINT "missao_participante_membro_equipe_id_membro_equipe_gestao_id_fk" FOREIGN KEY ("membro_equipe_id") REFERENCES "public"."membro_equipe_gestao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missao_rede" ADD CONSTRAINT "missao_rede_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missao_rede" ADD CONSTRAINT "missao_rede_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato_instituicao" ADD CONSTRAINT "contato_instituicao_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contato_instituicao" ADD CONSTRAINT "contato_instituicao_pais_id_pais_id_fk" FOREIGN KEY ("pais_id") REFERENCES "public"."pais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instituicao_rede" ADD CONSTRAINT "instituicao_rede_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instituicao_rede" ADD CONSTRAINT "instituicao_rede_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotacao_passagem" ADD CONSTRAINT "cotacao_passagem_despesa_id_despesa_passagem_despesa_id_fk" FOREIGN KEY ("despesa_id") REFERENCES "public"."despesa_passagem"("despesa_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesa_diaria" ADD CONSTRAINT "despesa_diaria_despesa_id_despesa_missao_id_fk" FOREIGN KEY ("despesa_id") REFERENCES "public"."despesa_missao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesa_diaria" ADD CONSTRAINT "despesa_diaria_pais_id_pais_id_fk" FOREIGN KEY ("pais_id") REFERENCES "public"."pais"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesa_missao" ADD CONSTRAINT "despesa_missao_prestacao_id_prestacao_contas_missao_id_fk" FOREIGN KEY ("prestacao_id") REFERENCES "public"."prestacao_contas_missao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesa_missao" ADD CONSTRAINT "despesa_missao_participante_id_missao_participante_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."missao_participante"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesa_passagem" ADD CONSTRAINT "despesa_passagem_despesa_id_despesa_missao_id_fk" FOREIGN KEY ("despesa_id") REFERENCES "public"."despesa_missao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestacao_contas_missao" ADD CONSTRAINT "prestacao_contas_missao_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "decisao_comite" ADD CONSTRAINT "decisao_comite_rodada_id_rodada_analise_id_fk" FOREIGN KEY ("rodada_id") REFERENCES "public"."rodada_analise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisao_documento" ADD CONSTRAINT "decisao_documento_decisao_id_decisao_comite_id_fk" FOREIGN KEY ("decisao_id") REFERENCES "public"."decisao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisao_documento" ADD CONSTRAINT "decisao_documento_anexo_id_anexo_id_fk" FOREIGN KEY ("anexo_id") REFERENCES "public"."anexo"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisito_submissao" ADD CONSTRAINT "requisito_submissao_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rodada_analise" ADD CONSTRAINT "rodada_analise_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rodada_analise" ADD CONSTRAINT "rodada_analise_submetido_por_pessoa_id_pessoa_id_fk" FOREIGN KEY ("submetido_por_pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessao_acesso" ADD CONSTRAINT "concessao_acesso_usuario_id_usuario_sistema_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario_sistema"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessao_acesso" ADD CONSTRAINT "concessao_acesso_ciclo_id_ciclo_id_fk" FOREIGN KEY ("ciclo_id") REFERENCES "public"."ciclo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessao_acesso" ADD CONSTRAINT "concessao_acesso_ppg_id_ppg_id_fk" FOREIGN KEY ("ppg_id") REFERENCES "public"."ppg"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessao_acesso" ADD CONSTRAINT "concessao_acesso_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessao_acesso" ADD CONSTRAINT "concessao_acesso_area_tematica_id_area_tematica_id_fk" FOREIGN KEY ("area_tematica_id") REFERENCES "public"."area_tematica"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concessao_acesso" ADD CONSTRAINT "concessao_acesso_participacao_id_participacao_ppg_id_fk" FOREIGN KEY ("participacao_id") REFERENCES "public"."participacao_ppg"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_sistema" ADD CONSTRAINT "usuario_sistema_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_destinatario_id_pessoa_id_fk" FOREIGN KEY ("destinatario_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instituicao_nome_uk" ON "instituicao" USING btree ("nome");--> statement-breakpoint
CREATE UNIQUE INDEX "instituicao_nome_normalizado_uk" ON "instituicao" USING btree ("nome_normalizado");--> statement-breakpoint
CREATE INDEX "instituicao_tipo_idx" ON "instituicao" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "instituicao_estagio_idx" ON "instituicao" USING btree ("estagio_relacionamento");--> statement-breakpoint
CREATE INDEX "instituicao_substituida_por_idx" ON "instituicao" USING btree ("substituida_por_id");--> statement-breakpoint
CREATE UNIQUE INDEX "linha_pesquisa_ppg_nome_uk" ON "linha_pesquisa" USING btree ("ppg_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "pais_iso2_uk" ON "pais" USING btree ("codigo_iso2");--> statement-breakpoint
CREATE UNIQUE INDEX "pais_iso3_uk" ON "pais" USING btree ("codigo_iso3");--> statement-breakpoint
CREATE UNIQUE INDEX "pais_numerico_uk" ON "pais" USING btree ("codigo_numerico");--> statement-breakpoint
CREATE INDEX "pessoa_nome_idx" ON "pessoa" USING btree ("nome");--> statement-breakpoint
CREATE INDEX "pessoa_ppg_idx" ON "pessoa" USING btree ("ppg_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pessoa_email_uk" ON "pessoa" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "pessoa_cpf_uk" ON "pessoa" USING btree ("cpf");--> statement-breakpoint
CREATE UNIQUE INDEX "pessoa_orcid_uk" ON "pessoa" USING btree ("orcid");--> statement-breakpoint
CREATE UNIQUE INDEX "ppg_sigla_uk" ON "ppg" USING btree ("sigla");--> statement-breakpoint
CREATE INDEX "ppg_nome_idx" ON "ppg" USING btree ("nome");--> statement-breakpoint
CREATE UNIQUE INDEX "area_tematica_codigo_uk" ON "area_tematica" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "area_tematica_rede_idx" ON "area_tematica" USING btree ("rede_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ciclo_programa_nome_uk" ON "ciclo" USING btree ("programa_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "membro_comite_uk" ON "membro_comite" USING btree ("area_tematica_id","pessoa_id");--> statement-breakpoint
CREATE INDEX "membro_comite_pessoa_idx" ON "membro_comite" USING btree ("pessoa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participacao_ppg_uk" ON "participacao_ppg" USING btree ("area_tematica_id","ppg_id");--> statement-breakpoint
CREATE INDEX "participacao_ppg_ppg_idx" ON "participacao_ppg" USING btree ("ppg_id");--> statement-breakpoint
CREATE INDEX "participacao_ppg_coordenador_idx" ON "participacao_ppg" USING btree ("coordenador_tematica_id");--> statement-breakpoint
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
CREATE INDEX "bolsa_concedida_tematica_idx" ON "bolsa_concedida" USING btree ("area_tematica_id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_planejado_codigo_uk" ON "item_planejado" USING btree ("ciclo_id","codigo");--> statement-breakpoint
CREATE INDEX "item_planejado_tematica_idx" ON "item_planejado" USING btree ("area_tematica_id");--> statement-breakpoint
CREATE INDEX "item_planejado_ppg_idx" ON "item_planejado" USING btree ("ppg_id");--> statement-breakpoint
CREATE INDEX "item_planejado_rubrica_idx" ON "item_planejado" USING btree ("rubrica");--> statement-breakpoint
CREATE UNIQUE INDEX "planejamento_anual_uk" ON "planejamento_anual" USING btree ("item_planejado_id","ano");--> statement-breakpoint
CREATE INDEX "planejamento_anual_ano_idx" ON "planejamento_anual" USING btree ("ano");--> statement-breakpoint
CREATE INDEX "produto_bolsa_concessao_idx" ON "produto_bolsa" USING btree ("bolsa_concedida_id");--> statement-breakpoint
CREATE INDEX "produto_bolsa_prazo_idx" ON "produto_bolsa" USING btree ("prazo_entrega");--> statement-breakpoint
CREATE INDEX "produto_bolsa_status_idx" ON "produto_bolsa" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "lancamento_execucao_codigo_uk" ON "lancamento_execucao" USING btree ("ciclo_id","codigo");--> statement-breakpoint
CREATE INDEX "lancamento_execucao_ano_idx" ON "lancamento_execucao" USING btree ("ano");--> statement-breakpoint
CREATE INDEX "lancamento_execucao_tematica_idx" ON "lancamento_execucao" USING btree ("area_tematica_id");--> statement-breakpoint
CREATE INDEX "lancamento_execucao_ppg_idx" ON "lancamento_execucao" USING btree ("ppg_id");--> statement-breakpoint
CREATE UNIQUE INDEX "remanejamento_codigo_uk" ON "remanejamento" USING btree ("ciclo_id","codigo");--> statement-breakpoint
CREATE INDEX "remanejamento_ano_idx" ON "remanejamento" USING btree ("ano");--> statement-breakpoint
CREATE INDEX "remanejamento_status_idx" ON "remanejamento" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "remanejamento_chave_uk" ON "remanejamento" USING btree ("chave_idempotencia");--> statement-breakpoint
CREATE UNIQUE INDEX "evento_bolsista_chave_uk" ON "evento_bolsista" USING btree ("chave_idempotencia");--> statement-breakpoint
CREATE UNIQUE INDEX "evento_bolsista_substituta_uk" ON "evento_bolsista" USING btree ("bolsa_substituta_id") WHERE "evento_bolsista"."bolsa_substituta_id" is not null;--> statement-breakpoint
CREATE INDEX "evento_bolsista_bolsa_idx" ON "evento_bolsista" USING btree ("bolsa_concedida_id");--> statement-breakpoint
CREATE INDEX "anexo_entidade_idx" ON "anexo" USING btree ("entidade_tipo","entidade_id");--> statement-breakpoint
CREATE INDEX "anexo_categoria_idx" ON "anexo" USING btree ("categoria");--> statement-breakpoint
CREATE UNIQUE INDEX "anexo_caminho_uk" ON "anexo" USING btree ("caminho");--> statement-breakpoint
CREATE UNIQUE INDEX "pendencia_codigo_uk" ON "pendencia" USING btree ("ciclo_id","codigo");--> statement-breakpoint
CREATE INDEX "pendencia_status_idx" ON "pendencia" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pendencia_escopo_idx" ON "pendencia" USING btree ("escopo_tipo","escopo_id");--> statement-breakpoint
CREATE INDEX "auditoria_entidade_idx" ON "registro_auditoria" USING btree ("entidade_tipo","entidade_id");--> statement-breakpoint
CREATE INDEX "auditoria_ocorrido_idx" ON "registro_auditoria" USING btree ("ocorrido_em");--> statement-breakpoint
CREATE UNIQUE INDEX "atividade_missao_ordem_uk" ON "atividade_missao" USING btree ("missao_id","ordem");--> statement-breakpoint
CREATE INDEX "atividade_missao_missao_idx" ON "atividade_missao" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "atividade_missao_pais_idx" ON "atividade_missao" USING btree ("pais_id");--> statement-breakpoint
CREATE INDEX "atividade_missao_instituicao_idx" ON "atividade_missao" USING btree ("instituicao_id");--> statement-breakpoint
CREATE INDEX "atividade_missao_contato_idx" ON "atividade_missao" USING btree ("contato_instituicao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dispensa_requisito_vigente_uk" ON "dispensa_requisito_encerramento" USING btree ("missao_id","chave") WHERE "dispensa_requisito_encerramento"."revogada_em" is null;--> statement-breakpoint
CREATE INDEX "dispensa_requisito_missao_idx" ON "dispensa_requisito_encerramento" USING btree ("missao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membro_equipe_gestao_inicio_uk" ON "membro_equipe_gestao" USING btree ("ciclo_id","pessoa_id","tipo_equipe","data_inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "membro_equipe_gestao_ativo_uk" ON "membro_equipe_gestao" USING btree ("ciclo_id","pessoa_id","tipo_equipe") WHERE "membro_equipe_gestao"."data_fim" is null;--> statement-breakpoint
CREATE INDEX "membro_equipe_gestao_ciclo_idx" ON "membro_equipe_gestao" USING btree ("ciclo_id");--> statement-breakpoint
CREATE INDEX "membro_equipe_gestao_pessoa_idx" ON "membro_equipe_gestao" USING btree ("pessoa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membro_equipe_gestao_rede_uk" ON "membro_equipe_gestao_rede" USING btree ("membro_equipe_id","rede_id");--> statement-breakpoint
CREATE INDEX "membro_equipe_gestao_rede_membro_idx" ON "membro_equipe_gestao_rede" USING btree ("membro_equipe_id");--> statement-breakpoint
CREATE INDEX "membro_equipe_gestao_rede_rede_idx" ON "membro_equipe_gestao_rede" USING btree ("rede_id");--> statement-breakpoint
CREATE UNIQUE INDEX "missao_comite_codigo_uk" ON "missao_comite" USING btree ("ciclo_id","codigo");--> statement-breakpoint
CREATE INDEX "missao_comite_ciclo_status_idx" ON "missao_comite" USING btree ("ciclo_id","status");--> statement-breakpoint
CREATE INDEX "missao_comite_periodo_idx" ON "missao_comite" USING btree ("data_inicio","data_fim");--> statement-breakpoint
CREATE UNIQUE INDEX "missao_participante_pessoa_uk" ON "missao_participante" USING btree ("missao_id","pessoa_id");--> statement-breakpoint
CREATE INDEX "missao_participante_missao_idx" ON "missao_participante" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "missao_participante_pessoa_idx" ON "missao_participante" USING btree ("pessoa_id");--> statement-breakpoint
CREATE INDEX "missao_participante_equipe_idx" ON "missao_participante" USING btree ("membro_equipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "missao_participante_responsavel_uk" ON "missao_participante" USING btree ("missao_id") WHERE "missao_participante"."papel" = 'RESPONSAVEL';--> statement-breakpoint
CREATE UNIQUE INDEX "missao_rede_uk" ON "missao_rede" USING btree ("missao_id","rede_id");--> statement-breakpoint
CREATE INDEX "missao_rede_missao_idx" ON "missao_rede" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "missao_rede_rede_idx" ON "missao_rede" USING btree ("rede_id");--> statement-breakpoint
CREATE INDEX "contato_instituicao_instituicao_nome_idx" ON "contato_instituicao" USING btree ("instituicao_id","nome_normalizado");--> statement-breakpoint
CREATE INDEX "contato_instituicao_pais_idx" ON "contato_instituicao" USING btree ("pais_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contato_instituicao_principal_ativo_uk" ON "contato_instituicao" USING btree ("instituicao_id") WHERE "contato_instituicao"."principal" is true and "contato_instituicao"."ativo" is true;--> statement-breakpoint
CREATE UNIQUE INDEX "contato_instituicao_email_uk" ON "contato_instituicao" USING btree ("instituicao_id","email_normalizado");--> statement-breakpoint
CREATE UNIQUE INDEX "instituicao_rede_uk" ON "instituicao_rede" USING btree ("instituicao_id","rede_id");--> statement-breakpoint
CREATE INDEX "instituicao_rede_rede_idx" ON "instituicao_rede" USING btree ("rede_id");--> statement-breakpoint
CREATE INDEX "cotacao_despesa_idx" ON "cotacao_passagem" USING btree ("despesa_id");--> statement-breakpoint
CREATE INDEX "despesa_prestacao_idx" ON "despesa_missao" USING btree ("prestacao_id");--> statement-breakpoint
CREATE INDEX "despesa_exercicio_idx" ON "despesa_missao" USING btree ("exercicio","tipo");--> statement-breakpoint
CREATE INDEX "despesa_participante_idx" ON "despesa_missao" USING btree ("participante_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prestacao_missao_uk" ON "prestacao_contas_missao" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "prestacao_status_idx" ON "prestacao_contas_missao" USING btree ("status");--> statement-breakpoint
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
CREATE UNIQUE INDEX "decisao_comite_rodada_uk" ON "decisao_comite" USING btree ("rodada_id");--> statement-breakpoint
CREATE INDEX "decisao_comite_acao_idx" ON "decisao_comite" USING btree ("acao","decidido_em");--> statement-breakpoint
CREATE UNIQUE INDEX "decisao_documento_uk" ON "decisao_documento" USING btree ("decisao_id","anexo_id");--> statement-breakpoint
CREATE INDEX "decisao_documento_decisao_idx" ON "decisao_documento" USING btree ("decisao_id");--> statement-breakpoint
CREATE INDEX "decisao_documento_anexo_idx" ON "decisao_documento" USING btree ("anexo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requisito_submissao_tipo_uk" ON "requisito_submissao" USING btree ("ciclo_id","momento","categoria","tipo_missao") WHERE "requisito_submissao"."tipo_missao" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "requisito_submissao_geral_uk" ON "requisito_submissao" USING btree ("ciclo_id","momento","categoria") WHERE "requisito_submissao"."tipo_missao" is null;--> statement-breakpoint
CREATE INDEX "requisito_submissao_consulta_idx" ON "requisito_submissao" USING btree ("ciclo_id","momento","ativo");--> statement-breakpoint
CREATE UNIQUE INDEX "rodada_analise_numero_uk" ON "rodada_analise" USING btree ("missao_id","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "rodada_analise_aberta_uk" ON "rodada_analise" USING btree ("missao_id") WHERE "rodada_analise"."encerrada_em" is null;--> statement-breakpoint
CREATE INDEX "rodada_analise_missao_idx" ON "rodada_analise" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "rodada_analise_fila_idx" ON "rodada_analise" USING btree ("submetido_em") WHERE "rodada_analise"."encerrada_em" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "concessao_global_uk" ON "concessao_acesso" USING btree ("usuario_id","permissao") WHERE "concessao_acesso"."tipo_alvo" = 'GLOBAL';--> statement-breakpoint
CREATE UNIQUE INDEX "concessao_ciclo_uk" ON "concessao_acesso" USING btree ("usuario_id","permissao","ciclo_id") WHERE "concessao_acesso"."tipo_alvo" = 'CICLO';--> statement-breakpoint
CREATE UNIQUE INDEX "concessao_ppg_uk" ON "concessao_acesso" USING btree ("usuario_id","permissao","ppg_id","ciclo_id") WHERE "concessao_acesso"."tipo_alvo" = 'PPG';--> statement-breakpoint
CREATE UNIQUE INDEX "concessao_rede_uk" ON "concessao_acesso" USING btree ("usuario_id","permissao","rede_id") WHERE "concessao_acesso"."tipo_alvo" = 'REDE';--> statement-breakpoint
CREATE UNIQUE INDEX "concessao_tematica_uk" ON "concessao_acesso" USING btree ("usuario_id","permissao","area_tematica_id") WHERE "concessao_acesso"."tipo_alvo" = 'TEMATICA';--> statement-breakpoint
CREATE UNIQUE INDEX "concessao_participacao_uk" ON "concessao_acesso" USING btree ("usuario_id","permissao","participacao_id") WHERE "concessao_acesso"."tipo_alvo" = 'PARTICIPACAO';--> statement-breakpoint
CREATE INDEX "concessao_usuario_idx" ON "concessao_acesso" USING btree ("usuario_id","ativo");--> statement-breakpoint
CREATE INDEX "concessao_permissao_idx" ON "concessao_acesso" USING btree ("permissao","ativo");--> statement-breakpoint
CREATE UNIQUE INDEX "usuario_sistema_sub_uk" ON "usuario_sistema" USING btree ("sub");--> statement-breakpoint
CREATE UNIQUE INDEX "usuario_sistema_pessoa_uk" ON "usuario_sistema" USING btree ("pessoa_id");--> statement-breakpoint
CREATE INDEX "usuario_sistema_email_idx" ON "usuario_sistema" USING btree ("email");--> statement-breakpoint
CREATE INDEX "notificacao_destinatario_idx" ON "notificacao" USING btree ("destinatario_id","lida_em");--> statement-breakpoint
CREATE INDEX "notificacao_missao_idx" ON "notificacao" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "notificacao_entrega_idx" ON "notificacao" USING btree ("entrega_estado") WHERE "notificacao"."entrega_estado" = 'PENDENTE';--> statement-breakpoint
CREATE UNIQUE INDEX "notificacao_pendencia_uk" ON "notificacao" USING btree ("missao_id","destinatario_id","tipo") WHERE "notificacao"."tipo" = 'PRESTACAO_PENDENTE';