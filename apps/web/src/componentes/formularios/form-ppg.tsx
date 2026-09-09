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
  useErrosDaAcao(estado, setError, { nome: "nome", sigla: "sigla", notaCapes: "notaCapes", situacao: "situacao" });

  // Fechar so depois de gravar; fechar no clique esconderia o erro do servidor.
  useToastDaAcao(estado, aoConcluir);

  const erroDe = (campo: keyof DadosFormularioPpg) => errors[campo]?.message;

  const passos: Passo[] = [
    {
      id: "identificacao",
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
            registro={register("unidade")}
              placeholder="Escola Superior de Ciências da Saúde"
            />
          </Grade>
          <Grade>
            <Selecao
              rotulo="Nível"
              nome="nivel"
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
            registro={register("redeAcademica")}
            placeholder="BIONORTE"
            dica="Preencha se o programa marcar a opção acima."
          />
        </>
      ),
    },
    {
      id: "linhas",
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
          />
          <AreaTexto
            rotulo="Observações"
            nome="observacoes"
            registro={register("observacoes")}
            placeholder="Qualquer informação que ajude quem for consultar este cadastro depois."
          />
        </>
      ),
    },
  ];

  return (
    <form
      onSubmit={handleSubmit((dados) => startTransition(() => executar(dados)))}
      className="flex min-h-0 flex-1 flex-col"
    >
      <Multistep
        passos={passos}
        enviando={enviando}
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
