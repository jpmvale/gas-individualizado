import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Public_Sans } from "next/font/google";

import "./globals.css";

/**
 * Fontes servidas pela PRÓPRIA máquina, e não pelo Google.
 *
 * O `next/font/google` baixa os arquivos no build e os publica em `/_next/static`. Nada é buscado
 * em fonts.googleapis.com ou fonts.gstatic.com em tempo de execução.
 *
 * Duas razões. Privacidade: cada visita mandava o IP de quem lê para um terceiro que não precisa
 * saber que esta página existe — e aqui quem lê é morador de condomínio, não visitante anônimo. E
 * a CSP: sem origem externa, `style-src` e `font-src` ficam em `'self'` puro.
 *
 * `display: "swap"` preserva o comportamento de antes (a URL trazia `&display=swap`), e os pesos
 * são os mesmos que a folha do Google pedia — tirar um aqui some com ele na tela.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
  variable: "--f-display-fonte",
});

const corpo = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--f-body-fonte",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
  variable: "--f-mono-fonte",
});

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
    <html lang="pt-BR" className={`${display.variable} ${corpo.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
