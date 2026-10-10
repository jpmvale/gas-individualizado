"use client";

import { useCallback, useEffect, useState } from "react";

import { api, type Moradores, type UnidadeAdmin } from "@/lib/api";
import { useCondominioAdmin } from "../usar-condominio";

/** UC-11: moradores e convites. */
export default function MoradoresPagina() {
  const cond = useCondominioAdmin();
  const [dados, setDados] = useState<Moradores | null>(null);
  const [unidades, setUnidades] = useState<UnidadeAdmin[]>([]);
  const [form, setForm] = useState({ unidadeId: "", nome: "", email: "" });
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string; link?: string } | null>(null);

  const carregar = useCallback(() => {
    if (!cond) return;
    api<Moradores>(`/condominios/${cond.id}/moradores`).then(setDados).catch((e) => setMsg({ tipo: "erro", texto: e.message }));
  }, [cond]);

  useEffect(() => {
    carregar();
    if (cond) api<UnidadeAdmin[]>(`/condominios/${cond.id}/unidades`).then((u) => {
      const res = u.filter((x) => x.tipo === "residencial");
      setUnidades(res);
      setForm((f) => ({ ...f, unidadeId: f.unidadeId || res[0]?.id || "" }));
    });
  }, [cond, carregar]);

  if (!cond) return <p className="muted">Sua conta não administra nenhum condomínio.</p>;

  const convidar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      return setMsg({ tipo: "erro", texto: "Preencha o nome e um e-mail válido para enviar o convite." });
    }
    try {
      const r = await api<{ link: string }>(`/condominios/${cond.id}/convites`, { method: "POST", body: { tipo: "morador", ...form } });
      setMsg({ tipo: "ok", texto: `Convite criado para ${form.email}. Se o e-mail não estiver configurado, envie este link:`, link: r.link });
      setForm((f) => ({ ...f, nome: "", email: "" }));
      carregar();
    } catch (err) {
      setMsg({ tipo: "erro", texto: (err as Error).message });
    }
  };

  return (
    <>
      <div className="page-head"><div><span className="label">{cond.nome}</span><h1>Moradores</h1></div></div>
      <section className="panel">
        <h2>Convidar morador</h2>
        <form className="form-grid" onSubmit={convidar} noValidate>
          <div className="field"><label htmlFor="c-un">Unidade</label>
            <select className="input" id="c-un" value={form.unidadeId} onChange={(e) => setForm({ ...form, unidadeId: e.target.value })}>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.identificacao} {u.bloco}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="c-nome">Nome</label><input className="input" id="c-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" /></div>
          <div className="field"><label htmlFor="c-email">E-mail</label><input className="input" id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nome@email.com" /></div>
          <button className="btn btn-primary" type="submit">Enviar convite</button>
        </form>
        {msg ? (
          <p className="note" role="status" style={msg.tipo === "erro" ? { color: "var(--crit)" } : undefined}>
            {msg.texto} {msg.link && <code style={{ wordBreak: "break-all" }}>{msg.link}</code>}
          </p>
        ) : (
          <p className="note">O morador recebe um link válido por 7 dias para criar a senha. Ele só vê o consumo a partir da data em que aceitar o convite.</p>
        )}
      </section>
      <div className="table-wrap"><table>
        <thead><tr><th>Unidade</th><th>Nome</th><th>E-mail</th><th className="r">Desde</th><th>Situação</th></tr></thead>
        <tbody>
          {dados?.convitesPendentes.map((c) => (
            <tr key={c.id}><td>{c.unidade ?? "Administração"}</td><td>{c.nome}</td><td>{c.email}</td><td className="r">—</td><td><span className="pill warn">Convite enviado</span></td></tr>
          ))}
          {dados?.ativos.map((m) => (
            <tr key={m.id}><td>{m.unidade}</td><td>{m.nome}</td><td>{m.email}</td><td className="r">{new Date(m.desde).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td><td><span className="pill good">Ativo</span></td></tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
