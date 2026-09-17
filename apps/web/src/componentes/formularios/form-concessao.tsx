"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useState } from "react";
import {
  useForm,
  useWatch,
  type UseFormRegisterReturn,
} from "react-hook-form";

import { concederAcesso } from "@/acoes/acessos";
import { AreaTexto, Selecao } from "@/componentes/ui/campos";
import { useErrosDaAcao } from "@/componentes/ui/formulario";
import {
  CLASSE_CORPO_PAINEL,
  RodapeDoPainel,
} from "@/componentes/ui/painel-formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import { buscarNoBff, caminhoBff } from "@/lib/bff";
import type {
  AlvosDeAcesso,
  CatalogoDeAcesso,
  PreviaDeConcessao,
  TipoAlvoAcesso,
} from "@/lib/dominio";
import { NOME_DO_MODULO } from "@/lib/acesso";
import {
  agruparPorModulo,
  alcancesCompativeis,
  formularioConcessaoSchema,
  payloadConcessao,
  type DadosFormularioConcessao,
} from "@/lib/formularios/acessos";

const CAMPOS_DA_API = {
  permissoes: "permissoes",
  motivo: "motivo",
  concessoes: "permissoes",
} as const;

const ROTULO_DO_ALCANCE: Record<TipoAlvoAcesso, string> = {
  GLOBAL: "Todo o sistema",
  CICLO: "Um ciclo inteiro",
  PPG: "Um PPG, em um ciclo",
  REDE: "Uma rede coordenadora",
  TEMATICA: "Uma área temática",
  PARTICIPACAO: "Uma participação PPG–temática",
};

export function ConcederAcesso({
  usuarioId,
  pessoaNome,
  catalogo,
  alvos,
}: {
  usuarioId: string;
  pessoaNome: string;
  catalogo: CatalogoDeAcesso;
  alvos: AlvosDeAcesso;
}) {
  return (
    <AbrirSidesheet
      rotulo="Conceder acesso"
      titulo={`Conceder acesso a ${pessoaNome}`}
      descricao="Escolha as ações e o alcance em que elas valem. Cada ação vira uma linha própria, e o alcance escolhido aqui vale para todas as marcadas — para alcances diferentes, repita a concessão."
    >
      {(fechar) => (
        <Formulario
          usuarioId={usuarioId}
          catalogo={catalogo}
          alvos={alvos}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function Formulario({
  usuarioId,
  catalogo,
  alvos,
  aoConcluir,
}: {
  usuarioId: string;
  catalogo: CatalogoDeAcesso;
  alvos: AlvosDeAcesso;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    concederAcesso.bind(null, usuarioId),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  const {
    control,
    register,
    setValue,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosFormularioConcessao>({
    resolver: zodResolver(formularioConcessaoSchema),
    defaultValues: {
      permissoes: [],
      tipoAlvo: "GLOBAL",
      alvoId: "",
      cicloDoPpg: "",
      motivo: "",
      origem: "",
    },
  });

  useErrosDaAcao(estado, setError, CAMPOS_DA_API);

  const permissoes = useWatch({ control, name: "permissoes" }) ?? [];
  const tipoAlvo = useWatch({ control, name: "tipoAlvo" });

  const [previa, setPrevia] = useState<PreviaDeConcessao | null>(null);
  const [erroDaPrevia, setErroDaPrevia] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);

  /**
   * Trocar a seleção invalida a prévia: mantê-la na tela faria a pessoa
   * conferir uma lista e salvar outra.
   */
  const trocarPermissoes = (novas: string[]) => {
    setValue("permissoes", novas, { shouldValidate: permissoes.length > 0 });
    setPrevia(null);
  };

  const alternar = (permissao: string) => {
    trocarPermissoes(
      permissoes.includes(permissao)
        ? permissoes.filter((p) => p !== permissao)
        : [...permissoes, permissao],
    );
  };

  const aplicarModelo = (id: string) => {
    const modelo = catalogo.modelos.find((m) => m.id === id);
    // Modelo é ponto de partida: preenche a seleção e o que se grava são as
    // ações marcadas. Editar o modelo depois não mexe em ninguém já cadastrado.
    trocarPermissoes(modelo ? [...modelo.permissoes] : []);
    setValue("origem", modelo ? modelo.id : "");
  };

  const compativeis = alcancesCompativeis(permissoes, catalogo.permissoes);
  const alcanceInvalido =
    permissoes.length > 0 && !compativeis.includes(tipoAlvo);

  const conferir = handleSubmit(async (dados) => {
    setConferindo(true);
    setErroDaPrevia(null);
    try {
      setPrevia(
        await buscarNoBff<PreviaDeConcessao>(
          caminhoBff(`acesso/usuarios/${usuarioId}/concessoes/previa`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadConcessao(dados)),
          },
        ),
      );
    } catch {
      setErroDaPrevia(
        "Não foi possível conferir agora. Salvar continua disponível — a API confere de novo.",
      );
    } finally {
      setConferindo(false);
    }
  });

  const aoEnviar = handleSubmit((dados) => {
    startTransition(() => executar(dados));
  });

  const grupos = agruparPorModulo(catalogo.permissoes);

  return (
    <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
      <div className={CLASSE_CORPO_PAINEL}>
        <Selecao
          rotulo="Começar de um modelo (opcional)"
          nome="modelo"
          vazio="Começar vazio"
          dica="O modelo só marca as ações abaixo; o que é salvo são as concessões marcadas. Alterar o modelo depois não muda quem já foi configurado."
          opcoes={catalogo.modelos.map((m) => ({
            valor: m.id,
            texto: `${m.rotulo} (${m.permissoes.length} ações)`,
          }))}
          aoMudar={aplicarModelo}
        />

        <fieldset className="mb-5">
          <legend className="mb-1.5 text-sm font-medium text-foreground">
            Ações
            <span className="ml-1 text-danger" aria-hidden>
              *
            </span>
          </legend>
          <p className="mb-3 text-xs text-subtle">
            {permissoes.length} ação(ões) marcada(s). Leitura e escrita são
            ações separadas: marcar a consulta não concede o cadastro.
          </p>

          <div className="space-y-4">
            {grupos.map((grupo) => (
              <GrupoDeAcoes
                key={grupo.modulo}
                titulo={NOME_DO_MODULO[grupo.modulo] ?? grupo.modulo}
                acoes={grupo.acoes}
                marcadas={permissoes}
                aoAlternar={alternar}
                aoAlternarGrupo={(marcar) => {
                  const doGrupo = grupo.acoes.map((a) => a.permissao);
                  trocarPermissoes(
                    marcar
                      ? [...new Set([...permissoes, ...doGrupo])]
                      : permissoes.filter((p) => !doGrupo.includes(p)),
                  );
                }}
              />
            ))}
          </div>

          {errors.permissoes?.message ? (
            <p role="alert" className="mt-2 text-xs text-danger">
              {errors.permissoes.message}
            </p>
          ) : null}
        </fieldset>

        <Selecao
          rotulo="Alcance"
          nome="tipoAlvo"
          obrigatorio
          registro={register("tipoAlvo")}
          aoMudar={() => {
            setValue("alvoId", "");
            setPrevia(null);
          }}
          dica={
            permissoes.length === 0
              ? "Marque as ações primeiro: o alcance oferecido depende delas."
              : "São só os alcances que todas as ações marcadas aceitam. Ação institucional, como o catálogo, existe apenas em “todo o sistema”."
          }
          opcoes={(compativeis.length > 0
            ? compativeis
            : (["GLOBAL"] as TipoAlvoAcesso[])
          ).map((tipo) => ({
            valor: tipo,
            texto: ROTULO_DO_ALCANCE[tipo],
          }))}
          erro={
            alcanceInvalido
              ? "Este alcance não vale para todas as ações marcadas."
              : undefined
          }
        />

        <SeletorDeAlvo
          tipo={tipoAlvo}
          alvos={alvos}
          registro={register("alvoId")}
          registroCiclo={register("cicloDoPpg")}
          erro={errors.alvoId?.message}
          erroCiclo={errors.cicloDoPpg?.message}
          aoMudar={() => setPrevia(null)}
        />

        <AreaTexto
          rotulo="Motivo"
          nome="motivo"
          obrigatorio
          linhas={3}
          dica="Fica na trilha de auditoria, junto de quem concedeu e quando."
          registro={register("motivo")}
          erro={errors.motivo?.message}
        />

        <div className="mt-2 rounded-xl border border-border bg-surface-muted p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              Confira o efeito antes de salvar: ação já concedida no mesmo
              alcance não muda nada.
            </p>
            <button
              type="button"
              onClick={() => void conferir()}
              disabled={conferindo}
              className="rounded-xl border border-border-strong px-3 py-1.5 text-sm text-foreground hover:bg-surface disabled:opacity-60"
            >
              {conferindo ? "Conferindo…" : "Conferir"}
            </button>
          </div>

          {erroDaPrevia ? (
            <p role="alert" className="mt-3 text-xs text-danger">
              {erroDaPrevia}
            </p>
          ) : null}

          {previa ? <ResumoDaPrevia previa={previa} /> : null}
        </div>
      </div>

      <RodapeDoPainel
        aoCancelar={aoConcluir}
        enviando={enviando}
        rotulo="Conceder"
        rotuloEnviando="Concedendo…"
        desabilitado={alcanceInvalido}
        erro={estado.ok === false ? estado.mensagem : undefined}
      />
    </form>
  );
}

function GrupoDeAcoes({
  titulo,
  acoes,
  marcadas,
  aoAlternar,
  aoAlternarGrupo,
}: {
  titulo: string;
  acoes: { permissao: string; rotulo: string }[];
  marcadas: readonly string[];
  aoAlternar: (permissao: string) => void;
  aoAlternarGrupo: (marcar: boolean) => void;
}) {
  const todas = acoes.every((a) => marcadas.includes(a.permissao));
  const algumas = acoes.some((a) => marcadas.includes(a.permissao));

  return (
    <fieldset className="rounded-xl border border-border p-3">
      <legend className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-subtle">
        {titulo}
      </legend>

      <button
        type="button"
        onClick={() => aoAlternarGrupo(!todas)}
        className="mb-2 text-xs text-muted underline underline-offset-2 hover:text-foreground"
      >
        {todas ? "Desmarcar módulo" : "Marcar módulo"}
        {algumas && !todas ? " (parcial)" : ""}
      </button>

      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {acoes.map((acao) => (
          <label
            key={acao.permissao}
            className="flex items-start gap-2 text-sm text-foreground"
          >
            <input
              type="checkbox"
              checked={marcadas.includes(acao.permissao)}
              onChange={() => aoAlternar(acao.permissao)}
              className="mt-0.5 size-4 rounded border-border-strong accent-[var(--primary)]"
            />
            <span>
              {acao.rotulo}
              <span className="ml-1 font-mono text-xs text-subtle">
                {acao.permissao}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Seletor do alvo concreto, por tipo.
 *
 * Cada opção carrega o contexto que a desambigua — o ciclo da rede, a rede da
 * temática —, porque duas redes de ciclos diferentes têm o mesmo nome e quem
 * concede escolheria no escuro.
 */
function SeletorDeAlvo({
  tipo,
  alvos,
  registro,
  registroCiclo,
  erro,
  erroCiclo,
  aoMudar,
}: {
  tipo: TipoAlvoAcesso;
  alvos: AlvosDeAcesso;
  registro: UseFormRegisterReturn;
  registroCiclo: UseFormRegisterReturn;
  erro?: string;
  erroCiclo?: string;
  aoMudar: () => void;
}) {
  if (tipo === "GLOBAL") {
    return (
      <p className="mb-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted">
        As ações marcadas valerão em todo o sistema, sem recorte por PPG, rede
        ou ciclo.
      </p>
    );
  }

  const opcoes = {
    CICLO: alvos.ciclos.map((c) => ({
      valor: c.id,
      texto: `${c.nome} · ${c.programa}`,
    })),
    PPG: alvos.ppgs.map((p) => ({
      valor: p.id,
      texto: p.sigla ? `${p.sigla} — ${p.nome}` : p.nome,
    })),
    REDE: alvos.redes.map((r) => ({
      valor: r.id,
      texto: `${r.nome} · ciclo ${r.ciclo}`,
    })),
    TEMATICA: alvos.tematicas.map((t) => ({
      valor: t.id,
      texto: `${t.codigo} · ${t.rede} — ${t.nome}`,
    })),
    PARTICIPACAO: alvos.participacoes.map((p) => ({
      valor: p.id,
      texto: `${p.ppg ?? p.ppgNome} em ${p.tematica} · ${p.rede}`,
    })),
  }[tipo];

  return (
    <>
      <Selecao
        rotulo="Onde"
        nome="alvoId"
        obrigatorio
        vazio="Selecione"
        registro={registro}
        aoMudar={aoMudar}
        opcoes={opcoes}
        erro={erro}
      />

      {tipo === "PPG" ? (
        <Selecao
          rotulo="Ciclo"
          nome="cicloDoPpg"
          obrigatorio
          vazio="Selecione"
          dica="O acesso a um PPG vale em um ciclo: sem isso, a concessão entregaria também o planejamento dos anos seguintes."
          registro={registroCiclo}
          aoMudar={aoMudar}
          opcoes={alvos.ciclos.map((c) => ({
            valor: c.id,
            texto: `${c.nome} · ${c.programa}`,
          }))}
          erro={erroCiclo}
        />
      ) : null}
    </>
  );
}

function ResumoDaPrevia({ previa }: { previa: PreviaDeConcessao }) {
  const conta = (efeito: string) =>
    previa.itens.filter((item) => item.efeito === efeito).length;

  const criar = conta("CRIAR");
  const reativar = conta("REATIVAR");
  const jaAtiva = conta("JA_ATIVA");

  return (
    <div className="mt-3 text-sm text-foreground" aria-live="polite">
      <p>
        <strong>{criar}</strong> nova(s), <strong>{reativar}</strong>{" "}
        reativada(s) e <strong>{jaAtiva}</strong> já ativa(s).
      </p>
      {jaAtiva > 0 ? (
        <p className="mt-1 text-xs text-subtle">
          As já ativas ficam como estão — nada é duplicado.
        </p>
      ) : null}
    </div>
  );
}
