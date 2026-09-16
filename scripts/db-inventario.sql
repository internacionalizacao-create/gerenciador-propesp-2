-- Contagem exata de linhas por tabela do schema public.
--
-- `pg_stat_user_tables.n_live_tup` seria mais barato, mas e uma estimativa que
-- depende do ultimo autovacuum — e um inventario aproximado nao serve para
-- conferir se um restore voltou completo.
select format('%-34s %s', tablename,
         (xpath('/row/c/text()',
                query_to_xml(format('select count(*) as c from %I.%I', schemaname, tablename),
                             false, true, '')))[1]::text)
  from pg_tables
 where schemaname = 'public'
 order by tablename;
