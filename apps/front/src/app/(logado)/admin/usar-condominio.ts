"use client";

import { useMe } from "@/components/sessao";

/** Condomínio que o admin está vendo (o primeiro que ele administra, por enquanto). */
export function useCondominioAdmin() {
  return useMe()?.condominiosAdmin[0] ?? null;
}
