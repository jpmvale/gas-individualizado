import type { Metadata } from "next";

import "./globals.css";

/**
 * Renderização sob demanda em TODAS as rotas.
 *
 * Não é preferência de arquitetura: é o que faz a CSP com nonce funcionar. O nonce nasce na
 * requisição, e página prerenderizada no build não tem requisição — o HTML sairia com script sem
 * nonce e a política recusaria os próprios scripts do Next.
 *
 * O preço é pequeno aqui: fora `/login` e `/convite`, tudo exige sessão, e página de quem está
 * logado não se prerenderiza de qualquer forma.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gás Individualizado",
  description: "Consumo de gás GLP por unidade",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
