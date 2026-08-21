import {
  Celula,
  EstadoVazio,
  Pagina,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { FonteDocumental, Premissa } from "@/lib/dominio";
import { data } from "@/lib/formato";

interface Resposta {
  premissas: Premissa[];
  fontes: FonteDocumental[];
}

/**
 * P16 · Premissas e fontes documentais.
 *
 * É a página que explica de onde vêm os números. Sem ela, alguém que abrir o
 * painel daqui a dois anos não terá como saber por que o dólar valia 6,59 nem
 * por que o valor se repete nos quatro exercícios — e a primeira reação será
 * desconfiar do sistema.
 */
export default async function Premissas({
  params,
}: {
  params: Promise<{ programa: string; ciclo: string }>;
}) {
  const { programa, ciclo } = await params;
  const { premissas, fontes } = await apiFetch<Resposta>(
    `/programas/${programa}/${ciclo}/premissas`,
  );

  return (
    <Pagina
      titulo="Premissas e fontes"
      descricao="As convenções do modelo e os documentos de onde os valores vieram."
    >
      <Secao titulo="Premissas do modelo">
        {premissas.length > 0 ? (
          <Tabela
            colunas={[
              { chave: "item", texto: "Item" },
              { chave: "valor", texto: "Valor" },
              { chave: "unidade", texto: "Unidade" },
              { chave: "natureza", texto: "Natureza" },
              { chave: "fonte", texto: "Fonte" },
              { chave: "dataBase", texto: "Data-base" },
              { chave: "responsavel", texto: "Responsável" },
            ]}
          >
            {premissas.map((p) => (
              <tr key={p.id}>
                <Celula>
                  <span className="font-medium text-foreground">{p.item}</span>
                  {p.observacoes ? (
                    <span className="mt-0.5 block max-w-md text-xs text-subtle">
                      {p.observacoes}
                    </span>
                  ) : null}
                </Celula>
                <Celula>
                  <span className="tabular-nums text-foreground">{p.valor}</span>
                </Celula>
                <Celula className="text-muted">{p.unidade ?? "—"}</Celula>
                <Celula className="text-muted">{p.natureza ?? "—"}</Celula>
                <Celula className="max-w-xs text-muted">
                  {p.fonte ?? "—"}
                </Celula>
                <Celula className="text-muted">{data(p.dataBase)}</Celula>
                <Celula className="text-muted">{p.responsavel ?? "—"}</Celula>
              </tr>
            ))}
          </Tabela>
        ) : (
          <EstadoVazio
            titulo="Nenhuma premissa registrada"
            descricao="Sem premissas, os números do ciclo ficam sem explicação de origem."
          />
        )}
      </Secao>

      <Secao
        titulo="Fontes documentais"
        descricao="Os anexos que originaram o catálogo de valores."
      >
        {fontes.length > 0 ? (
          <Tabela
            colunas={[
              { chave: "nome", texto: "Documento" },
              { chave: "conteudo", texto: "Conteúdo utilizado" },
              { chave: "escopo", texto: "Escopo" },
              { chave: "norma", texto: "Referência normativa" },
              { chave: "recebimento", texto: "Recebido em" },
              { chave: "status", texto: "Status" },
            ]}
          >
            {fontes.map((f) => (
              <tr key={f.id}>
                <Celula>
                  <span className="font-medium text-foreground">{f.nome}</span>
                  {f.arquivoOrigem ? (
                    <span className="mt-0.5 block font-mono text-xs text-subtle">
                      {f.arquivoOrigem}
                    </span>
                  ) : null}
                </Celula>
                <Celula className="max-w-xs text-muted">
                  {f.conteudoUtilizado ?? "—"}
                  {f.observacoes ? (
                    <span className="mt-1 block text-xs text-subtle">
                      {f.observacoes}
                    </span>
                  ) : null}
                </Celula>
                <Celula className="text-muted">{f.escopo ?? "—"}</Celula>
                <Celula className="max-w-xs text-muted">
                  {f.referenciaNormativa ?? "—"}
                </Celula>
                <Celula className="text-muted">
                  {data(f.dataRecebimento)}
                </Celula>
                <Celula>
                  <Selo tom={f.status === "INCORPORADO" ? "sucesso" : "aviso"}>
                    {f.status === "INCORPORADO" ? "Incorporado" : f.status}
                  </Selo>
                </Celula>
              </tr>
            ))}
          </Tabela>
        ) : (
          <EstadoVazio
            titulo="Nenhuma fonte registrada"
            descricao="Os documentos normativos que embasam o catálogo ainda não foram anexados."
          />
        )}
      </Secao>
    </Pagina>
  );
}
