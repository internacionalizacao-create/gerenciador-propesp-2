"use client";

import { useActionState, useState } from "react";

import {
  atualizarBolsaConcedida,
  criarBolsaConcedida,
} from "@/acoes/bolsistas";
import { AreaTexto, Grade, Selecao, Texto } from "@/componentes/ui/campos";
import { Multistep, type Passo } from "@/componentes/ui/multistep";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import type { BolsaConcedidaDetalhe, OpcaoBolsaPlanejada } from "@/lib/dominio";
import { meses, moeda, rotulo } from "@/lib/formato";

export function NovaBolsaConcedida({
  opcoes,
}: {
  opcoes: OpcaoBolsaPlanejada[];
}) {
  return (
    <AbrirSidesheet
      rotulo="Conceder bolsa"
      titulo="Conceder bolsa a uma pessoa"
      descricao="A linha planejada fornece modalidade, valor e vigência; a equipe informa o bolsista e as datas completas."
      largura="larga"
    >
      {(fechar) => <FormNovaBolsa opcoes={opcoes} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

function FormNovaBolsa({
  opcoes,
  aoConcluir,
}: {
  opcoes: OpcaoBolsaPlanejada[];
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    criarBolsaConcedida,
    ESTADO_INICIAL,
  );
  const [opcaoId, setOpcaoId] = useState("");
  const opcao = opcoes.find((item) => item.id === opcaoId);

  useToastDaAcao(estado, aoConcluir);

  const erroDe = (campo: string) =>
    estado.erros?.find((erro) => erro.campo === campo)?.mensagem;

  const passos: Passo[] = [
    {
      id: "planejamento",
      titulo: "Planejamento",
      descricao:
        "Escolha a vaga de origem. O sistema não permite consumir mais vagas do que o planejamento anual.",
      validar: (formulario) =>
        valor(formulario, "itemPlanejadoId")
          ? null
          : "Selecione a bolsa planejada.",
      conteudo: (
        <>
          <Selecao
            rotulo="Bolsa planejada"
            nome="itemPlanejadoId"
            vazio="Selecione código, PPG e modalidade"
            obrigatorio
            opcoes={opcoes.map((item) => ({
              valor: item.id,
              texto: `${item.codigo} · ${item.ppgSigla} · ${item.modalidade}`,
            }))}
            aoMudar={setOpcaoId}
            erro={erroDe("itemPlanejadoId")}
          />

          {opcao ? <ResumoDaOpcao opcao={opcao} /> : null}
        </>
      ),
    },
    {
      id: "bolsista",
      titulo: "Bolsista",
      descricao:
        "O produto será cobrado individualmente desta pessoa, não da linha agregada do plano.",
      validar: (formulario) =>
        valor(formulario, "nome").length >= 3
          ? null
          : "Informe o nome completo do bolsista.",
      conteudo: (
        <>
          <Texto
            rotulo="Nome completo"
            nome="nome"
            obrigatorio
            erro={erroDe("nome")}
          />
          <Grade>
            <Texto
              rotulo="E-mail"
              nome="email"
              placeholder="pessoa@instituicao.br"
              erro={erroDe("email")}
            />
            <Texto
              rotulo="CPF"
              nome="cpf"
              placeholder="000.000.000-00"
              obrigatorio
              erro={erroDe("cpf")}
              dica="O CPF é usado para impedir modalidades diferentes para a mesma pessoa no ciclo 2027–2030."
            />
          </Grade>
          <Selecao
            rotulo="Nível do beneficiário"
            nome="nivelBeneficiario"
            obrigatorio
            vazio="Selecione"
            erro={erroDe("nivelBeneficiario")}
            opcoes={[
              { valor: "MESTRADO", texto: "Mestrado" },
              { valor: "DOUTORADO", texto: "Doutorado" },
              { valor: "POS_DOC", texto: "Pós-doutorado" },
              { valor: "DOCENTE", texto: "Docente" },
              { valor: "MOBILIDADE_BREVE", texto: "Mobilidade breve" },
            ]}
          />
        </>
      ),
    },
    {
      id: "destino",
      titulo: "Destino",
      descricao:
        "Registre o país e a universidade ou instituição em que a mobilidade ocorrerá.",
      validar: (formulario) => {
        if (!valor(formulario, "paisDestino")) {
          return "Informe o país de destino.";
        }
        if (!valor(formulario, "instituicaoDestino")) {
          return "Informe a universidade ou instituição de destino.";
        }
        return null;
      },
      conteudo: (
        <>
          <Texto
            rotulo="País de destino"
            nome="paisDestino"
            obrigatorio
            placeholder={opcao?.destino === "BRASIL" ? "Brasil" : "País"}
            erro={erroDe("paisDestino")}
          />
          <Texto
            rotulo="Universidade ou instituição de destino"
            nome="instituicaoDestino"
            obrigatorio
            erro={erroDe("instituicaoDestino")}
          />
        </>
      ),
    },
    {
      id: "periodo",
      titulo: "Período",
      descricao:
        "Informe as datas exatas do termo. São elas que alimentam os alertas de início e expiração.",
      validar: (formulario) => {
        const inicio = valor(formulario, "dataInicio");
        const fim = valor(formulario, "dataFim");
        if (!inicio || !fim) return "Informe as datas inicial e final.";
        if (fim < inicio) return "A data final não pode vir antes da inicial.";
        return null;
      },
      conteudo: (
        <>
          <Grade>
            <Texto
              rotulo="Data inicial"
              nome="dataInicio"
              tipo="date"
              obrigatorio
              erro={erroDe("dataInicio")}
            />
            <Texto
              rotulo="Data final"
              nome="dataFim"
              tipo="date"
              obrigatorio
              erro={erroDe("dataFim")}
            />
          </Grade>
          <Grade>
            <Selecao
              rotulo="Situação registrada"
              nome="status"
              padrao="SELECIONADO"
              opcoes={[
                { valor: "SELECIONADO", texto: "Selecionado" },
                { valor: "EM_ANDAMENTO", texto: "Em andamento" },
              ]}
            />
            <Texto
              rotulo="Processo"
              nome="processo"
              placeholder="Número SEI ou equivalente"
            />
          </Grade>
          <AreaTexto rotulo="Observações" nome="observacoes" linhas={3} />
        </>
      ),
    },
  ];

  return (
    <form action={executar} className="flex min-h-0 flex-1 flex-col">
      <Multistep
        passos={passos}
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        rotuloConcluir="Cadastrar concessão"
        aoCancelar={aoConcluir}
      />
    </form>
  );
}

function ResumoDaOpcao({ opcao }: { opcao: OpcaoBolsaPlanejada }) {
  return (
    <div className="mb-5 rounded-2xl border border-border bg-surface-muted p-4 text-sm">
      <p className="font-medium text-foreground">
        {opcao.ppgSigla} · {opcao.modalidade}
      </p>
      <p className="mt-1 text-muted">
        {rotulo(opcao.destino)} · {meses(opcao.vigenciaMeses)} ·{" "}
        {moeda(opcao.valorUnitario)}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {opcao.porAno.map((ano) => (
          <li
            key={ano.ano}
            className="rounded-full bg-info-soft px-2.5 py-1 text-xs text-on-info-soft"
          >
            {ano.ano}: {ano.vagasDisponiveis} de {ano.planejadas} vagas livres
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EditarBolsaConcedida({
  bolsa,
}: {
  bolsa: BolsaConcedidaDetalhe;
}) {
  return (
    <AbrirSidesheet
      rotulo="Atualizar bolsa"
      variante="secundaria"
      titulo={`${bolsa.bolsista} · ${bolsa.modalidade}`}
      descricao="Corrija o período ou registre conclusão, cancelamento e interrupção."
    >
      {(fechar) => <FormEditarBolsa bolsa={bolsa} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

function FormEditarBolsa({
  bolsa,
  aoConcluir,
}: {
  bolsa: BolsaConcedidaDetalhe;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    atualizarBolsaConcedida.bind(null, bolsa.id),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  return (
    <form action={executar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <Grade>
          <Texto
            rotulo="Data inicial"
            nome="dataInicio"
            tipo="date"
            obrigatorio
            padrao={bolsa.dataInicio}
          />
          <Texto
            rotulo="Data final"
            nome="dataFim"
            tipo="date"
            obrigatorio
            padrao={bolsa.dataFim}
          />
        </Grade>
        <Selecao
          rotulo="Situação registrada"
          nome="status"
          padrao={bolsa.status}
          opcoes={[
            { valor: "SELECIONADO", texto: "Selecionado" },
            { valor: "EM_ANDAMENTO", texto: "Em andamento" },
            { valor: "CONCLUIDA", texto: "Concluída" },
            { valor: "CANCELADA", texto: "Cancelada" },
            { valor: "INTERROMPIDA", texto: "Interrompida" },
          ]}
        />
        <Texto
          rotulo="Processo"
          nome="processo"
          padrao={bolsa.processo ?? undefined}
        />
        <AreaTexto
          rotulo="Observações"
          nome="observacoes"
          linhas={4}
          padrao={bolsa.observacoes ?? undefined}
        />
      </div>
      <RodapeForm
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        aoCancelar={aoConcluir}
        rotulo="Salvar situação"
      />
    </form>
  );
}

function RodapeForm({
  enviando,
  erro,
  aoCancelar,
  rotulo: textoBotao,
}: {
  enviando: boolean;
  erro: string | null;
  aoCancelar: () => void;
  rotulo: string;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-surface-muted px-6 py-4">
      {erro ? (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-on-danger-soft"
        >
          {erro}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={aoCancelar}
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          {enviando ? "Salvando…" : textoBotao}
        </button>
      </div>
    </div>
  );
}

function valor(formulario: HTMLFormElement, campo: string): string {
  const elemento = formulario.elements.namedItem(campo);
  if (elemento && "value" in elemento) return String(elemento.value).trim();
  return "";
}
