"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { atualizarPpg, criarPpg } from "@/acoes/ppgs";
import {
  AreaTexto,
  Chips,
  Grade,
  Marcador,
  Selecao,
  Texto,
} from "@/componentes/ui/campos";
import { Multistep, type Passo } from "@/componentes/ui/multistep";
import { useErrosDaAcao } from "@/componentes/ui/formulario";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import type { PpgDetalhe } from "@/lib/dominio";
import { formularioPpgSchema, type DadosFormularioPpg } from "@/lib/formularios/ppg";

// Referencia estavel: recriar o mapa reaplicaria erros da API a cada render.
const CAMPOS_DA_API = {
  nome: "nome", sigla: "sigla", unidade: "unidade", nivel: "nivel",
  modalidade: "modalidade", notaCapes: "notaCapes", areaCapes: "areaCapes",
  situacao: "situacao", emRede: "emRede", redeAcademica: "redeAcademica",
  observacoes: "observacoes", linhasPesquisa: "linhasPesquisa",
} as const;

/**
 * Cadastro de PPG em três etapas (P14).
 *
 * É multistep porque o formulário do protótipo (slide 3) tem três blocos com
 * naturezas diferentes: identificação, avaliação CAPES e linhas de pesquisa.
 * Numa coluna só, o campo "conceito CAPES" ficaria a meia tela de distância do
 * nome do programa, e a pessoa perderia a noção do que está preenchendo.
 *
 * As etapas não são páginas: tudo fica montado no mesmo `<form>` (ver
 * `Multistep`), então o `FormData` do submit traz os três blocos.
 */
export function FormPpg({
  ppg,
  aoConcluir,
}: {
  ppg?: PpgDetalhe;
  aoConcluir: () => void;
}) {
  const acao = ppg ? atualizarPpg.bind(null, ppg.id) : criarPpg;
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  const { register, handleSubmit, setError, setValue, control, formState: { errors } } = useForm<DadosFormularioPpg>({
    resolver: zodResolver(formularioPpgSchema),
    defaultValues: { nome: ppg?.nome ?? "", sigla: ppg?.sigla ?? "", unidade: ppg?.unidade ?? "", nivel: (ppg?.nivel as DadosFormularioPpg["nivel"]) ?? "", modalidade: (ppg?.modalidade as DadosFormularioPpg["modalidade"]) ?? "", notaCapes: ppg?.notaCapes ? String(ppg.notaCapes) : "", areaCapes: ppg?.areaCapes ?? "", situacao: (ppg?.situacao as DadosFormularioPpg["situacao"]) ?? "ATIVO", emRede: ppg?.emRede ?? false, redeAcademica: ppg?.redeAcademica ?? "", observacoes: ppg?.observacoes ?? "", linhasPesquisa: ppg?.linhasPesquisa.map((linha) => linha.nome) ?? [] },
  });
  const linhasPesquisa = useWatch({ control, name: "linhasPesquisa" }) ?? [];
  useErrosDaAcao(estado, setError, CAMPOS_DA_API);
  // setError pode manter a referencia de errors; releia tambem erros da API.
  const errosVisiveis = Object.entries(errors).flatMap(([campo, erro]) => {
    if (Array.isArray(erro)) {
      return erro.flatMap((item) => item?.message ? [{ campo, mensagem: String(item.message) }] : []);
    }
    return erro?.message ? [{ campo, mensagem: String(erro.message) }] : [];
  });

  // Fechar so depois de gravar; fechar no clique esconderia o erro do servidor.
  useToastDaAcao(estado, aoConcluir);

  const erroDe = (campo: keyof DadosFormularioPpg) => errors[campo]?.message;

  const passos: Passo[] = [
    {
      id: "identificacao",
      campos: ["nome", "sigla", "unidade", "nivel", "modalidade"],
      titulo: "Identificação",
      descricao:
        "Como o programa é chamado e onde ele fica. A sigla é usada em todas as tabelas do sistema.",
      validar: (formulario) => {
        const nome = valor(formulario, "nome");
        const sigla = valor(formulario, "sigla");
        if (nome.length < 3) return "Informe o nome do PPG.";
        if (sigla.length < 2) return "Informe a sigla do PPG.";
        return null;
      },
      conteudo: (
        <>
          <Texto
            rotulo="Nome do PPG"
            nome="nome"
            obrigatorio
            registro={register("nome")}
            placeholder="Programa de Pós-Graduação em…"
            erro={erroDe("nome")}
          />
          <Grade>
            <Texto
              rotulo="Sigla"
              nome="sigla"
              obrigatorio
            registro={register("sigla")}
              placeholder="PPGCLIAMB"
              erro={erroDe("sigla")}
            />
            <Texto
              rotulo="Unidade / campus"
              nome="unidade"
              erro={erroDe("unidade")}
            registro={register("unidade")}
              placeholder="Escola Superior de Ciências da Saúde"
            />
          </Grade>
          <Grade>
            <Selecao
              rotulo="Nível"
              nome="nivel"
              erro={erroDe("nivel")}
              vazio="Não informado"
              registro={register("nivel")}
              opcoes={[
                { valor: "MESTRADO", texto: "Mestrado" },
                { valor: "DOUTORADO", texto: "Doutorado" },
                { valor: "MESTRADO_DOUTORADO", texto: "Mestrado e doutorado" },
                {
                  valor: "MESTRADO_PROFISSIONAL",
                  texto: "Mestrado profissional",
                },
              ]}
            />
            <Selecao
              rotulo="Modalidade"
              nome="modalidade"
              erro={erroDe("modalidade")}
              vazio="Não informada"
              registro={register("modalidade")}
              opcoes={[
                { valor: "ACADEMICO", texto: "Acadêmico" },
                { valor: "PROFISSIONAL", texto: "Profissional" },
              ]}
            />
          </Grade>
        </>
      ),
    },
    {
      id: "avaliacao",
      campos: ["notaCapes", "situacao", "areaCapes", "emRede", "redeAcademica"],
      titulo: "Avaliação e vínculos",
      descricao:
        "Dados da avaliação CAPES e participação em rede nacional. O conceito vai de 1 a 7.",
      validar: (formulario) => {
        const nota = valor(formulario, "notaCapes");
        if (nota && (Number(nota) < 1 || Number(nota) > 7)) {
          return "O conceito CAPES vai de 1 a 7.";
        }
        return null;
      },
      conteudo: (
        <>
          <Grade>
            <Texto
              rotulo="Conceito CAPES"
              nome="notaCapes"
              tipo="number"
              minimo="1"
              maximo="7"
              registro={register("notaCapes")}
              // O protótipo sugeria até 5, e o PPG em Medicina Tropical tem 7 —
              // o limite errado teria transformado um dado real em erro.
              dica="De 1 a 7."
              erro={erroDe("notaCapes")}
            />
            <Selecao
              rotulo="Situação"
              nome="situacao"
              erro={erroDe("situacao")}
              registro={register("situacao")}
              opcoes={[
                { valor: "ATIVO", texto: "Ativo" },
                { valor: "EM_IMPLANTACAO", texto: "Em implantação" },
                { valor: "INATIVO", texto: "Inativo" },
              ]}
            />
          </Grade>
          <Texto
            rotulo="Área CAPES"
            nome="areaCapes"
            erro={erroDe("areaCapes")}
            registro={register("areaCapes")}
            placeholder="Ciências Ambientais"
          />
          <Marcador
            rotulo="Participa de rede nacional"
            nome="emRede"
            registro={register("emRede")}
            dica="BIONORTE, REAMEC, PROFMAT, PROFSAÚDE… O recurso pode ser compartilhado com outras instituições."
          />
          <Texto
            rotulo="Rede acadêmica"
            nome="redeAcademica"
            erro={erroDe("redeAcademica")}
            registro={register("redeAcademica")}
            placeholder="BIONORTE"
            dica="Preencha se o programa marcar a opção acima."
          />
        </>
      ),
    },
    {
      id: "linhas",
      campos: ["linhasPesquisa", "observacoes"],
      titulo: "Linhas de pesquisa",
      descricao:
        "Adicione uma por vez. Elas aparecem no detalhe do PPG e servirão para vincular produtos da cooperação na fase 2.",
      conteudo: (
        <>
          <Chips
            rotulo="Linhas de pesquisa"
            nome="linhasPesquisa"
            valor={linhasPesquisa}
            aoMudar={(itens) => setValue("linhasPesquisa", itens, { shouldValidate: true })}
            placeholder="Ecologia de ecossistemas amazônicos"
            dica="Enter também adiciona."
            erro={errosVisiveis.find((erro) => erro.campo === "linhasPesquisa")?.mensagem}
          />
          <AreaTexto
            rotulo="Observações"
            nome="observacoes"
            erro={erroDe("observacoes")}
            registro={register("observacoes")}
            placeholder="Qualquer informação que ajude quem for consultar este cadastro depois."
          />
        </>
      ),
    },
  ];

  return (
    <form
      noValidate
      onSubmit={handleSubmit((dados) => startTransition(() => executar(dados)))}
      className="flex min-h-0 flex-1 flex-col"
    >
      <Multistep
        passos={passos}
        enviando={enviando}
        erros={errosVisiveis}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        rotuloConcluir={ppg ? "Salvar alterações" : "Cadastrar PPG"}
        aoCancelar={aoConcluir}
      />
    </form>
  );
}

function valor(formulario: HTMLFormElement, campo: string): string {
  const elemento = formulario.elements.namedItem(campo);
  return elemento && "value" in elemento ? String(elemento.value).trim() : "";
}
