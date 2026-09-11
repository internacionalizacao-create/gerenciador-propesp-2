import Link from "next/link";

import { MarcarLida } from "@/componentes/formularios/form-avisos";
import {
  Aviso,
  Celula,
  EstadoVazio,
  Pagina,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { CaixaDeEntrada, TipoNotificacao } from "@/lib/dominio";
import { dataHora } from "@/lib/formato";

/**
 * Caixa de entrada (D-11, decidido em 2026-09-07).
 *
 * **Fora de `programas/[programa]/[ciclo]`, de propósito.** A notificação é da
 * pessoa, não de um ciclo: ela pode ter sido avisada de uma missão de um ciclo
 * já encerrado, e o aviso continua sendo dela.
 *
 * Não há entrega por e-mail — não há servidor SMTP. Esta tela é o único canal
 * hoje, e a página diz isso em vez de deixar quem lê supor que também recebeu
 * um e-mail que nunca foi enviado.
 */

const ROTULO: Record<TipoNotificacao, string> = {
  MISSAO_SUBMETIDA: "Aguarda análise",
  DECISAO_COMITE: "Decisão do Comitê",
  ANALISE_REABERTA: "Análise reaberta",
  PRESTACAO_DEVOLVIDA: "Prestação devolvida",
  PRESTACAO_VALIDADA: "Prestação validada",
  PRESTACAO_PENDENTE: "Prestação pendente",
};

const TOM: Record<
  TipoNotificacao,
  "neutro" | "primario" | "sucesso" | "aviso" | "perigo" | "info"
> = {
  MISSAO_SUBMETIDA: "info",
  DECISAO_COMITE: "primario",
  ANALISE_REABERTA: "aviso",
  PRESTACAO_DEVOLVIDA: "aviso",
  PRESTACAO_VALIDADA: "sucesso",
  PRESTACAO_PENDENTE: "aviso",
};

export default async function AvisosPagina() {
  const caixa = await apiFetch<CaixaDeEntrada>("/notificacoes");

  return (
    <Pagina
      titulo="Avisos"
      descricao="O que aconteceu nas missões que você acompanha."
    >
      {caixa.vinculoPendente ? (
        // Caixa vazia por falta de vínculo e caixa vazia por falta de aviso são
        // coisas diferentes, e quem lê precisa poder distinguir.
        <Aviso tom="aviso" titulo="Conta ainda sem vínculo">
          Sua conta ainda não foi ligada a um cadastro de pessoa, então não há
          para onde endereçar avisos. Um administrador resolve isso em
          Configurações.
        </Aviso>
      ) : null}

      <Secao
        titulo={
          caixa.naoLidas > 0
            ? `Não lidos · ${caixa.naoLidas}`
            : "Caixa de entrada"
        }
        descricao="Decisões, devoluções e pendências das suas missões ficam reunidas aqui."
      >
        {caixa.itens.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum aviso"
            descricao="Você será avisado quando uma missão que acompanha for submetida, decidida, ou quando a prestação de contas mudar de estado."
          />
        ) : (
          <Tabela
            rotulo="Avisos"
            colunas={[
              { chave: "aviso", texto: "Aviso" },
              { chave: "missao", texto: "Missão" },
              { chave: "quando", texto: "Quando" },
              { chave: "acao", texto: "Ações" },
            ]}
          >
            {caixa.itens.map((item) => (
              <tr
                key={item.id}
                className={item.lidaEm ? "opacity-60" : undefined}
              >
                <Celula>
                  <div className="flex flex-wrap items-center gap-2">
                    <Selo tom={TOM[item.tipo]}>{ROTULO[item.tipo]}</Selo>
                    <span className="font-medium text-foreground">
                      {item.titulo}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {item.corpo}
                  </p>
                  {item.origemPor ? (
                    <p className="mt-0.5 text-xs text-subtle">
                      por {item.origemPor}
                    </p>
                  ) : (
                    // `PRESTACAO_PENDENTE` decorre do calendário, não de uma
                    // ação: atribuí-la a alguém seria falso.
                    <p className="mt-0.5 text-xs text-subtle">
                      gerado pelo sistema
                    </p>
                  )}
                </Celula>
                <Celula>
                  <Link
                    href={`/programas/capes-global/2027-2030/comite-gestor/missoes/${item.missaoId}`}
                    className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {item.missaoCodigo}
                  </Link>
                </Celula>
                <Celula>
                  <span className="whitespace-nowrap text-xs text-muted">
                    {dataHora(item.criadoEm)}
                  </span>
                </Celula>
                <Celula>
                  {item.lidaEm ? (
                    <span className="text-xs text-subtle">Lido</span>
                  ) : (
                    <MarcarLida id={item.id} />
                  )}
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>
    </Pagina>
  );
}
