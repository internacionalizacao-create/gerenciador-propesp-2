# Histórico — decisões do responsável, por data

Índice cronológico das decisões que moldaram o sistema. Cada linha diz **o que
foi decidido** e **onde está o porquê por extenso** — o texto integral nunca foi
apagado, só mudou de lugar na reorganização de 2026-09-22.

Serve para responder "por que isto é assim?" quando o código não explica. Para
saber **o que fazer agora**, veja [../backlog-v1.md](../backlog-v1.md) e o bloco
do topo do [`AGENTS.md`](../../AGENTS.md).

| Data | Decisão | Porquê por extenso |
|---|---|---|
| 2026-09-01 | A equipe entrega a especificação ampliada do Comitê Gestor (40 seções): aprovação, parceiros, contatos, produtos, documentos, convênios, indicadores e relatórios. | [revisao-escopo-comite-gestor-2026-09-01.md](../revisao-escopo-comite-gestor-2026-09-01.md) |
| 2026-09-05 | Modelo **B** de aprovação: o colegiado delibera fora do sistema e o relator registra o parecer com a data da deliberação. Aprovação é dimensão própria, independente da execução. Requisitos documentais são **dado**, não lista no código. | [comite-gestor.md](comite-gestor.md#aprovação-submissão-e-decisão-cg-019-cg-037-cg-038) |
| 2026-09-05 | `ARQUIVOS_DIR` sai do versionamento: o primeiro upload criava diretório dentro do repositório. | [comite-gestor.md](comite-gestor.md) |
| 2026-09-06 | `CONCLUIR` passa pelo **checklist inteiro**, e `CONCLUIDA` deixa de significar "a viagem acabou" para significar "encerrada e acertada". Nada do checklist é gravado. | [comite-gestor.md](comite-gestor.md#encerramento-e-checklist-cg-058-cg-059) |
| 2026-09-06 | Produto de missão é domínio próprio (`produto_missao`), separado de `produto_bolsa`; o convênio ancora-se na instituição, não na missão. | [comite-gestor.md](comite-gestor.md#produtos-e-convênios-cg-056) |
| 2026-09-06 | O relato da missão são **dois** formulários: o relato edita o planejado, e a parada extra é acrescentada à parte. | [comite-gestor.md](comite-gestor.md#relato-dossiê-e-fila-de-análise-cg-046-cg-047-cg-048) |
| 2026-09-07 | DOC/DOCX e XLS/XLSX saem dos formatos aceitos: o PDF basta por enquanto e não há antivírus. | [comite-gestor.md](comite-gestor.md#regras-financeiras-cg-009) |
| 2026-09-07 | `RESTRITA` é visível ao Comitê Gestor, e não só ao `admin` e a quem enviou. A checagem por papel dentro do serviço vira permissão. | [comite-gestor.md](comite-gestor.md#fotos-e-evidências-cg-057) |
| 2026-09-07 | Escopo por rede nas missões (CG-028): "minha rede" é o alcance da ação, não o vínculo de equipe. | [comite-gestor.md](comite-gestor.md#escopo-por-rede-nas-missões-cg-028-na-íntegra) |
| 2026-09-08 | Cadastro institucional (catálogo, modalidades, PPGs) é do `admin`; `ppg:write` sai do coordenador. Publicar item de catálogo é livre, alterar item **em uso** não é. | [planejamento-e-catalogo.md](planejamento-e-catalogo.md#cadastro-institucional-é-do-admin) |
| 2026-09-08 | A P13 perde a tela: contagem que não abre em lugar nenhum. API e dados permanecem. | [planejamento-e-catalogo.md](planejamento-e-catalogo.md#p13-não-tem-mais-tela) |
| 2026-09-09 | As sete decisões do módulo Bolsistas (D-B01 a D-B07) são homologadas. Duas valem como regra permanente: `bolsa_concedida` **é** a mobilidade, e `missao_comite` não é reusada para mobilidade de bolsista. | [../homologacao-bolsistas.md](../homologacao-bolsistas.md), [bolsistas-e-mobilidade.md](bolsistas-e-mobilidade.md) |
| 2026-09-09 | A categoria do documento decide a visibilidade, nunca o cliente. `PESSOAL` e `RESTRITA` não são níveis, são públicos diferentes. | [bolsistas-e-mobilidade.md](bolsistas-e-mobilidade.md#documentos-do-bolsista-bol-021bol-022-2026-09-09) |
| 2026-09-09 | Texto que o usuário lê passa a ser acentuado em toda a API — **197 strings em 26 arquivos de `apps/api/src`**, mais as asserções de teste que casavam com o texto antigo; comentário de código segue sem acento. | `AGENTS.md` §7 |
| 2026-09-10 | Código interno (RN-09, CG-028, D-10, PEND-006) não aparece na tela: **33 ocorrências removidas** em web e API, três das quais afirmavam como futuro o que já estava entregue ("o escopo por rede entra na CG-028"). | `AGENTS.md` §7 |
| 2026-09-10 | A P01 é um **painel**, não um relatório: cinco blocos, do geral ao detalhe, com o mapa de composição no centro. | [planejamento-e-catalogo.md](planejamento-e-catalogo.md), [bolsistas-e-mobilidade.md](bolsistas-e-mobilidade.md) |
| 2026-09-10 | O menu mostra só o que existe: item "em breve" lia como sistema inacabado. | [../guia-interface.md](../guia-interface.md) |
| 2026-09-10 | A cor de uma rede sai do **nome**, nunca da posição. | [../guia-interface.md](../guia-interface.md) |
| 2026-09-10 | Home por perfil fica adiada enquanto não houver recorte de plano e orçamento (entregue depois, na V1-013). | `AGENTS.md` §9 |
| 2026-09-11 | O destino da bolsa volta a ser digitado, a pedido da equipe; `resolverPontas` reconhece a grafia do catálogo e grava a FK quando coincide. | [bolsistas-e-mobilidade.md](bolsistas-e-mobilidade.md#cadastro-individual-da-concessão-p03) |
| 2026-09-14 | Ajustes de usabilidade: notificações no canto superior direito, `Pagina.voltar`, `Ajuda` por mouse/foco/toque. | [../guia-interface.md](../guia-interface.md) |
| 2026-09-15 | Modelo de autorização aprovado: concessões individuais de permissão + escopo na aplicação; Keycloak autentica; perfis viram modelos opcionais. Público interno, sem autosserviço. | [../proposta-autorizacao-v1.md](../proposta-autorizacao-v1.md) |
| 2026-09-16 | **Em produção o Keycloak só autentica.** Nenhum papel de negócio é criado ou atribuído lá. `permissionsForRoles`, `ROLE_PERMISSIONS`, `missao:all-redes` e o modo permissivo `RECORTE_OBRIGATORIO` deixam de existir. | [autorizacao.md](autorizacao.md) |
| 2026-09-16 | Não existe conversão do acesso legado: numa base que começa limpa não há o que converter. | [autorizacao.md](autorizacao.md) |
| 2026-09-17 | V1-013 e V1-014: plano, orçamento, painel, programas e ciclos recortam linhas **e agregados** pela ação exercida. | [autorizacao.md](autorizacao.md) |
| 2026-09-18 | V1-015/V1-016: cada ação tem o seu próprio alcance; CPF, e-mail e telefone só saem no JSON para quem tem a capacidade específica **e** alcance sobre aquele alvo. Sem máscara parcial. | [autorizacao.md](autorizacao.md), [bolsistas-e-mobilidade.md](bolsistas-e-mobilidade.md) |
| 2026-09-18 | A seed sobe **só a base estrutural**; plano, equipes e pendências ficam para a interface cadastrar. `--com-dados` carrega os dados da planilha. | [planejamento-e-catalogo.md](planejamento-e-catalogo.md#seed-com-os-dados-reais) |
| 2026-09-18 | Um administrador pode ser semeado com `--admin-sub`, contrariando o desenho anterior. O que segura o risco é **não haver padrão algum**. | [autorizacao.md](autorizacao.md) |
| 2026-09-19 | **É um gerenciador, e só**: não há sincronização com a CAPES, o sistema confia no que o usuário registra, e divergir não é erro do sistema. | `AGENTS.md` §1 |
| 2026-09-19 | O build deixa de depender de internet: as fontes saem de `next/font/google` e passam a vir do pacote `geist`. | `AGENTS.md` §4 |
| 2026-09-20 | V1-034: a participação PPG–temática passa a ser administrada pela tela, com escopo `GLOBAL` — a participação é ela própria alvo de concessão. | [planejamento-e-catalogo.md](planejamento-e-catalogo.md#p10-participação-ppgtemática-e-edição-de-linha) |
| 2026-09-21 | V1-036/V1-037: eventos externos da CAPES entram por registro, consulta e correção. Correção não apaga; reenvio não duplica. | [eventos-externos.md](eventos-externos.md), [../eventos-externos-v1.md](../eventos-externos-v1.md) |
| 2026-09-22 | Os responsáveis da V1 são registrados por **equipe**, não por interlocutor nominal; a V1-001 é concluída. A V1 se concentra no fluxo de autorização e onze fichas são adiadas. | `AGENTS.md` (topo), [../backlog-v1.md](../backlog-v1.md) |
| 2026-09-22 | A documentação é reorganizada: o `AGENTS.md` deixa de ser changelog e o relato histórico vem para este diretório. | [README.md](README.md) |
