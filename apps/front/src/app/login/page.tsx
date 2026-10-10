"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Chama } from "@/components/odometro";
import { api, type Me } from "@/lib/api";

const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e?: React.FormEvent, conta?: string) => {
    e?.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const me = await api<Me>("/auth/login", { method: "POST", body: { email: conta ?? email, senha: conta ? "gas12345" : senha } });
      router.replace(me.unidades.length ? "/consumo" : "/admin");
    } catch (err) {
      setErro((err as Error).message);
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <section className="login-brand">
        <div className="brand" style={{ color: "var(--odo-fg)" }}><Chama /> Gás Individualizado</div>
        <h1>Cada apartamento sabe quanto gás usou.</h1>
        <p>O medidor da sua unidade envia as leituras uma vez por dia. Aqui você acompanha o consumo hora a hora e a estimativa da conta.</p>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={entrar} noValidate>
          <div>
            <h2>Entrar</h2>
            <p className="muted small">Acesso por convite do condomínio.</p>
          </div>
          {erro && <div className="error" role="alert">{erro}</div>}
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input className="input" id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="senha">Senha</label>
            <input className="input" id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
          {DEMO && (
            <div className="demo-accounts">
              <span className="label">Contas de demonstração · senha gas12345</span>
              <div className="demo-row">
                <button className="btn" type="button" onClick={() => entrar(undefined, "ana@exemplo.com")}><strong>Moradora</strong><span className="small muted">Ana · apto 302 A</span></button>
                <button className="btn" type="button" onClick={() => entrar(undefined, "sindico@exemplo.com")}><strong>Admin</strong><span className="small muted">Carlos · síndico</span></button>
              </div>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
