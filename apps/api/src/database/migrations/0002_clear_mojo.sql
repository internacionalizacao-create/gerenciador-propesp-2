ALTER TABLE "participacao_ppg" ADD COLUMN "coordenador_tematica_id" uuid;--> statement-breakpoint
ALTER TABLE "participacao_ppg" ADD CONSTRAINT "participacao_ppg_coordenador_tematica_id_pessoa_id_fk" FOREIGN KEY ("coordenador_tematica_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participacao_ppg_coordenador_idx" ON "participacao_ppg" USING btree ("coordenador_tematica_id");--> statement-breakpoint
UPDATE "participacao_ppg" pp
   SET "coordenador_tematica_id" = unico.pessoa_id
  FROM (
    SELECT area_tematica_id, min(pessoa_id::text)::uuid AS pessoa_id
      FROM membro_comite
     GROUP BY area_tematica_id
    HAVING count(*) = 1
  ) unico
 WHERE unico.area_tematica_id = pp.area_tematica_id;--> statement-breakpoint
UPDATE "participacao_ppg" pp
   SET "coordenador_tematica_id" = pessoa_escolhida.id
  FROM area_tematica at,
       ppg p,
       pessoa pessoa_escolhida
 WHERE pp.area_tematica_id = at.id
   AND pp.ppg_id = p.id
   AND at.codigo = 'UNICAMP-T1'
   AND pessoa_escolhida.nome = CASE
     WHEN p.sigla = 'PROFSAÚDE' THEN 'Profa. Dra. Sônia Maria Lemos'
     ELSE 'Profa. Dra. Gisely Cardoso de Melo'
   END;
