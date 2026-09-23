-- CG-016 · associacao entre missao e rede coordenadora.
--
-- Missoes anteriores a esta migration ficam SEM rede, de proposito. O backlog
-- proibe inferir a rede pela instituicao visitada ou pelo participante: a
-- instituicao de destino e estrangeira e o participante pode integrar equipes
-- de mais de uma rede, entao qualquer inferencia gravaria um palpite como se
-- fosse dado da planilha.
--
-- A regra explicita e: leitura tolera missao sem rede e a interface a mostra
-- como "Sem rede definida"; criacao e edicao passam a exigir pelo menos uma.
-- Assim a regularizacao acontece na primeira edicao, com autoria e auditoria,
-- em vez de acontecer aqui sem ninguem responder por ela.

CREATE TABLE "missao_rede" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"missao_id" uuid NOT NULL,
	"rede_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "missao_rede" ADD CONSTRAINT "missao_rede_missao_id_missao_comite_id_fk" FOREIGN KEY ("missao_id") REFERENCES "public"."missao_comite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missao_rede" ADD CONSTRAINT "missao_rede_rede_id_rede_coordenadora_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede_coordenadora"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "missao_rede_uk" ON "missao_rede" USING btree ("missao_id","rede_id");--> statement-breakpoint
CREATE INDEX "missao_rede_missao_idx" ON "missao_rede" USING btree ("missao_id");--> statement-breakpoint
CREATE INDEX "missao_rede_rede_idx" ON "missao_rede" USING btree ("rede_id");