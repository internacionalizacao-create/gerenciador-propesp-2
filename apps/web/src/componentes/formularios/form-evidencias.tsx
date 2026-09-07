"use client";

import { useActionState } from "react";

import { anexarEvidencias } from "@/acoes/evidencias";
import { AreaTexto, Data, Grade, Selecao, Texto } from "@/componentes/ui/campos";
import { submeterSemLimpar } from "@/componentes/ui/formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";
import { CATEGORIAS_DA_GALERIA } from "@/lib/formularios/documentos-despesa";

/**
 * Envio de fotos e evidências (CG-057).
 *
 * Vários arquivos de uma vez, compartilhando os metadados do momento — data,
 * local, autoria e visibilidade descrevem a ocasião, não cada arquivo. É o que
 * torna aceitável não pedir uma legenda por foto: quem sobe trinta fotos de uma
 * visita não vai escrever trinta legendas, e obrigar a isso faria ninguém subir
 * nenhuma.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

export function AnexarEvidencias({
  contexto,
  entidadeId,
}: {
  contexto: Contexto;
  entidadeId: string;
}) {
  return (
    <AbrirSidesheet
      rotulo="Adicionar evidências"
      titulo="Fotos e evidências da missão"
      descricao="Vários arquivos de uma vez. Data, local, autoria e visibilidade valem para toda a seleção."
    >
      {(fechar) => (
        <FormEvidencias
          contexto={contexto}
          entidadeId={entidadeId}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function FormEvidencias({
  contexto,
  entidadeId,
  aoConcluir,
}: {
  contexto: Contexto;
  entidadeId: string;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    anexarEvidencias.bind(null, contexto),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="flex h-full flex-col"
    >
      <input type="hidden" name="entidadeTipo" value="MISSAO_COMITE" />
      <input type="hidden" name="entidadeId" value={entidadeId} />

      <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-4">
        <div>
          <label
            htmlFor="arquivos"
            className="block text-sm font-medium text-foreground"
          >
            Arquivos <span className="text-danger">*</span>
          </label>
          <input
            id="arquivos"
            name="arquivos"
            type="file"
            multiple
            required
            accept=".pdf,.jpg,.jpeg,.png"
            aria-describedby="arquivos-dica"
            className="mt-1.5 block w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
          />
          <p id="arquivos-dica" className="mt-1.5 text-xs text-muted">
            PDF, JPG ou PNG, até 20 MB cada. O tipo é conferido pelo conteúdo,
            não pela extensão.
          </p>
        </div>

        <Selecao
          rotulo="Categoria"
          nome="categoria"
          obrigatorio
          opcoes={CATEGORIAS_DA_GALERIA}
          erro={estado.erros?.find((e) => e.campo === "categoria")?.mensagem}
        />

        <Grade>
          <Data rotulo="Data da evidência" nome="dataEvidencia" />
          <Texto rotulo="Local" nome="localEvidencia" />
        </Grade>

        <Texto
          rotulo="Autoria"
          nome="autoria"
          dica="Quem fotografou ou produziu — não é quem faz o upload."
        />

        <AreaTexto
          rotulo="Legenda"
          nome="legenda"
          linhas={2}
          dica="Vale para todos os arquivos desta seleção."
        />

        {/* A privacidade é do participante e do contato, não do arquivo: uma
            foto com pessoas identificáveis não deve circular por padrão. */}
        <Selecao
          rotulo="Visibilidade"
          nome="visibilidade"
          opcoes={[
            { valor: "INTERNA", texto: "Interna — quem acessa o módulo vê" },
            {
              valor: "RESTRITA",
              texto: "Restrita — só o administrador e quem enviou",
            },
          ]}
          dica="Use restrita quando houver pessoa identificável sem autorização de imagem."
        />

        {!estado.ok && estado.pendencias && estado.pendencias.length > 0 ? (
          <div
            role="alert"
            className="rounded-xl border-l-4 border-warning bg-warning-soft px-4 py-3 text-sm text-on-warning-soft"
          >
            <p className="font-semibold">{estado.mensagem}</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              {estado.pendencias.map((falha) => (
                <li key={falha}>{falha}</li>
              ))}
            </ul>
          </div>
        ) : (
          <NotaDeErro estado={estado} />
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={aoConcluir}
          className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:bg-surface-muted"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Anexar"}
        </button>
      </div>
    </form>
  );
}

function NotaDeErro({ estado }: { estado: EstadoDaAcao }) {
  if (estado.ok || !estado.mensagem) return null;

  return (
    <p
      role="alert"
      className="rounded-xl border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-on-danger-soft"
    >
      {estado.mensagem}
    </p>
  );
}
