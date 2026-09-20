import type { Metadata } from "next";

import { ListaParceiros } from "@/componentes/consultas/lista-parceiros";
import { NovoParceiro } from "@/componentes/formularios/form-parceiro";
import { Pagina } from "@/componentes/ui/basicos";
import { SemAcesso } from "@/componentes/ui/sem-acesso";
import { faltando } from "@/lib/acesso";
import { apiFetch, apiFetchOuNada } from "@/lib/api";
import { normalizarPaginaParceiros } from "@/lib/paginacao-parceiros";
import { carregarMe } from "@/lib/me";
import type { PaginaParceiros, ReferenciasMissao } from "@/lib/dominio";

export const metadata: Metadata = {
  title: "Parceiros — Gerenciador PROPESP",
};

type Consulta = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string | undefined {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto && texto.trim() !== "" ? texto.trim() : undefined;
}

/**
 * CG-049 · Parceiros institucionais.
 *
 * A busca vem antes do cadastro na hierarquia da tela porque o problema que a
 * CG-025 resolve é a duplicação: quem chega aqui para "cadastrar" quase sempre
 * deveria reutilizar um cadastro existente.
 *
 * A rota fica sob o ciclo porque o vínculo com rede é do ciclo
 * (`rede_coordenadora` tem `cicloId`) — a instituição em si é global, e o
 * detalhe reflete isso.
 *
 * A página busca a primeira lista aqui, no servidor, e entrega para o
 * `ListaParceiros` como dado inicial. Os filtros seguintes são consultados pelo
 * TanStack Query, direto do browser: o primeiro paint continua vindo pronto do
 * servidor e a busca deixa de custar uma navegação inteira por tecla.
 */
export default async function ParceirosPagina({
  params,
  searchParams,
}: {
  params: Promise<{ programa: string; ciclo: string }>;
  searchParams: Promise<Consulta>;
}) {
  const { programa, ciclo } = await params;
  const consulta = await searchParams;
  const me = await carregarMe();
  const falta = faltando(me.permissions, ["parceiro:read"]);
  if (falta.length > 0) {
    return (
      <SemAcesso
        titulo="Parceiros"
        descricao="Instituições parceiras internacionais reutilizáveis por redes e missões."
        me={me}
        faltando={falta}
      />
    );
  }

  // A página faz parte do filtro, e por isso vem da URL: quem manda o link de
  // uma busca manda a página que estava vendo (V1-042).
  const filtrosIniciais = {
    busca: primeiro(consulta.busca) ?? "",
    redeId: primeiro(consulta.redeId) ?? "",
    incluirInativos: primeiro(consulta.inativos) === "true",
    pagina: normalizarPaginaParceiros(primeiro(consulta.pagina)),
  };

  const parametros = new URLSearchParams();
  if (filtrosIniciais.busca) parametros.set("busca", filtrosIniciais.busca);
  if (filtrosIniciais.redeId) parametros.set("redeId", filtrosIniciais.redeId);
  if (filtrosIniciais.incluirInativos) parametros.set("incluirInativos", "true");
  parametros.set("pagina", String(filtrosIniciais.pagina));

  // As referências vêm do módulo de missões e exigem `missao:read`: quem
  // administra parceiros sem acompanhar missões continua vendo a lista, só sem
  // o filtro por rede e sem o cadastro (que precisa de rede e país).
  const [pagina, referencias] = await Promise.all([
    apiFetch<PaginaParceiros>(`/parceiros?${parametros.toString()}`),
    apiFetchOuNada<ReferenciasMissao>(
      `/programas/${programa}/${ciclo}/comite-gestor/referencias-missao`,
    ),
  ]);

  const podeEscrever =
    me.permissions.includes("parceiro:edit") && referencias !== null;

  return (
    <Pagina
      titulo="Parceiros"
      descricao="Instituições parceiras internacionais. O mesmo cadastro é reutilizado por várias redes e missões, em vez de copiado a cada uma."
      acoes={
        podeEscrever ? (
          <NovoParceiro
            redes={referencias?.redes ?? []}
            paises={referencias?.paises ?? []}
          />
        ) : undefined
      }
    >
      <ListaParceiros
        base={`/programas/${programa}/${ciclo}/parceiros`}
        filtrosIniciais={filtrosIniciais}
        dadosIniciais={pagina}
        redes={referencias?.redes ?? []}
      />
    </Pagina>
  );
}
