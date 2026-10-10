import type { CookieOptions } from "express";

import { parseDuration } from "../../util/duration";

/**
 * Cookie de sessão httpOnly, igual ao coda (ADR-016 de lá): o token opaco viaja num cookie
 * invisível ao JS, same-origin atrás do Caddy. `SameSite=Lax` + mutações só por POST/PATCH/DELETE
 * fecham CSRF sem token extra. A API também aceita `Authorization: Bearer` (testes, ferramentas).
 */
export const COOKIE_SESSAO = "gas_sessao";

const ttlMs = () => parseDuration(process.env.SESSION_TTL ?? "30d", 30 * 86_400_000);

function base(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    path: "/",
  };
}

export const opcoesCookieSessao = (): CookieOptions => ({ ...base(), maxAge: ttlMs() });
export const opcoesLimparCookieSessao = (): CookieOptions => base();

/** Extrai o token do header `Cookie` cru: metade da ponte cookie→bearer do `main.ts`. */
export function tokenDoCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_SESSAO}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
