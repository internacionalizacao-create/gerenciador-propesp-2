import { EditarModalidade } from "@/componentes/formularios/form-modalidade";
import {
  Celula,
  EstadoVazio,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import type { Modalidade } from "@/lib/dominio";
import { inteiro, rotulo } from "@/lib/formato";

/** Leitura responsiva das modalidades; a consulta continua no Server Component. */
export function ListaModalidades({
  modalidades,
  podeEditar,
  acaoVazia,
}: {
  modalidades: Modalidade[];
  podeEditar: boolean;
  acaoVazia?: React.ReactNode;
}) {
  if (modalidades.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma modalidade cadastrada"
        descricao="Cadastre uma modalidade para depois publicar seus destinos, vigências e valores na tabela oficial."
        acao={acaoVazia}
      />
    );
  }

  return (
    <>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        A duração não pertence à modalidade: cada item publicado no catálogo
        define sua própria vigência e valor. Assim, uma modalidade pode ter
        regras de duração diferentes para Brasil e exterior.
      </p>
      <div className="hidden md:block">
        <Tabela
          rotulo="Modalidades de bolsa"
          colunas={[
            { chave: "nome", texto: "Modalidade" },
            { chave: "publico", texto: "Público-alvo" },
            { chave: "destinos", texto: "Destinos com valor publicado" },
            { chave: "itens", texto: "Itens no catálogo", alinhamento: "direita" },
            { chave: "ativa", texto: "Situação" },
            ...(podeEditar
              ? [{ chave: "acoes", texto: <span className="sr-only">Ações</span> }]
              : []),
          ]}
        >
          {modalidades.map((modalidade) => (
            <LinhaModalidade
              key={modalidade.id}
              modalidade={modalidade}
              podeEditar={podeEditar}
            />
          ))}
        </Tabela>
      </div>

      <ul className="grid gap-3 md:hidden">
        {modalidades.map((modalidade) => (
          <li
            key={modalidade.id}
            className="rounded-2xl border border-border bg-surface p-4 shadow-[0_12px_30px_-28px_var(--border-strong)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground">{modalidade.nome}</h3>
                <p className="mt-1 text-sm text-muted">
                  {rotulo(modalidade.publicoAlvo)}
                </p>
              </div>
              <Selo tom={modalidade.ativa ? "sucesso" : "neutro"}>
                {modalidade.ativa ? "Ativa" : "Inativa"}
              </Selo>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Destinos modalidade={modalidade} />
            </div>
            <p className="mt-3 text-xs text-subtle">
              {inteiro(modalidade.itens)} item(ns) com vigência e valor publicados
            </p>
            {podeEditar ? (
              <div className="mt-4 border-t border-border pt-3">
                <EditarModalidade modalidade={modalidade} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function LinhaModalidade({
  modalidade,
  podeEditar,
}: {
  modalidade: Modalidade;
  podeEditar: boolean;
}) {
  return (
    <tr>
      <Celula>
        <span className="font-medium text-foreground">{modalidade.nome}</span>
      </Celula>
      <Celula className="text-muted">{rotulo(modalidade.publicoAlvo)}</Celula>
      <Celula>
        <div className="flex gap-2"><Destinos modalidade={modalidade} /></div>
      </Celula>
      <Celula direita>{inteiro(modalidade.itens)}</Celula>
      <Celula>
        <Selo tom={modalidade.ativa ? "sucesso" : "neutro"}>
          {modalidade.ativa ? "Ativa" : "Inativa"}
        </Selo>
      </Celula>
      {podeEditar ? <Celula><EditarModalidade modalidade={modalidade} /></Celula> : null}
    </tr>
  );
}

function Destinos({ modalidade }: { modalidade: Modalidade }) {
  if (!modalidade.permiteBrasil && !modalidade.permiteExterior) {
    return <span className="text-subtle">Nenhum destino publicado</span>;
  }

  return (
    <>
      {modalidade.permiteBrasil ? <Selo tom="info">Brasil</Selo> : null}
      {modalidade.permiteExterior ? <Selo tom="primario">Exterior</Selo> : null}
    </>
  );
}
