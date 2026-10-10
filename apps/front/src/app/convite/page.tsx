"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Chama } from "@/components/odometro";
import { api, type Me } from "@/lib/api";

interface Convite {
  tipo: "morador" | "admin";
  email: string;
  nome: string;
  condominio: string;
  unidade: string | null;
  contaExistente: boolean;
}

function AceitarConvite() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [convite, setConvite] = useState<Convite | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");

  useEffect(() => {
    if (!token) return setErro("Link de convite incompleto. Abra o link do e-mail de novo.");
    api<Convite>(`/convites/${encodeURIComponent(token)}`).then(setConvite).catch((e) => setErro(e.message));
  }, [token]);

  const aceitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convite?.contaExistente && senha !== confirma) return setErro("As senhas não são iguais.");
    try {
      const me = await api<Me>("/convites/aceitar", { method: "POST", body: { token, senha } });
      router.replace(me.unidades.length ? "/consumo" : "/admin");
    } catch (err) {
      setErro((err as Error).message);
    }
  };

  return (
    <div className="login-form-wrap" style={{ minHeight: "100%" }}>
      <form className="login-form" onSubmit={aceitar} noValidate>
        <div className="brand"><Chama /> Gás Individualizado</div>
        {erro && <div className="error" role="alert">{erro}</div>}
        {convite && (
          <>
            <div>
              <h2>Olá, {convite.nome}</h2>
              <p className="muted small">
                {convite.tipo === "admin"
                  ? `Você foi convidado para administrar o ${convite.condominio}.`
                  : `Você foi convidado para acompanhar o consumo de gás de ${convite.unidade} no ${convite.condominio}.`}
              </p>
            </div>
            <div className="field"><label htmlFor="email">E-mail</label><input className="input" id="email" value={convite.email} disabled /></div>
            <div className="field">
              <label htmlFor="senha">{convite.contaExistente ? "Sua senha atual" : "Crie uma senha"}</label>
              <input className="input" id="senha" type="password" autoComplete={convite.contaExistente ? "current-password" : "new-password"} value={senha} onChange={(e) => setSenha(e.target.value)} />
              {!convite.contaExistente && <span className="small muted">Mínimo de 8 caracteres.</span>}
            </div>
            {!convite.contaExistente && (
              <div className="field"><label htmlFor="confirma">Repita a senha</label><input className="input" id="confirma" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} /></div>
            )}
            <button className="btn btn-primary" type="submit">Aceitar convite</button>
          </>
        )}
      </form>
    </div>
  );
}

export default function Pagina() {
  return <Suspense><AceitarConvite /></Suspense>;
}
