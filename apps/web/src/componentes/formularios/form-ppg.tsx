"use client";

import { useActionState } from "react";

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
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import type { PpgDetalhe } from "@/lib/dominio";

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

  // Fechar so depois de gravar; fechar no clique esconderia o erro do servidor.
  useToastDaAcao(estado, aoConcluir);

  const erroDe = (campo: string) =>
    estado.erros?.find((e) => e.campo === campo)?.mensagem;

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
            padrao={ppg?.nome}
            placeholder="Programa de Pós-Graduação em…"
            erro={erroDe("nome")}
          />
          <Grade>
            <Texto
              rotulo="Sigla"
              nome="sigla"
              obrigatorio
              padrao={ppg?.sigla}
              placeholder="PPGCLIAMB"
              erro={erroDe("sigla")}
            />
            <Texto
              rotulo="Unidade / campus"
              nome="unidade"
              padrao={ppg?.unidade ?? undefined}
              placeholder="Escola Superior de Ciências da Saúde"
            />
          </Grade>
          <Grade>
            <Selecao
              rotulo="Nível"
              nome="nivel"
              vazio="Não informado"
              padrao={ppg?.nivel ?? ""}
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
              padrao={ppg?.modalidade ?? ""}
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
              padrao={ppg?.notaCapes ? String(ppg.notaCapes) : undefined}
              // O protótipo sugeria até 5, e o PPG em Medicina Tropical tem 7 —
              // o limite errado teria transformado um dado real em erro.
              dica="De 1 a 7."
              erro={erroDe("notaCapes")}
            />
            <Selecao
              rotulo="Situação"
              nome="situacao"
              padrao={ppg?.situacao ?? "ATIVO"}
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
            padrao={ppg?.areaCapes ?? undefined}
            placeholder="Ciências Ambientais"
          />
          <Marcador
            rotulo="Participa de rede nacional"
            nome="emRede"
            padrao={ppg?.emRede}
            dica="BIONORTE, REAMEC, PROFMAT, PROFSAÚDE… O recurso pode ser compartilhado com outras instituições."
          />
          <Texto
            rotulo="Rede acadêmica"
            nome="redeAcademica"
            padrao={ppg?.redeAcademica ?? undefined}
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
            padrao={ppg?.linhasPesquisa.map((l) => l.nome)}
            placeholder="Ecologia de ecossistemas amazônicos"
            dica="Enter também adiciona."
          />
          <AreaTexto
            rotulo="Observações"
            nome="observacoes"
            padrao={ppg?.observacoes ?? undefined}
            placeholder="Qualquer informação que ajude quem for consultar este cadastro depois."
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
        rotuloConcluir={ppg ? "Salvar alterações" : "Cadastrar PPG"}
        aoCancelar={aoConcluir}
      />
    </form>
  );
}

/** Ver a nota em `form-linha-plano.tsx` sobre `RadioNodeList`. */
function valor(formulario: HTMLFormElement, campo: string): string {
  const elemento = formulario.elements.namedItem(campo);
  if (elemento && "value" in elemento) return String(elemento.value).trim();
  return "";
}
