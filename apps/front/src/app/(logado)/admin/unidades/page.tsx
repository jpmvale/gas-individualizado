"use client";

import { useEffect, useState } from "react";

import { api, type UnidadeAdmin } from "@/lib/api";
import { nf, quando, SITUACAO } from "@/lib/formato";
import { useCondominioAdmin } from "../usar-condominio";

/** UC-10/12: unidades, moradores e saúde de cada medidor. */
export default function Unidades() {
  const cond = useCondominioAdmin();
  const [lista, setLista] = useState<UnidadeAdmin[] | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "pendentes">("todas");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (cond) api<UnidadeAdmin[]>(`/condominios/${cond.id}/unidades`).then(setLista).catch((e) => setErro(e.message));
  }, [cond]);

  if (!cond) return <p className="muted">Sua conta não administra nenhum condomínio.</p>;
  if (erro) return <div className="error" role="alert">{erro}</div>;
  if (!lista) return <p className="muted">Carregando…</p>;
  const linhas = filtro === "todas" ? lista : lista.filter((u) => u.situacao !== "normal");

  return (
    <>
      <div className="page-head">
        <div><span className="label">{cond.nome}</span><h1>Unidades e medidores</h1></div>
        <div className="controls">
          <div className="seg" role="group" aria-label="Filtrar">
            <button aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas ({lista.length})</button>
            <button aria-pressed={filtro === "pendentes"} onClick={() => setFiltro("pendentes")}>Com pendência ({lista.filter((u) => u.situacao !== "normal").length})</button>
          </div>
        </div>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Unidade</th><th>Morador</th><th>Medidor</th><th className="r">Este mês (m³)</th><th className="r">vs. média</th><th className="r">Última transmissão</th><th className="r">Bateria</th><th>Situação</th></tr></thead>
        <tbody>{linhas.map((u) => (
          <tr key={u.id}>
            <td><b>{u.tipo === "area_comum" ? u.identificacao : `${u.identificacao} ${u.bloco}`}</b></td>
            <td>{u.tipo === "area_comum" ? <span className="muted">Área comum</span> : u.moradores ?? <span className="muted">Sem morador</span>}</td>
            <td className="small">{u.medidor ? <><span className="num">{u.medidor.idExterno}</span><br /><span className="muted">{u.medidor.modelo}</span></> : "—"}</td>
            <td className="r">{nf(u.m3Mes, 2)}</td>
            <td className="r">{u.vsMedia == null ? "—" : `${u.vsMedia > 0 ? "+" : ""}${nf(u.vsMedia, 0)}%`}</td>
            <td className="r">{quando(u.medidor?.ultimaTransmissao ?? null)}</td>
            <td className="r">{u.medidor?.bateriaV == null ? "—" : `${nf(u.medidor.bateriaV, 2)} V`}</td>
            <td><span className={`pill ${SITUACAO[u.situacao][0]}`}>{SITUACAO[u.situacao][1]}</span></td>
          </tr>
        ))}</tbody>
      </table></div>
      <p className="note">O código do medidor é o identificador do equipamento na fonte de leituras. Quando a integração com a Aépio entrar, é por ele que cada leitura chega à unidade certa.</p>
    </>
  );
}
