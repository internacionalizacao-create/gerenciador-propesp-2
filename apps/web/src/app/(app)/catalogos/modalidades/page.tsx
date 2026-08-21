import type { Metadata } from "next";

import {
  Celula,
  Pagina,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { Modalidade } from "@/lib/dominio";
import { inteiro, rotulo } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Modalidades — Gerenciador PROPESP",
};

/**
 * P23 · Catálogos auxiliares — modalidades.
 *
 * Os destinos permitidos vêm do que o catálogo de fato cobre, e não de uma
 * marcação manual. É o que impede o formulário de oferecer uma combinação que a
 * tabela oficial não tem — e que resultaria num 422 evitável.
 */
export default async function Modalidades() {
  const modalidades = await apiFetch<Modalidade[]>("/catalogo/modalidades");

  return (
    <Pagina
      titulo="Modalidades de bolsa"
      descricao="Lista fechada do CAPES Global, com os destinos cobertos pelo catálogo oficial. Não é permitido cadastrar novas modalidades."
    >
      <Secao titulo="Modalidades">
        <Tabela
          colunas={[
            { chave: "nome", texto: "Modalidade" },
            { chave: "publico", texto: "Público-alvo" },
            { chave: "destinos", texto: "Destinos com valor publicado" },
            { chave: "itens", texto: "Itens no catálogo", alinhamento: "direita" },
            { chave: "ativa", texto: "Situação" },
          ]}
        >
          {modalidades.map((m) => (
            <tr key={m.id}>
              <Celula>
                <span className="font-medium text-foreground">{m.nome}</span>
              </Celula>
              <Celula className="text-muted">{rotulo(m.publicoAlvo)}</Celula>
              <Celula>
                <div className="flex gap-2">
                  {m.permiteBrasil ? <Selo tom="info">Brasil</Selo> : null}
                  {m.permiteExterior ? (
                    <Selo tom="primario">Exterior</Selo>
                  ) : null}
                  {!m.permiteBrasil && !m.permiteExterior ? (
                    <span className="text-subtle">Nenhum</span>
                  ) : null}
                </div>
              </Celula>
              <Celula direita>{inteiro(m.itens)}</Celula>
              <Celula>
                <Selo tom={m.ativa ? "sucesso" : "neutro"}>
                  {m.ativa ? "Ativa" : "Inativa"}
                </Selo>
              </Celula>
            </tr>
          ))}
        </Tabela>
      </Secao>
    </Pagina>
  );
}
