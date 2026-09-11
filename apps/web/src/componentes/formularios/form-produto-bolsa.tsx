"use client";

import { useActionState, useState } from "react";

import { atualizarProdutoBolsa, criarProdutoBolsa } from "@/acoes/bolsistas";
import { AreaTexto, Data, Grade, Selecao, Texto } from "@/componentes/ui/campos";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import type { ProdutoBolsa, StatusProdutoBolsa } from "@/lib/dominio";

const TIPOS = [
  { valor: "ARTIGO", texto: "Artigo" },
  { valor: "TRABALHO", texto: "Trabalho" },
  { valor: "PROJETO", texto: "Projeto" },
  { valor: "RELATORIO", texto: "Relatório" },
  { valor: "PUBLICACAO", texto: "Publicação" },
  { valor: "LIVRO", texto: "Livro" },
  { valor: "CAPITULO_LIVRO", texto: "Capítulo de livro" },
  { valor: "PATENTE", texto: "Patente" },
  { valor: "EVENTO", texto: "Evento" },
  // BOL-050: cooperação científica do documento da equipe.
  { valor: "TESE_COTUTELA", texto: "Tese em cotutela" },
  { valor: "ORIENTACAO_CONJUNTA", texto: "Orientação conjunta" },
  { valor: "OUTRO", texto: "Outro" },
];

const STATUS = [
  { valor: "PREVISTO", texto: "Previsto" },
  { valor: "EM_DESENVOLVIMENTO", texto: "Em desenvolvimento" },
  { valor: "ENTREGUE", texto: "Entregue" },
  { valor: "VALIDADO", texto: "Validado" },
  { valor: "CANCELADO", texto: "Cancelado" },
];

export function NovoProdutoBolsa({ bolsaId }: { bolsaId: string }) {
  return (
    <AbrirSidesheet
      rotulo="Cadastrar produto"
      titulo="Produto esperado do bolsista"
      descricao="Registre cada entrega individualmente, inclusive antes de ela ficar pronta, para que o prazo possa ser acompanhado."
    >
      {(fechar) => <FormProduto bolsaId={bolsaId} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

export function EditarProdutoBolsa({
  bolsaId,
  produto,
}: {
  bolsaId: string;
  produto: ProdutoBolsa;
}) {
  return (
    <AbrirSidesheet
      rotulo="Atualizar"
      variante="secundaria"
      titulo={produto.titulo}
      descricao="Atualize o andamento e registre a data e a evidência da entrega."
    >
      {(fechar) => (
        <FormProduto bolsaId={bolsaId} produto={produto} aoConcluir={fechar} />
      )}
    </AbrirSidesheet>
  );
}

function FormProduto({
  bolsaId,
  produto,
  aoConcluir,
}: {
  bolsaId: string;
  produto?: ProdutoBolsa;
  aoConcluir: () => void;
}) {
  const acao = produto
    ? atualizarProdutoBolsa.bind(null, bolsaId, produto.id)
    : criarProdutoBolsa.bind(null, bolsaId);
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  const [status, setStatus] = useState<StatusProdutoBolsa>(
    produto?.status ?? "PREVISTO",
  );
  useToastDaAcao(estado, aoConcluir);

  const erroDe = (campo: string) =>
    estado.erros?.find((erro) => erro.campo === campo)?.mensagem;
  const entregue = status === "ENTREGUE" || status === "VALIDADO";

  return (
    <form action={executar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <Selecao
          rotulo="Tipo de produto"
          nome="tipo"
          vazio="Selecione"
          obrigatorio
          padrao={produto?.tipo ?? ""}
          opcoes={TIPOS}
          erro={erroDe("tipo")}
        />
        <Texto
          rotulo="Título"
          nome="titulo"
          obrigatorio
          padrao={produto?.titulo}
          placeholder="Título do artigo, trabalho, projeto ou relatório"
          erro={erroDe("titulo")}
        />
        <AreaTexto
          rotulo="Descrição ou resultado esperado"
          nome="descricao"
          linhas={3}
          padrao={produto?.descricao ?? undefined}
        />
        <Grade>
          <Texto
            rotulo="Instituição de colaboração"
            nome="instituicaoColaboracao"
            obrigatorio
            padrao={produto?.instituicaoColaboracao ?? undefined}
            placeholder="Universidade de Coimbra"
            erro={erroDe("instituicaoColaboracao")}
          />
          <Texto
            rotulo="País"
            nome="paisColaboracao"
            obrigatorio
            padrao={produto?.paisColaboracao ?? undefined}
            placeholder="Portugal"
            erro={erroDe("paisColaboracao")}
          />
        </Grade>
        <Grade>
          <Data
            rotulo="Prazo de entrega"
            nome="prazoEntrega"
            obrigatorio
            padrao={produto?.prazoEntrega}
            erro={erroDe("prazoEntrega")}
          />
          <Selecao
            rotulo="Situação"
            nome="status"
            padrao={produto?.status ?? "PREVISTO"}
            opcoes={STATUS}
            aoMudar={(valor) => setStatus(valor as StatusProdutoBolsa)}
          />
        </Grade>
        <Data
          rotulo="Data da entrega"
          nome="dataEntrega"
          obrigatorio={entregue}
          padrao={produto?.dataEntrega ?? undefined}
          dica={
            entregue
              ? "Obrigatória para produtos entregues ou validados."
              : "Preencha quando o bolsista realizar a entrega."
          }
          erro={erroDe("dataEntrega")}
        />
        <Grade>
          <Texto
            rotulo="DOI ou identificador"
            nome="doi"
            padrao={produto?.doi ?? undefined}
            placeholder="10.0000/exemplo"
          />
          <Texto
            rotulo="Link da evidência"
            nome="link"
            padrao={produto?.link ?? undefined}
            placeholder="https://…"
            erro={erroDe("link")}
          />
        </Grade>
        <AreaTexto
          rotulo="Observações"
          nome="observacoes"
          linhas={3}
          padrao={produto?.observacoes ?? undefined}
        />
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
            {enviando
              ? "Salvando…"
              : produto
                ? "Salvar produto"
                : "Cadastrar produto"}
          </button>
        </div>
      </div>
    </form>
  );
}
