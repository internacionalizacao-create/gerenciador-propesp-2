import { SubNav } from "@/componentes/layout/sub-nav";

/**
 * Casca das telas de um ciclo.
 *
 * Todas compartilham o mesmo recorte (programa + ciclo), e a sub-navegação
 * evita que o usuário precise voltar ao menu lateral para trocar de aba dentro
 * do mesmo planejamento.
 */
export default async function LayoutDoCiclo({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ programa: string; ciclo: string }>;
}) {
  const { programa, ciclo } = await params;

  return (
    <>
      <SubNav base={`/programas/${programa}/${ciclo}`} />
      {children}
    </>
  );
}
