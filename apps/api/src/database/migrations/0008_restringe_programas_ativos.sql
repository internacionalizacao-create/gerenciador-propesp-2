-- O escopo operacional atual inclui somente o CAPES Global. Os demais
-- programas permanecem cadastrados para reativacao futura, sem aparecer na UI.
UPDATE "programa"
   SET "ativo" = ("slug" = 'capes-global'),
       "atualizado_em" = now();
