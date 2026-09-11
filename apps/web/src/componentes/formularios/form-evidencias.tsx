"use client";

import { useActionState } from "react";

import { anexarEvidencias } from "@/acoes/evidencias";
import { AreaTexto, Data, Grade, Selecao, Texto } from "@/componentes/ui/campos";
import { submeterSemLimpar } from "@/componentes/ui/formulario";
import {
  CLASSE_CORPO_PAINEL,
  RodapeDoPainel,
} from "@/componentes/ui/painel-formulario";
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
      descricao="Vários arquivos de uma vez. Data, local e visibilidade valem para toda a seleção."
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
      className="flex min-h-0 flex-1 flex-col"
    >
      <input type="hidden" name="entidadeTipo" value="MISSAO_COMITE" />
      <input type="hidden" name="entidadeId" value={entidadeId} />

      <div className={CLASSE_CORPO_PAINEL}>
        <div className="mb-4">
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

      <RodapeDoPainel
        aoCancelar={aoConcluir}
        enviando={enviando}
        rotulo="Anexar"
        rotuloEnviando="Enviando…"
      />
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
