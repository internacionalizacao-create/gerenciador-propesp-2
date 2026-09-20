import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";

import { ThemeSynchronizer } from "@/componentes/layout/theme-toggle";

import "./globals.css";

/**
 * Fontes locais, e nao `next/font/google` (V1-052).
 *
 * O carregador do Google **baixa os arquivos durante o build**. Ele depois
 * serve tudo do proprio dominio, entao o runtime nunca falava com o Google —
 * mas o build sim, e um build de intranet que precisa de saida para a internet
 * e um build que quebra no dia em que a saida nao existe.
 *
 * O pacote `geist` traz os `.woff2` dentro de `node_modules` e os carrega por
 * `next/font/local`. A fonte passa a vir pelo lockfile, como qualquer outra
 * dependencia, e instalar dependencias e um passo que o ambiente de build ja
 * tem de poder fazer — diferente de baixar um arquivo de terceiros no meio da
 * compilacao do codigo.
 *
 * **Os nomes das variaveis CSS sao os mesmos** (`--font-geist-sans` e
 * `--font-geist-mono`), entao `globals.css` e os tokens nao mudaram uma linha.
 */
const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: "Gerenciador PROPESP",
  description: "Sistema de gestão do PPGE e demais programas de pós-graduação",
};

/* Roda de forma sincrona durante o parse do HTML, antes da primeira pintura,
   para o tema salvo ser aplicado sem flash. O try/catch cobre o caso de
   localStorage indisponivel (modo restrito do navegador). */
const themeScript = `(function(){try{var t=localStorage.getItem("theme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeSynchronizer />
        {children}
      </body>
    </html>
  );
}
