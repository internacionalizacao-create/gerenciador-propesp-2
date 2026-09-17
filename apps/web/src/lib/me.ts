import "server-only";

import { cache } from "react";

import { apiFetch } from "./api";
import type { Me, MeuAcesso } from "./dominio";

/**
 * Identidade e capacidades da conta logada, uma vez por requisição (V1-019).
 *
 * O layout precisa delas para montar o menu e cada página para decidir se tem o
 * que mostrar — antes disto, abrir uma tela custava duas ou três chamadas
 * iguais a `/me`. O `cache` do React resolve isso **dentro de uma requisição**,
 * que é exatamente o limite certo: um `Map` de módulo viveria no processo do
 * servidor e serviria as permissões de quem entrou antes para quem entrar
 * depois — e a revogação, que a API faz valer na requisição seguinte, deixaria
 * de valer na tela.
 *
 * Pelo mesmo motivo `apiFetch` usa `cache: "no-store"`: não há cache de HTTP
 * por baixo deste, só a deduplicação do render em curso.
 */
export const carregarMe = cache(() => apiFetch<Me>("/me"));

/**
 * O acesso da própria conta, com o alcance de cada ação já em português.
 *
 * Custa mais que `/me` (resolve os nomes dos alvos), então só a tela "Sua
 * conta" o pede. Não exige permissão nenhuma: é a conta lendo a si mesma.
 */
export const carregarMeuAcesso = cache(() =>
  apiFetch<MeuAcesso>("/me/acesso"),
);
