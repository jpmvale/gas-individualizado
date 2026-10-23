import { NextResponse, type NextRequest } from "next/server";

const COOKIE_SESSAO = "gas_sessao";
const PUBLICAS = ["/login", "/convite"];

/**
 * CSP da resposta, com um nonce novo a cada uma.
 *
 * Em modo relatório o domínio acusava oito violações de `script-src` — a hidratação que o Next
 * embute no HTML. Hash no proxy não serve: muda a cada build, e o build seguinte deixaria a tela
 * branca em produção sem erro nenhum do lado do servidor.
 *
 * ⚠ Só funciona porque as rotas são DINÂMICAS (`force-dynamic` no layout). Em página
 * prerenderizada não há requisição na hora de gerar o HTML, logo não há nonce para carimbar.
 *
 * `'strict-dynamic'` acompanha o nonce: o bootstrap do Next carrega os chunks dinamicamente, e sem
 * ele cada chunk precisaria do próprio nonce.
 *
 * Google Fonts liberado em `style-src` e `font-src` porque o layout busca a folha lá. Servir a
 * fonte da própria máquina seria melhor — um terceiro a menos vendo o IP de quem visita —, mas é
 * outra mudança.
 */
function politicaCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Porteiro no servidor: sem cookie de sessão, rota privada vai para o login antes de renderizar.
 * É por presença do cookie; a validade quem confere é a API (401 → o cliente volta ao login).
 *
 * Também emite a CSP com nonce (ADR-G07).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // Redirecionamento não tem corpo que execute script: CSP nele não protegeria nada.
  if (!publica && !req.cookies.has(COOKIE_SESSAO)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = politicaCsp(nonce);

  // Os dois cabeçalhos são necessários, por motivos diferentes: na REQUISIÇÃO é de onde o Next tira
  // o nonce para carimbar nos próprios scripts; na RESPOSTA é o que o navegador obedece. Esquecer o
  // primeiro deixa a tela branca.
  const cabecalhos = new Headers(req.headers);
  cabecalhos.set("x-nonce", nonce);
  cabecalhos.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: cabecalhos } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico|txt)$).*)"],
};
