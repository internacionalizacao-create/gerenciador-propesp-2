"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";

import {
  atualizarItemCatalogo,
  criarItemCatalogo,
  removerItemCatalogo,
} from "@/acoes/catalogo";
import { AreaTexto, Grade, Selecao, Texto } from "@/componentes/ui/campos";
import { useErrosDaAcao } from "@/componentes/ui/formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import type { ItemCatalogoListado, Modalidade } from "@/lib/dominio";
import { moeda, rotulo } from "@/lib/formato";
import {
  formularioItemCatalogoEdicaoSchema,
  formularioItemCatalogoSchema,
  type DadosFormularioItemCatalogo,
} from "@/lib/formularios/catalogo";

const CAMPOS_DA_API = {
  destino: "destino",
  modalidadeId: "modalidadeId",
  vigenciaMeses: "vigenciaMeses",
  valorBrl: "valorBrl",
  valorUsd: "valorUsd",
  fonte: "fonte",
  observacao: "observacao",
  justificativa: "justificativa",
} as const;

export function NovoItemCatalogo({
  modalidades,
}: {
  modalidades: Modalidade[];
}) {
  return (
    <AbrirSidesheet
      rotulo="Novo item"
      titulo="Publicar item no catálogo"
      descricao="O item entra na tabela vigente e passa a valer para as linhas de plano criadas a partir de agora. Nenhum custo já calculado muda."
    >
      {(fechar) => (
        <FormItemCatalogo modalidades={modalidades} aoConcluir={fechar} />
      )}
    </AbrirSidesheet>
  );
}

export function EditarItemCatalogo({
  item,
  modalidades,
}: {
  item: ItemCatalogoListado;
  modalidades: Modalidade[];
}) {
  return (
    <AbrirSidesheet
      rotulo="Editar"
      variante="secundaria"
      titulo={`${item.codigo} · ${item.modalidade}`}
      descricao={
        item.usos > 0
          ? `Este item já é a base de custo de ${item.usos} linha(s) do plano. Destino, modalidade, vigência e valor ficam travados; fonte e observação continuam editáveis.`
          : "O item ainda não é usado por nenhuma linha do plano e pode ser alterado por inteiro."
      }
    >
      {(fechar) => (
        <FormItemCatalogo
          item={item}
          modalidades={modalidades}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function FormItemCatalogo({
  item,
  modalidades,
  aoConcluir,
}: {
  item?: ItemCatalogoListado;
  modalidades: Modalidade[];
  aoConcluir: () => void;
}) {
  const acao = item
    ? atualizarItemCatalogo.bind(null, item.id)
    : criarItemCatalogo;
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  useToastDaAcao(estado, aoConcluir);

  // Item em uso tem a chave e o valor travados na API. Travar aqui também não
  // é redundância: é o que impede a pessoa de preencher tudo para receber um
  // 409 no fim.
  const travado = (item?.usos ?? 0) > 0;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosFormularioItemCatalogo>({
    resolver: zodResolver(
      item ? formularioItemCatalogoEdicaoSchema : formularioItemCatalogoSchema,
    ),
    defaultValues: {
      destino: item?.destino ?? "BRASIL",
      modalidadeId: item?.modalidadeId ?? "",
      vigenciaMeses: item?.vigenciaMeses ?? "",
      valorBrl: item?.valorBrl ?? "",
      valorUsd: item?.valorUsd ?? "",
      fonte: item?.fonte ?? "",
      observacao: item?.observacao ?? "",
      justificativa: "",
    },
  });

  useErrosDaAcao(estado, setError, CAMPOS_DA_API);

  const erroDe = (campo: keyof DadosFormularioItemCatalogo) =>
    errors[campo]?.message;

  const aoEnviar = handleSubmit((dados) => {
    startTransition(() => executar(dados));
  });

  const disponiveis = modalidades.filter(
    (m) => m.ativa || m.id === item?.modalidadeId,
  );

  return (
    <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {travado && item ? (
          // Campos travados viram texto, e nao input desabilitado: o React Hook
          // Form devolve `undefined` para campo desabilitado, e o payload
          // chegaria sem destino nem valor. Sem input, o valor de
          // `defaultValues` segue inteiro para a acao.
          <dl className="mb-5 grid grid-cols-2 gap-3 rounded-xl bg-surface-muted px-4 py-3 text-sm">
            <Travado rotulo="Destino" valor={rotulo(item.destino)} />
            <Travado rotulo="Modalidade" valor={item.modalidade} />
            <Travado
              rotulo="Vigência"
              valor={`${Number(item.vigenciaMeses)} mês(es)`}
            />
            <Travado rotulo="Valor" valor={moeda(item.valorBrl)} />
          </dl>
        ) : (
          <>
            <Grade>
              <Selecao
                rotulo="Destino"
                nome="destino"
                obrigatorio
                registro={register("destino")}
                opcoes={[
                  { valor: "BRASIL", texto: "Brasil (entrada na UEA)" },
                  { valor: "EXTERIOR", texto: "Exterior (saída da UEA)" },
                ]}
                erro={erroDe("destino")}
              />
              <Selecao
                rotulo="Modalidade"
                nome="modalidadeId"
                obrigatorio
                vazio="Selecione"
                registro={register("modalidadeId")}
                opcoes={disponiveis.map((m) => ({
                  valor: m.id,
                  texto: m.nome,
                }))}
                erro={erroDe("modalidadeId")}
              />
            </Grade>

            <Grade>
              <Texto
                rotulo="Vigência (meses)"
                nome="vigenciaMeses"
                obrigatorio
                placeholder="6"
                dica="Uma casa decimal. Bolsa de até 15 dias vale 0,5 mês."
                registro={register("vigenciaMeses")}
                erro={erroDe("vigenciaMeses")}
              />
              <Texto
                rotulo="Valor em reais"
                nome="valorBrl"
                obrigatorio
                placeholder="21650,00"
                dica="É este valor que o plano multiplica pela quantidade."
                registro={register("valorBrl")}
                erro={erroDe("valorBrl")}
              />
            </Grade>
          </>
        )}

        <Texto
          rotulo="Valor em dólares"
          nome="valorUsd"
          dica="Só registro do anexo de origem; nenhum cálculo o usa."
          registro={register("valorUsd")}
          erro={erroDe("valorUsd")}
        />

        <Texto
          rotulo="Fonte"
          nome="fonte"
          obrigatorio
          placeholder="Portaria nº 33, de 16 de fevereiro de 2023"
          registro={register("fonte")}
          erro={erroDe("fonte")}
        />

        <AreaTexto
          rotulo="Observação"
          nome="observacao"
          linhas={2}
          registro={register("observacao")}
          erro={erroDe("observacao")}
        />

        {item ? (
          <AreaTexto
            rotulo="Justificativa da alteração"
            nome="justificativa"
            obrigatorio
            linhas={3}
            dica="Fica na auditoria, ao lado de cada campo alterado."
            registro={register("justificativa")}
            erro={erroDe("justificativa")}
          />
        ) : null}
      </div>

      <div className="shrink-0 border-t border-border bg-surface-muted px-6 py-4">
        {!estado.ok && estado.mensagem ? (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-on-danger-soft"
          >
            {estado.mensagem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={aoConcluir}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {enviando ? "Salvando…" : item ? "Salvar alterações" : "Publicar"}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Remoção existe só para o item recém-digitado errado: a API recusa remover
 * item que já é base de custo de alguma linha, porque apagá-lo deixaria a
 * linha sem como explicar o próprio valor.
 */
export function RemoverItemCatalogo({ item }: { item: ItemCatalogoListado }) {
  const [estado, executar, enviando] = useActionState(
    removerItemCatalogo.bind(null, item.id),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, () => {});

  if (item.usos > 0) return null;

  return (
    <form action={executar} className="inline">
      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg px-2 py-1 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
      >
        {enviando ? "Removendo…" : "Remover"}
      </button>
    </form>
  );
}

function Travado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{rotulo}</dt>
      <dd className="font-medium text-foreground">{valor}</dd>
    </div>
  );
}
