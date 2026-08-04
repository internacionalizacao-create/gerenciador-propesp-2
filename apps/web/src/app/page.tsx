import { ThemeToggle } from "./theme-toggle";

/* Classes escritas por extenso de proposito: o Tailwind 4 escaneia o texto do
   codigo-fonte, entao nomes montados dinamicamente (`bg-${cor}`) nao geram CSS. */
const SWATCHES = [
  { box: "bg-background border border-border", name: "background", use: "fundo da página" },
  { box: "bg-surface border border-border", name: "surface", use: "cards, painéis" },
  { box: "bg-surface-muted border border-border", name: "surface-muted", use: "cabeçalho de tabela, seções" },
  { box: "bg-border", name: "border", use: "divisórias, bordas de card" },
  { box: "bg-border-strong", name: "border-strong", use: "bordas de input (3:1)" },
  { box: "bg-foreground", name: "foreground", use: "texto principal" },
  { box: "bg-muted", name: "muted", use: "texto secundário" },
  { box: "bg-subtle", name: "subtle", use: "texto terciário, placeholder" },
  { box: "bg-primary", name: "primary", use: "marca, ação principal" },
  { box: "bg-primary-hover", name: "primary-hover", use: "hover da ação principal" },
  { box: "bg-primary-soft", name: "primary-soft", use: "destaque suave da marca" },
  { box: "bg-success", name: "success", use: "aprovado, concluído" },
  { box: "bg-warning", name: "warning", use: "pendente, prazo próximo" },
  { box: "bg-danger", name: "danger", use: "erro, reprovado" },
  { box: "bg-info", name: "info", use: "informativo, em análise" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 mb-5 text-sm text-muted">{description}</p>
      ) : (
        <div className="mb-5" />
      )}
      {children}
    </section>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-12 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Gerenciador PROPESP
          </h1>
          <p className="mt-1 text-sm text-muted">
            Tema institucional — verde floresta, claro e escuro.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section
        title="Paleta"
        description="Cada token troca de valor conforme o tema. Use sempre o nome semântico, nunca o hex."
      >
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SWATCHES.map((swatch) => (
            <li
              key={swatch.name}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <span
                className={`h-10 w-10 shrink-0 rounded-md ${swatch.box}`}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <code className="block font-mono text-sm text-foreground">
                  {swatch.name}
                </code>
                <span className="block text-xs text-subtle">{swatch.use}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Ações"
        description="O anel de foco vem do token ring — navegue com Tab para vê-lo."
      >
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            Salvar alterações
          </button>
          <button
            type="button"
            className="rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-soft px-4 py-2 text-sm font-medium text-on-primary-soft"
          >
            Exportar relatório
          </button>
          <button
            type="button"
            className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-on-danger"
          >
            Excluir
          </button>
        </div>
      </Section>

      <Section
        title="Status"
        description="O verde da marca não é usado em status — sucesso é teal, para os dois não se confundirem."
      >
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-on-success-soft">
            Defesa aprovada
          </span>
          <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-medium text-on-warning-soft">
            Relatório pendente
          </span>
          <span className="rounded-full bg-danger-soft px-3 py-1 text-xs font-medium text-on-danger-soft">
            Matrícula indeferida
          </span>
          <span className="rounded-full bg-info-soft px-3 py-1 text-xs font-medium text-on-info-soft">
            Em análise
          </span>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-on-primary-soft">
            PPGE
          </span>
        </div>
      </Section>

      <Section title="Formulário">
        <form className="max-w-sm space-y-4 rounded-xl border border-border bg-surface p-5">
          <div>
            <label
              htmlFor="programa"
              className="block text-sm font-medium text-foreground"
            >
              Programa
            </label>
            <input
              id="programa"
              type="text"
              defaultValue="PPGE"
              className="mt-1.5 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle"
            />
          </div>
          <div>
            <label
              htmlFor="orientador"
              className="block text-sm font-medium text-foreground"
            >
              Orientador
            </label>
            <input
              id="orientador"
              type="text"
              placeholder="Buscar por nome ou SIAPE"
              className="mt-1.5 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle"
            />
            <p className="mt-1.5 text-xs text-subtle">
              Somente docentes credenciados aparecem na busca.
            </p>
          </div>
          <button
            type="button"
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            Cadastrar
          </button>
        </form>
      </Section>

      <Section title="Tabela">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-md border-collapse text-left text-sm">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium text-muted">Discente</th>
                <th className="px-4 py-2.5 font-medium text-muted">Programa</th>
                <th className="px-4 py-2.5 font-medium text-muted">Situação</th>
              </tr>
            </thead>
            <tbody className="bg-surface">
              {[
                { nome: "Ana Ribeiro", programa: "PPGE", tag: "success" },
                { nome: "Carlos Menezes", programa: "PPGQ", tag: "warning" },
                { nome: "Marina Alves", programa: "PPGE", tag: "info" },
              ].map((linha, index) => (
                <tr
                  key={linha.nome}
                  className={index > 0 ? "border-t border-border" : undefined}
                >
                  <td className="px-4 py-2.5 text-foreground">{linha.nome}</td>
                  <td className="px-4 py-2.5 text-muted">{linha.programa}</td>
                  <td className="px-4 py-2.5">
                    {linha.tag === "success" && (
                      <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-on-success-soft">
                        Titulado
                      </span>
                    )}
                    {linha.tag === "warning" && (
                      <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-on-warning-soft">
                        Prazo próximo
                      </span>
                    )}
                    {linha.tag === "info" && (
                      <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-medium text-on-info-soft">
                        Cursando
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}
