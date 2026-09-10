"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";

import { useDebounce } from "@/componentes/consultas/debounce";
import { Campo } from "@/componentes/ui/campos";
import { Combobox, type OpcaoCombobox } from "@/componentes/ui/combobox";
import { buscarNoBff, caminhoBff } from "@/lib/bff";
import type { InstituicaoOpcao } from "@/lib/dominio";

/**
 * Seletor de instituição com busca **no servidor** (BOL-010).
 *
 * Difere do `CampoCombobox`, que filtra no cliente sobre uma lista já carregada
 * — certo para os 249 países da ISO, que são lista fechada e cabem no payload
 * da página. O cadastro institucional não é fechado: ele existe para crescer, e
 * é o propósito declarado do módulo de parceiros. Filtrar no cliente
 * funcionaria com as poucas instituições de hoje e deixaria de funcionar sem
 * ninguém perceber, porque a lista simplesmente passaria a vir cortada pelo
 * teto do serviço.
 *
 * Três coisas que a implementação ingênua erra:
 *
 * - **`initialData` só vale para o termo vazio.** É a lista que o Server
 *   Component já buscou; associá-la a qualquer termo faria a primeira busca
 *   exibir o resultado de outra pergunta.
 * - **A opção escolhida é fixada na lista.** O que está selecionado pode não
 *   estar na página de resultados atual — basta buscar outra coisa depois de
 *   escolher. Sem fixá-la, o campo mostraria o `placeholder` sobre um valor
 *   preenchido, e a pessoa reescolheria achando que perdeu o que fez.
 * - **`shouldFilter` do cmdk fica desligado.** Ele filtraria de novo, no
 *   cliente, o que o servidor já filtrou — e esconderia resultados legítimos
 *   cujo nome não contém o termo digitado, como uma sigla casada no servidor.
 */
export function CampoInstituicao<T extends FieldValues>({
  rotulo,
  nome,
  control,
  iniciais,
  dica,
  erro,
  obrigatorio,
}: {
  rotulo: string;
  nome: Path<T>;
  control: Control<T>;
  /** Primeira página, vinda do Server Component. */
  iniciais: InstituicaoOpcao[];
  dica?: React.ReactNode;
  erro?: string;
  obrigatorio?: boolean;
}) {
  const [termo, definirTermo] = useState("");
  const [fixada, definirFixada] = useState<InstituicaoOpcao | null>(null);
  const termoAdiado = useDebounce(termo.trim(), 300);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["bolsistas", "instituicoes", termoAdiado],
    queryFn: () =>
      buscarNoBff<InstituicaoOpcao[]>(
        caminhoBff("bolsistas/instituicoes", { busca: termoAdiado }),
      ),
    initialData: termoAdiado === "" ? iniciais : undefined,
    placeholderData: keepPreviousData,
  });

  const encontradas = data ?? [];
  const listadas =
    fixada && !encontradas.some((item) => item.id === fixada.id)
      ? [fixada, ...encontradas]
      : encontradas;

  const opcoes: OpcaoCombobox[] = listadas.map((instituicao) => ({
    valor: instituicao.id,
    rotulo: instituicao.nome,
    detalhe: [instituicao.sigla, instituicao.cidade, instituicao.pais]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <Campo rotulo={rotulo} dica={dica} erro={erro} obrigatorio={obrigatorio}>
      {(id, descritoPor) => (
        <Controller
          control={control}
          name={nome}
          render={({ field }) => (
            <Combobox
              id={id}
              descritoPor={descritoPor}
              nome={field.name}
              opcoes={opcoes}
              valor={(field.value as string | undefined) ?? ""}
              aoMudar={(valor) => {
                definirFixada(
                  listadas.find((item) => item.id === valor) ?? null,
                );
                field.onChange(valor);
              }}
              invalido={Boolean(erro)}
              filtrarNoCliente={false}
              aoBuscar={definirTermo}
              placeholder="Selecione a instituição"
              placeholderBusca="Buscar por nome ou sigla"
              textoVazio={
                isError
                  ? "Não foi possível buscar agora."
                  : isFetching
                    ? "Buscando…"
                    : "Nenhuma instituição encontrada. Use “Informar outro nome”."
              }
            />
          )}
        />
      )}
    </Campo>
  );
}
