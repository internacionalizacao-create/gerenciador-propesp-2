import Link from "next/link";
import { notFound } from "next/navigation";

import { CadastroPpg } from "@/componentes/formularios/cadastro-ppg";
import {
  Aviso,
  Cartao,
  Cartoes,
  Celula,
  EstadoVazio,
  Moeda,
  Pagina,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { ApiError, apiFetch } from "@/lib/api";
import type { Me, PpgDetalhe } from "@/lib/dominio";
import { inteiro, meses, rotulo, somarMoeda } from "@/lib/formato";

/** P14 · detalhe do PPG. */
export default async function DetalheDoPpg({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ppg, me] = await Promise.all([buscarPpg(id), apiFetch<Me>("/me")]);
  const podeEditar = me.permissions.includes("ppg:write");

  return (
    <Pagina
      titulo={ppg.sigla}
      voltar={{ href: "/ppgs", rotulo: "Voltar aos PPGs" }}
      descricao={
        <>
          {ppg.nome}
          {ppg.unidade ? ` · ${ppg.unidade}` : ""}
        </>
      }
      acoes={podeEditar ? <CadastroPpg ppg={ppg} /> : undefined}
    >
      {ppg.alertaTematicaDuplicada ? (
        <Aviso tom="aviso" titulo="Participação duplicada">
          {ppg.alertaTematicaDuplicada}
        </Aviso>
      ) : null}

      <Secao titulo="Dados institucionais">
        <Cartoes>
          <Cartao titulo="Nível" valor={rotulo(ppg.nivel)} />
          <Cartao titulo="Modalidade" valor={rotulo(ppg.modalidade)} />
          <Cartao
            titulo="Conceito CAPES"
            valor={ppg.notaCapes ? String(ppg.notaCapes) : "—"}
          />
          <Cartao titulo="Área CAPES" valor={ppg.areaCapes ?? "—"} />
          <Cartao
            titulo="Situação"
            valor={
              <Selo tom={ppg.situacao === "ATIVO" ? "sucesso" : "neutro"}>
                {rotulo(ppg.situacao)}
              </Selo>
            }
          />
          <Cartao
            titulo="Rede nacional"
            valor={ppg.emRede ? (ppg.redeAcademica ?? "Sim") : "Não"}
          />
        </Cartoes>

        {ppg.observacoes ? (
          <p className="mt-3 text-sm text-muted">{ppg.observacoes}</p>
        ) : null}
      </Secao>

      <Secao titulo="Linhas de pesquisa">
        {ppg.linhasPesquisa.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {ppg.linhasPesquisa.map((linha) => (
              <li
                key={linha.id}
                className="rounded-full bg-primary-soft px-3 py-1 text-sm text-on-primary-soft"
              >
                {linha.nome}
              </li>
            ))}
          </ul>
        ) : (
          <EstadoVazio
            titulo="Nenhuma linha cadastrada"
            descricao="As linhas de pesquisa entram pelo botão Editar e servirão para vincular produtos da cooperação na fase 2."
          />
        )}
      </Secao>

      <Secao
        titulo="Participação em programas"
        descricao="Em quais redes e áreas temáticas este PPG está mapeado."
      >
        {ppg.participacoes.length > 0 ? (
          <Tabela
            colunas={[
              { chave: "programa", texto: "Programa" },
              { chave: "ciclo", texto: "Ciclo" },
              { chave: "rede", texto: "Rede" },
              { chave: "tematica", texto: "Área temática" },
              { chave: "situacao", texto: "Situação" },
              { chave: "modalidades", texto: "Modalidades previstas" },
            ]}
          >
            {ppg.participacoes.map((p) => (
              <tr key={p.id}>
                <Celula>{p.programa}</Celula>
                <Celula>{p.ciclo}</Celula>
                <Celula>{p.rede}</Celula>
                <Celula>
                  <Link
                    href={`/programas/${p.programaSlug}/${p.ciclo}/tematicas/${p.tematicaCodigo}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {p.tematicaCodigo}
                  </Link>
                  <span className="block max-w-xs text-xs text-subtle">
                    {p.tematicaNome}
                  </span>
                </Celula>
                <Celula>
                  <Selo
                    tom={p.situacao === "CONTEMPLADO" ? "sucesso" : "neutro"}
                  >
                    {rotulo(p.situacao)}
                  </Selo>
                </Celula>
                <Celula className="max-w-sm text-muted">
                  {p.modalidadesPrevistas ?? "—"}
                </Celula>
              </tr>
            ))}
          </Tabela>
        ) : (
          <EstadoVazio
            titulo="Sem participação registrada"
            descricao="Este PPG está cadastrado, mas não foi vinculado a nenhuma área temática."
          />
        )}
      </Secao>

      <Secao
        titulo="Bolsas planejadas"
        descricao="Linhas do plano de aplicação que apontam para este PPG."
      >
        {ppg.plano.length > 0 ? (
          <Tabela
            colunas={[
              { chave: "codigo", texto: "Código" },
              { chave: "tematica", texto: "Temática" },
              { chave: "modalidade", texto: "Modalidade" },
              { chave: "destino", texto: "Destino" },
              { chave: "vigencia", texto: "Vigência" },
              { chave: "qtd", texto: "Qtd./ano", alinhamento: "direita" },
              { chave: "unit", texto: "Valor unitário", alinhamento: "direita" },
              { chave: "custo", texto: "Custo/ano", alinhamento: "direita" },
              { chave: "status", texto: "Status" },
            ]}
            rodape={
              <tr>
                <Celula>Total</Celula>
                <Celula>—</Celula>
                <Celula>—</Celula>
                <Celula>—</Celula>
                <Celula>—</Celula>
                <Celula direita>
                  {inteiro(
                    ppg.plano.reduce((t, l) => t + l.quantidadeAnual, 0),
                  )}
                </Celula>
                <Celula>—</Celula>
                <Celula direita>
                  <Moeda
                    valor={somarMoeda(ppg.plano.map((l) => l.custoAnual))}
                    forte
                  />
                </Celula>
                <Celula>—</Celula>
              </tr>
            }
          >
            {ppg.plano.map((linha) => (
              <tr key={linha.codigo}>
                <Celula>
                  <span className="font-mono text-xs">{linha.codigo}</span>
                </Celula>
                <Celula>{linha.tematica ?? "—"}</Celula>
                <Celula>{linha.modalidade ?? "—"}</Celula>
                <Celula>{rotulo(linha.destino)}</Celula>
                <Celula>{meses(linha.vigenciaMeses)}</Celula>
                <Celula direita>{inteiro(linha.quantidadeAnual)}</Celula>
                <Celula direita>
                  <Moeda valor={linha.valorUnitario} />
                </Celula>
                <Celula direita>
                  <Moeda valor={linha.custoAnual} />
                </Celula>
                <Celula>
                  <Selo
                    tom={linha.status === "PROGRAMADO" ? "sucesso" : "aviso"}
                  >
                    {rotulo(linha.status)}
                  </Selo>
                </Celula>
              </tr>
            ))}
          </Tabela>
        ) : (
          <EstadoVazio
            titulo="Nenhuma bolsa planejada"
            descricao="O PPG está mapeado, mas não há linha de planejamento programada para ele neste ciclo."
          />
        )}
      </Secao>

      <Secao
        titulo="Bolsistas, convênios e produção"
        descricao="Fases seguintes do sistema."
      >
        <EstadoVazio
          titulo="Ainda não há dados individuais"
          descricao="As planilhas de origem registram quantas bolsas cada PPG recebe, mas não quem foi, para onde nem se voltou. Estas abas nascem quando o primeiro bolsista for cadastrado."
        />
      </Secao>
    </Pagina>
  );
}

async function buscarPpg(id: string): Promise<PpgDetalhe> {
  try {
    return await apiFetch<PpgDetalhe>(`/ppgs/${id}`);
  } catch (erro) {
    // O detalhe de um PPG fora do escopo também responde 404. O mesmo estado
    // não revela se o id existe para quem não pode consultá-lo.
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  }
}
