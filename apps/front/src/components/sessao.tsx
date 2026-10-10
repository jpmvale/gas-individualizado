"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import { api, ApiError, type Me } from "@/lib/api";
import { Chama } from "./odometro";

const Ctx = createContext<Me | null>(null);
export const useMe = () => useContext(Ctx);

const ABAS_MORADOR = [["/consumo", "Meu consumo"], ["/historico", "Histórico"]] as const;
const ABAS_ADMIN = [["/admin", "Condomínio"], ["/admin/unidades", "Unidades e medidores"], ["/admin/moradores", "Moradores"]] as const;

/** Carrega o usuário logado e desenha a barra superior com as abas do papel dele. */
export function AreaLogada({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const caminho = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Me>("/auth/me")
      .then(setMe)
      .catch((e) => (e instanceof ApiError && e.status === 401 ? router.replace("/login") : setErro(e.message)));
  }, [router]);

  if (erro) return <main><div className="error" role="alert">{erro}</div></main>;
  if (!me) return <main><p className="muted">Carregando…</p></main>;

  const ehAdmin = me.condominiosAdmin.length > 0;
  const abas = [...(me.unidades.length ? ABAS_MORADOR : []), ...(ehAdmin ? ABAS_ADMIN : [])];
  const contexto = me.unidades[0] ? `Apto ${me.unidades[0].identificacao} ${me.unidades[0].bloco}` : ehAdmin ? "Administração" : "";
  const condominio = me.unidades[0]?.condominio ?? me.condominiosAdmin[0]?.nome;

  const sair = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  };

  return (
    <Ctx.Provider value={me}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand"><Chama /> Gás Individualizado</div>
          {condominio && <span className="chip condo">{condominio}</span>}
          <div className="spacer" />
          <div className="who">
            <span className="name">{me.nome}{contexto ? ` · ${contexto}` : ""}</span>
            <button className="btn btn-sm" onClick={sair}>Sair</button>
          </div>
        </div>
        <nav className="tabs" role="tablist">
          {abas.map(([href, t]) => (
            <button key={href} className="tab" role="tab" aria-selected={caminho === href} onClick={() => router.push(href)}>{t}</button>
          ))}
        </nav>
      </header>
      <main>{children}</main>
    </Ctx.Provider>
  );
}
