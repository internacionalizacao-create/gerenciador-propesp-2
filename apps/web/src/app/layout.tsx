import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeSynchronizer } from "@/componentes/layout/theme-toggle";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
