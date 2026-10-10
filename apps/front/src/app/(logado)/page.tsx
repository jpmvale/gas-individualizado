"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useMe } from "@/components/sessao";

/** A raiz manda cada papel para a sua tela inicial. */
export default function Inicio() {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (!me) return;
    router.replace(me.unidades.length ? "/consumo" : me.condominiosAdmin.length ? "/admin" : "/login");
  }, [me, router]);
  return <p className="muted">Carregando…</p>;
}
