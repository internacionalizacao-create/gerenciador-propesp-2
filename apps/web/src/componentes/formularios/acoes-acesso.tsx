"use client";

import { useActionState } from "react";

import { revogarConcessao } from "@/acoes/acessos";
import { AreaTexto } from "@/componentes/ui/campos";
import {
  CLASSE_CORPO_PAINEL,
  RodapeDoPainel,
} from "@/componentes/ui/painel-formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";

/**
 * Revogação de uma concessão (V1-018).
 *
 * Painel com motivo, e não um botão que age no clique: revogar acesso é ato
 * administrativo com trilha, e o motivo é obrigatório na API. Pedi-lo aqui
 * também evita o 400 depois do clique — e obriga a parada de um segundo que
 * separa "revoguei sem querer" de "revoguei".
 *
 * Não existe excluir: a linha revogada continua na tela, marcada.
 */
export function RevogarAcesso({
  concessaoId,
  descricao,
}: {
  concessaoId: string;
  descricao: string;
}) {
  return (
    <AbrirSidesheet
      rotulo="Revogar"
      variante="secundaria"
      titulo="Revogar acesso"
      descricao={descricao}
    >
      {(fechar) => (
        <Formulario concessaoId={concessaoId} aoConcluir={fechar} />
      )}
    </AbrirSidesheet>
  );
}

function Formulario({
  concessaoId,
  aoConcluir,
}: {
  concessaoId: string;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    revogarConcessao.bind(null, concessaoId),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  return (
    <form action={executar} className="flex min-h-0 flex-1 flex-col">
      <div className={CLASSE_CORPO_PAINEL}>
        <p className="mb-4 text-sm text-muted">
          A pessoa perde esta ação neste alcance já na próxima requisição — não
          é preciso esperar a sessão dela expirar. As outras concessões dela
          continuam valendo.
        </p>

        <AreaTexto
          rotulo="Motivo"
          nome="motivo"
          obrigatorio
          linhas={3}
          dica="Fica na trilha de auditoria, junto de quem revogou e quando."
        />
      </div>

      <RodapeDoPainel
        aoCancelar={aoConcluir}
        enviando={enviando}
        rotulo="Revogar acesso"
        rotuloEnviando="Revogando…"
        erro={estado.ok === false ? estado.mensagem : undefined}
      />
    </form>
  );
}
