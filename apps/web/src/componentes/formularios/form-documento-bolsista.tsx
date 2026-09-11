"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";

import { anexarDocumentoDoBolsista } from "@/acoes/documentos-bolsista";
import { Selecao, Texto } from "@/componentes/ui/campos";
import { useErrosDaAcao } from "@/componentes/ui/formulario";
import {
  CLASSE_CORPO_PAINEL,
  RodapeDoPainel,
} from "@/componentes/ui/painel-formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import {
  ehDocumentoPessoal,
  formularioDocumentoBolsistaSchema,
  type DadosFormularioDocumentoBolsista,
} from "@/lib/formularios/documentos-bolsista";

const CAMPOS_DA_API: Record<
  string,
  Path<DadosFormularioDocumentoBolsista>
> = {
  categoria: "categoria",
  legenda: "legenda",
};

export function AnexarDocumentoDoBolsista({
  bolsaId,
  categorias,
}: {
  bolsaId: string;
  categorias: { valor: string; texto: string }[];
}) {
  return (
    <AbrirSidesheet
      rotulo="Anexar documento"
      variante="secundaria"
      titulo="Anexar documento do bolsista"
      descricao="Um arquivo por vez, com a categoria que o identifica. Substituir depois cria versão nova e preserva a anterior."
    >
      {(fechar) => (
        <FormDocumento
          bolsaId={bolsaId}
          categorias={categorias}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function FormDocumento({
  bolsaId,
  categorias,
  aoConcluir,
}: {
  bolsaId: string;
  categorias: { valor: string; texto: string }[];
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    anexarDocumentoDoBolsista.bind(null, bolsaId),
    ESTADO_INICIAL,
  );

  /**
   * O arquivo fica fora do React Hook Form, em estado próprio.
   *
   * `input[type=file]` é não controlado por natureza — o navegador não deixa
   * definir seu valor por código, por segurança —, então registrá-lo no schema
   * daria um `FileList` que precisaria de validação à parte de qualquer jeito.
   * Guardar o `File` no `onChange` evita também ler uma `ref` dentro do
   * callback de submit, que o lint do repositório recusa com razão: ali ela
   * poderia ser lida durante a renderização.
   */
  const [arquivo, definirArquivo] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<DadosFormularioDocumentoBolsista>({
    resolver: zodResolver(formularioDocumentoBolsistaSchema),
    defaultValues: { categoria: "", legenda: "" },
  });

  useToastDaAcao(estado, aoConcluir);
  useErrosDaAcao(estado, setError, CAMPOS_DA_API);

  // `useWatch` e nao `watch`: o `watch` da instancia nao e memoizavel e o lint
  // do repositorio acusa. E o mesmo padrao do formulario de missao.
  const categoria = useWatch({ control, name: "categoria" });
  const pessoal = ehDocumentoPessoal(categoria);

  const aoEnviar = handleSubmit((dados) => {
    if (!arquivo) {
      setError("categoria", {
        type: "manual",
        message: "Escolha o arquivo antes de anexar.",
      });
      return;
    }

    const corpo = new FormData();
    corpo.append("arquivo", arquivo);
    corpo.append("categoria", dados.categoria);
    corpo.append("legenda", dados.legenda);
    startTransition(() => executar(corpo));
  });

  return (
    <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
      <div className={CLASSE_CORPO_PAINEL}>
        <div className="mb-4">
          <label
            htmlFor="arquivo"
            className="block text-sm font-medium text-foreground"
          >
            Arquivo <span className="text-danger">*</span>
          </label>
          <input
            id="arquivo"
            name="arquivo"
            type="file"
            required
            accept=".pdf,.jpg,.jpeg,.png"
            aria-describedby="arquivo-dica"
            onChange={(evento) => {
              definirArquivo(evento.target.files?.[0] ?? null);
              clearErrors("categoria");
            }}
            className="mt-1.5 block w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
          />
          <p id="arquivo-dica" className="mt-1.5 text-xs text-muted">
            PDF, JPG ou PNG, até 20 MB. O tipo é conferido pelo conteúdo do
            arquivo, não pela extensão.
          </p>
        </div>

        <Selecao
          rotulo="Categoria"
          nome="categoria"
          vazio="Selecione"
          obrigatorio
          registro={register("categoria")}
          opcoes={categorias}
          erro={errors.categoria?.message}
        />

        {pessoal ? (
          <p className="mb-4 rounded-xl border-l-4 border-info bg-info-soft px-4 py-3 text-sm text-on-info-soft">
            Documento pessoal fica visível apenas para a administração e para a
            secretaria. O coordenador do PPG não o abre nem o envia.
          </p>
        ) : null}

        <Texto
          rotulo="Legenda"
          nome="legenda"
          registro={register("legenda")}
          erro={errors.legenda?.message}
        />

        {!estado.ok && estado.mensagem ? (
          <p
            role="alert"
            className="rounded-xl border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-on-danger-soft"
          >
            {estado.mensagem}
          </p>
        ) : null}
      </div>

      <RodapeDoPainel
        aoCancelar={aoConcluir}
        enviando={enviando}
        rotulo="Anexar"
        rotuloEnviando="Enviando…"
      />
    </form>
  );
}
