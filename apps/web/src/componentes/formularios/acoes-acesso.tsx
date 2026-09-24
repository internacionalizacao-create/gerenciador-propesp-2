"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";

import { revogarConcessao, vincularPessoa } from "@/acoes/acessos";
import { Aviso } from "@/componentes/ui/basicos";
import { AreaTexto, Marcador } from "@/componentes/ui/campos";
import {
  CLASSE_CORPO_PAINEL,
  RodapeDoPainel,
} from "@/componentes/ui/painel-formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import type { ConcessoesDaConta } from "@/lib/dominio";
import { dataHora } from "@/lib/formato";
import {
  formularioVinculoSchema,
  type DadosFormularioVinculo,
} from "@/lib/formularios/acessos";

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

type Candidata = NonNullable<ConcessoesDaConta["candidata"]>;

/**
 * Vínculo da conta pendente à pessoa que o e-mail dela reivindica.
 *
 * Quando a pessoa está com outra conta, o painel diz **qual**, se ela ainda
 * entra e se administra acessos, e pede confirmação explícita: o ato tira a
 * pessoa de lá e desativa aquela conta. As concessões não migram — a conta
 * vinculada recebe acesso por concessão própria, depois.
 */
export function VincularPessoa({
  usuarioId,
  candidata,
}: {
  usuarioId: string;
  candidata: Candidata;
}) {
  return (
    <AbrirSidesheet
      rotulo="Vincular à pessoa"
      titulo="Vincular a conta"
      descricao={candidata.pessoaNome}
    >
      {(fechar) => (
        <FormularioVinculo
          usuarioId={usuarioId}
          candidata={candidata}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function FormularioVinculo({
  usuarioId,
  candidata,
  aoConcluir,
}: {
  usuarioId: string;
  candidata: Candidata;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    vincularPessoa.bind(null, usuarioId, candidata.pessoaId),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  const atual = candidata.contaAtual;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosFormularioVinculo>({
    resolver: zodResolver(formularioVinculoSchema(atual !== null)),
    defaultValues: { motivo: "", transferir: false },
  });

  const aoEnviar = handleSubmit((dados) => {
    startTransition(() => executar(dados));
  });

  return (
    <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
      <div className={CLASSE_CORPO_PAINEL}>
        <p className="mb-4 text-sm text-muted">
          O e-mail desta conta é o de <strong>{candidata.pessoaNome}</strong>.
          Vincular faz a conta responder por essa pessoa. Nenhum acesso vem
          junto: conceda depois, na própria conta.
        </p>

        {atual ? (
          <>
            <Aviso tom="aviso" titulo="Esta pessoa está com outra conta">
              {atual.email ?? atual.username ?? "Conta sem identificação"}
              {" — "}
              {atual.ativa ? "ativa" : "inativa"}
              {atual.ultimoAcessoEm
                ? `, último acesso em ${dataHora(atual.ultimoAcessoEm)}`
                : ", sem acesso registrado"}
              .{" "}
              {atual.administraAcesso
                ? "Ela administra acessos, então transferir exige a permissão de delegar. "
                : ""}
              Ao confirmar, aquela conta perde a pessoa e é desativada; as
              concessões dela ficam registradas, sem valer.
            </Aviso>
            <Marcador
              rotulo="Confirmo a transferência e a desativação da outra conta"
              nome="transferir"
              registro={register("transferir")}
            />
            {errors.transferir?.message ? (
              <p role="alert" className="-mt-2 mb-4 text-xs text-danger">
                {errors.transferir.message}
              </p>
            ) : null}
          </>
        ) : null}

        <AreaTexto
          rotulo="Motivo"
          nome="motivo"
          obrigatorio
          linhas={3}
          dica="Fica na trilha de auditoria das duas contas, junto de quem vinculou e quando."
          registro={register("motivo")}
          erro={errors.motivo?.message}
        />
      </div>

      <RodapeDoPainel
        aoCancelar={aoConcluir}
        enviando={enviando}
        rotulo={atual ? "Transferir e vincular" : "Vincular"}
        rotuloEnviando="Vinculando…"
        erro={estado.ok === false ? estado.mensagem : undefined}
      />
    </form>
  );
}
