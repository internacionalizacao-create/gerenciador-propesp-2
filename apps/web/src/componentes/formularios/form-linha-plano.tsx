"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { criarLinhaDePlano } from "@/acoes/plano";
import {
  AreaTexto,
  Campo,
  Grade,
  Marcador,
  Selecao,
  Texto,
} from "@/componentes/ui/campos";
import { Multistep, type Passo } from "@/componentes/ui/multistep";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import type { ItemCatalogo, LinhaPpg, Rubrica } from "@/lib/dominio";
import { meses as formatarMeses, moeda, rotulo } from "@/lib/formato";

const MESES = [
  "JANEIRO",
  "FEVEREIRO",
  "MARCO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

/**
 * Nova linha do plano de aplicação (P10), em três etapas.
 *
 * A etapa 2 é onde mora a regra central do sistema: em **Bolsas** o valor
 * unitário nunca é digitado — a pessoa escolhe destino, modalidade e vigência, e
 * o preço aparece, em somente leitura, vindo do catálogo (RN-01). Em
 * **Manutenção** e **Missões** não existe tabela oficial, então o valor é
 * digitado e a justificativa passa a ser obrigatória.
 *
 * Essa assimetria é deliberadamente visível: o selo "oficial" contra "estimado"
 * é o que impede um número sem lastro de entrar numa prestação de contas
 * parecendo tabelado.
 */
export function FormLinhaPlano({
  programa,
  ciclo,
  ppgs,
  areas,
  catalogo,
  aoConcluir,
}: {
  programa: string;
  ciclo: string;
  ppgs: LinhaPpg[];
  areas: { id: string; codigo: string; nome: string; rede: string }[];
  catalogo: ItemCatalogo[];
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    criarLinhaDePlano.bind(null, { programa, ciclo }),
    ESTADO_INICIAL,
  );

  const [rubrica, setRubrica] = useState<Rubrica>("BOLSAS");
  const [destino, setDestino] = useState<"BRASIL" | "EXTERIOR">("EXTERIOR");
  const [modalidadeId, setModalidadeId] = useState("");
  const [vigencia, setVigencia] = useState("");

  useEffect(() => {
    if (estado.ok) aoConcluir();
  }, [estado.ok, aoConcluir]);

  // Só as modalidades que existem no catálogo para o destino escolhido. Oferecer
  // uma combinação que a tabela oficial não tem produziria um 422 evitável.
  const modalidades = useMemo(() => {
    const doDestino = catalogo.filter((i) => i.destino === destino);
    return [
      ...new Map(
        doDestino.map((i) => [i.modalidadeId, i.modalidade] as const),
      ).entries(),
    ].map(([id, nome]) => ({ valor: id, texto: nome }));
  }, [catalogo, destino]);

  const vigencias = useMemo(
    () =>
      catalogo
        .filter((i) => i.destino === destino && i.modalidadeId === modalidadeId)
        .map((i) => ({
          valor: i.vigenciaMeses,
          texto: formatarMeses(i.vigenciaMeses),
        }))
        .sort((a, b) => Number(a.valor) - Number(b.valor)),
    [catalogo, destino, modalidadeId],
  );

  const item = catalogo.find(
    (i) =>
      i.destino === destino &&
      i.modalidadeId === modalidadeId &&
      Number(i.vigenciaMeses) === Number(vigencia),
  );

  const passos: Passo[] = [
    {
      id: "onde",
      titulo: "Onde",
      descricao:
        "A qual PPG a linha pertence e em que rubrica ela entra. A rubrica define de onde sai o valor unitário.",
      validar: (formulario) =>
        campo(formulario, "ppgId") ? null : "Selecione o PPG.",
      conteudo: (
        <>
          <Selecao
            rotulo="Rubrica"
            nome="rubrica"
            padrao="BOLSAS"
            aoMudar={(valor) => setRubrica(valor as Rubrica)}
            dica="Bolsas usa o catálogo oficial. Manutenção e missões usam valor estimado."
            opcoes={[
              { valor: "BOLSAS", texto: "Bolsas" },
              { valor: "MANUTENCAO", texto: "Manutenção" },
              { valor: "MISSOES", texto: "Missões" },
            ]}
          />
          <Selecao
            rotulo="PPG"
            nome="ppgId"
            obrigatorio
            vazio="Selecione…"
            dica="A rede e a área temática são derivadas do PPG."
            opcoes={ppgs.map((p) => ({
              valor: p.id,
              texto: `${p.sigla} — ${p.nome}`,
            }))}
          />
          <Selecao
            rotulo="Área temática"
            nome="areaTematicaId"
            vazio="Sem área temática"
            dica="Programas sem redes (GCUB, Erasmus+) deixam este campo vazio."
            opcoes={areas.map((a) => ({
              valor: a.id,
              texto: `${a.codigo} — ${a.nome}`,
            }))}
          />
        </>
      ),
    },
    {
      id: "o-que",
      titulo: "O que",
      descricao:
        rubrica === "BOLSAS"
          ? "O valor unitário vem do catálogo vigente e não pode ser digitado (RN-01)."
          : "Não existe tabela oficial para esta rubrica: o valor é uma estimativa e precisa de justificativa.",
      validar: (formulario) => {
        if (rubrica === "BOLSAS") {
          if (!campo(formulario, "modalidadeId")) return "Escolha a modalidade.";
          if (!campo(formulario, "vigenciaMeses")) return "Escolha a vigência.";
          if (!item) {
            return "Esta combinação não existe no catálogo vigente. Registre uma pendência para que a PROPESP publique o item.";
          }
          return null;
        }

        if (!campo(formulario, "valorUnitarioInformado")) {
          return "Informe o valor unitário estimado.";
        }
        if (campo(formulario, "justificativaEstimativa").length < 10) {
          return "Explique de onde veio a estimativa (mínimo 10 caracteres).";
        }
        return null;
      },
      conteudo:
        rubrica === "BOLSAS" ? (
          <>
            <Selecao
              rotulo="Destino"
              nome="destino"
              padrao="EXTERIOR"
              aoMudar={(valor) => {
                setDestino(valor as "BRASIL" | "EXTERIOR");
                setModalidadeId("");
                setVigencia("");
              }}
              dica="Brasil traz alguém para a UEA (IN); exterior leva alguém daqui para fora (OUT)."
              opcoes={[
                { valor: "BRASIL", texto: "Brasil" },
                { valor: "EXTERIOR", texto: "Exterior" },
              ]}
            />
            <Selecao
              rotulo="Modalidade"
              nome="modalidadeId"
              vazio="Selecione…"
              aoMudar={(valor) => {
                setModalidadeId(valor);
                setVigencia("");
              }}
              opcoes={modalidades}
              dica="Só aparecem as modalidades que o catálogo cobre para este destino."
            />
            <Selecao
              rotulo="Vigência"
              nome="vigenciaMeses"
              vazio={
                modalidadeId ? "Selecione…" : "Escolha a modalidade primeiro"
              }
              aoMudar={setVigencia}
              opcoes={vigencias}
              dica="Só as vigências existentes no catálogo. Bolsa de até 15 dias vale 0,5 mês (RN-02)."
            />

            <Campo rotulo="Valor unitário">
              {(id) => (
                <div
                  id={id}
                  className="rounded-lg border border-border bg-surface-muted px-3 py-2.5"
                >
                  {item ? (
                    <>
                      <p className="text-lg font-semibold tabular-nums text-foreground">
                        {moeda(item.valorBrl)}
                      </p>
                      <p className="mt-1 text-xs text-subtle">
                        Catálogo {item.codigo}
                        {item.valorUsd
                          ? ` · US$ ${Number(item.valorUsd).toLocaleString("pt-BR")}`
                          : ""}
                        {item.fonte ? ` · ${item.fonte}` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm italic text-subtle">
                      Escolha destino, modalidade e vigência para ver o valor
                      oficial.
                    </p>
                  )}
                </div>
              )}
            </Campo>

            <Selecao
              rotulo="Fluxo"
              nome="fluxo"
              vazio={`Sugerido: ${destino === "BRASIL" ? "IN" : "OUT"}`}
              dica="Deixe em branco para aplicar a convenção (RN-10). Sobrescreva só nos casos de borda — por exemplo, um bolsista estrangeiro que já reside no Brasil."
              opcoes={[
                { valor: "IN", texto: rotulo("IN") },
                { valor: "OUT", texto: rotulo("OUT") },
              ]}
            />
          </>
        ) : rubrica === "MANUTENCAO" ? (
          <>
            <AreaTexto
              rotulo="Descrição"
              nome="descricao"
              linhas={2}
              placeholder="Material de consumo para o laboratório de…"
            />
            <Selecao
              rotulo="Tipo de despesa"
              nome="tipoDespesa"
              padrao="MATERIAL_CONSUMO"
              opcoes={[
                { valor: "MATERIAL_CONSUMO", texto: "Material de consumo" },
                { valor: "SERVICO", texto: "Serviço" },
                { valor: "EQUIPAMENTO", texto: "Equipamento" },
                { valor: "PUBLICACAO", texto: "Publicação" },
                { valor: "OUTRO", texto: "Outro" },
              ]}
            />
            <ValorEstimado />
          </>
        ) : (
          <>
            <AreaTexto
              rotulo="Descrição"
              nome="descricao"
              linhas={2}
              placeholder="Missão de articulação institucional junto à universidade…"
            />
            <Selecao
              rotulo="Tipo de missão"
              nome="tipoMissao"
              padrao="VISITA_TECNICA"
              opcoes={[
                { valor: "VISITA_TECNICA", texto: "Visita técnica" },
                { valor: "EVENTO", texto: "Evento" },
                { valor: "ARTICULACAO", texto: "Articulação" },
                { valor: "BANCA", texto: "Banca" },
                { valor: "OUTRO", texto: "Outro" },
              ]}
            />
            <Grade>
              <Texto
                rotulo="Participantes"
                nome="numeroParticipantes"
                tipo="number"
                minimo="1"
              />
              <Texto
                rotulo="Diárias"
                nome="numeroDiarias"
                tipo="number"
                minimo="1"
              />
            </Grade>
            <Marcador rotulo="Inclui passagem" nome="incluiPassagem" />
            <ValorEstimado />
          </>
        ),
    },
    {
      id: "quando",
      titulo: "Quando e quanto",
      descricao:
        "A quantidade é replicada em todos os exercícios do ciclo, conforme a premissa vigente (RN-09). Depois dá para mudar um ano sem afetar os demais.",
      validar: (formulario) =>
        Number(campo(formulario, "quantidadeAnual")) > 0
          ? null
          : "Informe uma quantidade maior que zero.",
      conteudo: (
        <>
          <Grade>
            <Texto
              rotulo="Quantidade por ano"
              nome="quantidadeAnual"
              tipo="number"
              minimo="1"
              obrigatorio
              padrao="1"
              dica="Unidades, não linhas."
            />
            <Selecao
              rotulo="Mês de implementação"
              nome="mesImplementacao"
              vazio="Não definido"
              padrao="MARCO"
              dica="Hoje os editais concentram em Março e Setembro."
              opcoes={MESES.map((m) => ({ valor: m, texto: rotulo(m) }))}
            />
          </Grade>

          <AreaTexto
            rotulo="Texto-fonte"
            nome="textoFonte"
            linhas={3}
            placeholder="A frase original do anexo que originou esta linha."
            dica="Guardar a frase de origem é o que permite conferir uma divergência futura contra a fonte, em vez de refazer a interpretação."
          />
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
        rotuloConcluir="Criar linha"
        aoCancelar={aoConcluir}
      />
    </form>
  );
}

/** O par valor + justificativa que toda estimativa exige. */
function ValorEstimado() {
  return (
    <>
      <Texto
        rotulo="Valor unitário estimado"
        nome="valorUnitarioInformado"
        tipo="number"
        passo="0.01"
        minimo="0"
        obrigatorio
        dica="Não há tabela oficial para esta rubrica — este número é uma estimativa e será exibido como tal."
      />
      <AreaTexto
        rotulo="Justificativa da estimativa"
        nome="justificativaEstimativa"
        obrigatorio
        linhas={3}
        placeholder="Média de três cotações de passagem e diária para o destino."
        dica="Obrigatória. Sem ela, o valor entraria em relatórios sem que ninguém soubesse de onde veio."
      />
    </>
  );
}

/**
 * Lê o valor de um campo pelo `name`, direto do DOM do formulário.
 *
 * `namedItem` devolve `RadioNodeList` quando há mais de um controle com o mesmo
 * nome (o par hidden + checkbox dos marcadores é exatamente esse caso). Os dois
 * expõem `value`, então a checagem estrutural basta e evita um cast que o
 * TypeScript recusaria com razão.
 */
function campo(formulario: HTMLFormElement, nome: string): string {
  const elemento = formulario.elements.namedItem(nome);
  if (elemento && "value" in elemento) return String(elemento.value).trim();
  return "";
}
