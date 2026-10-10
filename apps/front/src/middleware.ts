import { NextResponse, type NextRequest } from "next/server";

const COOKIE_SESSAO = "gas_sessao";
const PUBLICAS = ["/login", "/convite"];

/**
 * Porteiro no servidor: sem cookie de sessão, rota privada vai para o login antes de renderizar.
 * É por presença do cookie; a validade quem confere é a API (401 → o cliente volta ao login).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!publica && !req.cookies.has(COOKIE_SESSAO)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico|txt)$).*)"],
};
