"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  atualizarProdutoMissao,
  criarProdutoMissao,
  removerProdutoMissao,
} from "@/acoes/produto-missao";
import {
  AreaTexto,
  Grade,
  Selecao,
  Selecoes,
  Texto,
} from "@/componentes/ui/campos";
import { submeterSemLimpar, useErrosDaAcao } from "@/componentes/ui/formulario";
import {
  CLASSE_CORPO_PAINEL,
  RodapeDoPainel,
} from "@/componentes/ui/painel-formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";
import type { ConvenioResumo, ProdutoMissao } from "@/lib/dominio";
import {
  formularioProdutoMissaoSchema,
  produtoVazio,
  SITUACOES_PRODUTO_MISSAO,
  TIPOS_PRODUTO_MISSAO,
  valoresDoProduto,
  type DadosFormularioProdutoMissao,
} from "@/lib/formularios/produto-missao";

/**
 * Cadastro de produto da missão (V1-031).
 *
 * **Cadastrar um produto é responder "sim" à pergunta da CG-056.** Não existe
 * botão "sim" nesta tela, e a ausência é a decisão: o "sim" é a existência da
 * linha, e um botão gravaria afirmação sem nada que a sustente. A API retira a
 * declaração negativa sozinha quando o primeiro produto entra, com auditoria.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

export interface ReferenciasProduto {
  instituicoes: { id: string; nome: string }[];
  redes: { id: string; nome: string }[];
  /** Participantes da missão — quem viajou é quem pode responder pelo produto. */
  pessoas: { id: string; nome: string }[];
  convenios: ConvenioResumo[];
}

export function NovoProdutoMissao({
  contexto,
  referencias,
}: {
  contexto: Contexto;
  referencias: ReferenciasProduto;
}) {
  return (
    <AbrirSidesheet
      rotulo="Cadastrar produto"
      titulo="Cadastrar produto da missão"
      descricao="Resultado gerado pela missão. Cadastrar já responde “sim” à pergunta sobre produtos — não há botão separado para isso."
    >
      {(fechar) => (
        <FormProdutoMissao
          acao={criarProdutoMissao.bind(null, contexto)}
          referencias={referencias}
          aoConcluir={fechar}
          rotulo="Cadastrar"
        />
      )}
    </AbrirSidesheet>
  );
}

export function EditarProdutoMissao({
  contexto,
  produto,
  referencias,
}: {
  contexto: Contexto;
  produto: ProdutoMissao;
  referencias: ReferenciasProduto;
}) {
  return (
    <AbrirSidesheet
      rotulo="Editar"
      variante="secundaria"
      titulo={`Editar ${produto.titulo}`}
      descricao="Altera o produto já registrado. As evidências anexadas continuam ligadas a ele."
    >
      {(fechar) => (
        <FormProdutoMissao
          acao={atualizarProdutoMissao.bind(null, {
            ...contexto,
            produtoId: produto.id,
          })}
          valores={valoresDoProduto(produto)}
          referencias={referencias}
          aoConcluir={fechar}
          rotulo="Salvar"
        />
      )}
    </AbrirSidesheet>
  );
}

/**
 * Remoção.
 *
 * O botão **não é desabilitado** quando a API vai recusar — produto com
 * documento anexado (CG-052) e último produto de missão encerrada (CG-059) são
 * as duas recusas, e desabilitar esconderia o motivo. A recusa vem com o texto
 * que diz o que fazer.
 */
export function RemoverProdutoMissao({
  contexto,
  produto,
}: {
  contexto: Contexto;
  produto: ProdutoMissao;
}) {
  const [estado, executar, enviando] = useActionState(
    removerProdutoMissao.bind(null, { ...contexto, produtoId: produto.id }),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, () => {});

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="inline"
    >
      <button
        type="submit"
        disabled={enviando}
        className="text-sm font-medium text-danger hover:underline disabled:opacity-60"
      >
        {enviando ? "Removendo…" : "Remover"}
      </button>
      {!estado.ok && estado.mensagem ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {estado.mensagem}
        </p>
      ) : null}
    </form>
  );
}

function FormProdutoMissao({
  acao,
  valores,
  referencias,
  aoConcluir,
  rotulo,
}: {
  acao: (
    anterior: EstadoDaAcao,
    dados: DadosFormularioProdutoMissao,
  ) => Promise<EstadoDaAcao>;
  valores?: DadosFormularioProdutoMissao;
  referencias: ReferenciasProduto;
  aoConcluir: () => void;
  rotulo: string;
}) {
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<DadosFormularioProdutoMissao>({
    resolver: zodResolver(formularioProdutoMissaoSchema),
    defaultValues: valores ?? produtoVazio(),
  });
  // O campo de convênio só faz sentido no tipo que o exige, e a regra é
  // bicondicional: mostrá-lo sempre convidaria a apontar acordo num produto
  // que a API recusaria depois.
  const tipo = useWatch({ control, name: "tipo" });
  useToastDaAcao(estado, aoConcluir);
  useErrosDaAcao(estado, setError, {
    tipo: "tipo",
    titulo: "titulo",
    descricao: "descricao",
    situacao: "situacao",
    ano: "ano",
    referencia: "referencia",
    observacoes: "observacoes",
    convenioId: "convenioId",
    instituicoesIds: "instituicoesIds",
    redesIds: "redesIds",
    responsaveis: "responsaveisIds",
  });

  return (
    <form
      onSubmit={handleSubmit((dados) =>
        startTransition(() => executar(dados)),
      )}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className={CLASSE_CORPO_PAINEL}>
        <Selecao
          rotulo="Tipo de produto"
          nome="tipo"
          obrigatorio
          registro={register("tipo")}
          erro={errors.tipo?.message}
          opcoes={TIPOS_PRODUTO_MISSAO.map((item) => ({ ...item }))}
        />
        <Texto
          rotulo="Título"
          nome="titulo"
          obrigatorio
          registro={register("titulo")}
          erro={errors.titulo?.message}
          placeholder="Artigo conjunto sobre…"
        />
        <AreaTexto
          rotulo="Descrição"
          nome="descricao"
          linhas={3}
          registro={register("descricao")}
          erro={errors.descricao?.message}
        />
        <Grade>
          <Selecao
            rotulo="Situação"
            nome="situacao"
            obrigatorio
            registro={register("situacao")}
            erro={errors.situacao?.message}
            opcoes={SITUACOES_PRODUTO_MISSAO.map((item) => ({ ...item }))}
          />
          <Texto
            rotulo="Ano"
            nome="ano"
            registro={register("ano")}
            erro={errors.ano?.message}
            placeholder="2027"
          />
        </Grade>

        {tipo === "CONVENIO" ? (
          referencias.convenios.length > 0 ? (
            <Selecao
              rotulo="Acordo"
              nome="convenioId"
              obrigatorio
              registro={register("convenioId")}
              erro={errors.convenioId?.message}
              opcoes={[
                { valor: "", texto: "Selecione o acordo" },
                ...referencias.convenios.map((convenio) => ({
                  valor: convenio.id,
                  texto: convenio.titulo,
                })),
              ]}
              dica="O acordo precisa estar cadastrado no parceiro antes de virar produto."
            />
          ) : (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-warning-soft p-3 text-sm text-on-warning-soft"
            >
              Nenhum acordo cadastrado alcança esta missão. Cadastre o convênio
              no parceiro antes de registrá-lo como produto.
            </p>
          )
        ) : null}

        <Texto
          rotulo="Referência"
          nome="referencia"
          registro={register("referencia")}
          erro={errors.referencia?.message}
          dica="DOI, número do processo ou link que identifica o produto."
        />

        {referencias.instituicoes.length > 0 ? (
          <Selecoes
            rotulo="Instituições envolvidas"
            nome="instituicoesIds"
            registro={register("instituicoesIds")}
            erro={errors.instituicoesIds?.message}
            opcoes={referencias.instituicoes.map((item) => ({
              valor: item.id,
              texto: item.nome,
            }))}
          />
        ) : null}

        {referencias.redes.length > 0 ? (
          <Selecoes
            rotulo="Redes"
            nome="redesIds"
            registro={register("redesIds")}
            erro={errors.redesIds?.message}
            opcoes={referencias.redes.map((item) => ({
              valor: item.id,
              texto: item.nome,
            }))}
          />
        ) : null}

        {/*
          Só os participantes da missão. Quem viajou é quem responde pelo
          produto dela, e oferecer o cadastro inteiro de pessoas convidaria a
          creditar quem não esteve lá.
        */}
        {referencias.pessoas.length > 0 ? (
          <Selecoes
            rotulo="Responsáveis"
            nome="responsaveisIds"
            registro={register("responsaveisIds")}
            erro={errors.responsaveisIds?.message}
            opcoes={referencias.pessoas.map((item) => ({
              valor: item.id,
              texto: item.nome,
            }))}
            dica="Participantes da missão."
          />
        ) : null}

        <AreaTexto
          rotulo="Observações"
          nome="observacoes"
          linhas={3}
          registro={register("observacoes")}
          erro={errors.observacoes?.message}
        />
      </div>
      <RodapeDoPainel
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        aoCancelar={aoConcluir}
        rotulo={rotulo}
      />
    </form>
  );
}
