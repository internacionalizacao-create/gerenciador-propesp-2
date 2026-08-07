import Link from "next/link";

import {
  Cartao,
  Cartoes,
  Pagina,
  Secao,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { ResumoCiclo } from "@/lib/dominio";
import { inteiro, moeda, rotulo } from "@/lib/formato";

/**
 * P06 · Visão do programa / ciclo.
 *
 * Página-índice: cada atalho carrega um número vivo, para que a pessoa saiba
 * onde há trabalho antes de clicar. É o que a aba `Premissas` da planilha
 * tentava ser, com a diferença de que aqui os números não envelhecem.
 */
export default async function VisaoDoCiclo({
  params,
}: {
  params: Promise<{ programa: string; ciclo: string }>;
}) {
  const { programa, ciclo: cicloNome } = await params;
  const base = `/programas/${programa}/${cicloNome}`;

  const resumo = await apiFetch<ResumoCiclo>(`/programas/${programa}/${cicloNome}`);
  const { ciclo } = resumo;

  return (
    <Pagina
      titulo={`${ciclo.programaNome} · ${ciclo.cicloNome}`}
      descricao={`${rotulo(ciclo.status)} · exercícios ${ciclo.anos.join(", ")}`}
    >
      <Secao titulo="Onde o ciclo está">
        <Cartoes>
          <Cartao
            titulo="Aporte anual conhecido"
            valor={moeda(resumo.aporteAnual)}
            nota="Soma das temáticas com orçamento definido"
          />
          <Cartao
            titulo="Custo anual das bolsas"
            valor={moeda(resumo.custoBolsasAnual)}
            nota="Quantidade × valor do catálogo"
          />
          <Cartao
            titulo="Saldo potencial anual"
            valor={moeda(resumo.saldoPotencialAnual)}
            nota="Orçamento de bolsas − custo programado"
          />
          <Cartao
            titulo="Linhas de planejamento"
            valor={inteiro(resumo.linhasPlano)}
            nota="Linhas, não bolsas — a distinção que já causou erro"
          />
        </Cartoes>
      </Secao>

      <Secao
        titulo="Seções do ciclo"
        descricao="Cada atalho mostra quanto trabalho há do outro lado."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Atalho
            href={`${base}/redes`}
            titulo="Redes e áreas temáticas"
            numero={`${inteiro(resumo.redes)} redes · ${inteiro(resumo.tematicas)} temáticas`}
            aviso={
              resumo.tematicasSemOrcamento > 0
                ? `${resumo.tematicasSemOrcamento} sem orçamento definido`
                : undefined
            }
          />
          <Atalho
            href={`${base}/orcamento`}
            titulo="Orçamento"
            numero={`${moeda(resumo.aporteAnual)} por ano`}
            aviso={
              resumo.divergencias > 0
                ? `${resumo.divergencias} divergências de saldo`
                : undefined
            }
          />
          <Atalho
            href={`${base}/plano`}
            titulo="Plano de aplicação"
            numero={`${inteiro(resumo.linhasPlano)} linhas nas três rubricas`}
          />
          <Atalho
            href="/ppgs"
            titulo="PPGs participantes"
            numero={`${inteiro(resumo.ppgs)} programas de pós-graduação`}
          />
          <Atalho
            href="/pendencias"
            titulo="Pendências"
            numero={`${inteiro(resumo.pendenciasAbertas)} em aberto`}
            aviso={resumo.pendenciasAbertas > 0 ? "aguardando decisão" : undefined}
          />
          <Atalho
            href={`${base}/comite-gestor`}
            titulo="Comitê Gestor"
            numero="Orçamento paralelo, não somável"
          />
          <Atalho
            href={`${base}/premissas`}
            titulo="Premissas e fontes"
            numero={`${inteiro(resumo.premissas)} premissas registradas`}
          />
          <Atalho
            href={`${base}/redes`}
            titulo="Coordenação temática"
            numero={`${inteiro(resumo.coordenadores)} coordenadores designados`}
          />
        </div>
      </Secao>

      <Secao
        titulo="Legenda herdada da planilha"
        descricao="As cores que a equipe usava viraram comportamento do sistema."
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <Legenda
            cor="bg-warning"
            planilha="Amarelo — preencher ou validar"
            sistema="Campo editável com aviso de validação pendente."
          />
          <Legenda
            cor="bg-info"
            planilha="Azul — entrada editável"
            sistema="Campo editável comum."
          />
          <Legenda
            cor="bg-success"
            planilha="Verde — vínculo entre abas"
            sistema="Valor calculado, somente leitura, com link para a origem."
          />
          <Legenda
            cor="bg-danger"
            planilha="Vermelho — divergência"
            sistema="Alerta em destaque e pendência associada."
          />
        </dl>
      </Secao>
    </Pagina>
  );
}

function Atalho({
  href,
  titulo,
  numero,
  aviso,
}: {
  href: string;
  titulo: string;
  numero: string;
  aviso?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
    >
      <p className="font-medium text-foreground">{titulo}</p>
      <p className="mt-1 text-sm text-muted">{numero}</p>
      {aviso ? (
        <p className="mt-2 text-xs font-medium text-warning">{aviso}</p>
      ) : null}
    </Link>
  );
}

function Legenda({
  cor,
  planilha,
  sistema,
}: {
  cor: string;
  planilha: string;
  sistema: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-surface p-4">
      <span className={`mt-1 h-4 w-4 shrink-0 rounded ${cor}`} aria-hidden />
      <div>
        <dt className="text-sm font-medium text-foreground">{planilha}</dt>
        <dd className="mt-0.5 text-sm text-muted">{sistema}</dd>
      </div>
    </div>
  );
}
