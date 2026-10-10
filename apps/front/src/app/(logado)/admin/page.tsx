"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GraficoBarras } from "@/components/grafico-barras";
import { api, type Painel } from "@/lib/api";
import { brl, diaMes, diaSemana, nf, quando, SITUACAO } from "@/lib/formato";
import { useCondominioAdmin } from "./usar-condominio";

/** UC-13: painel do condomínio. */
export default function PainelCondominio() {
  const router = useRouter();
  const cond = useCondominioAdmin();
  const [p, setP] = useState<Painel | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (cond) api<Painel>(`/condominios/${cond.id}/painel`).then(setP).catch((e) => setErro(e.message));
  }, [cond]);

  if (!cond) return <p className="muted">Sua conta não administra nenhum condomínio.</p>;
  if (erro) return <div className="error" role="alert">{erro}</div>;
  if (!p) return <p className="muted">Carregando…</p>;

  const transmitindo = p.medidores.total - p.medidores.semComunicacao;
  return (
    <>
      <div className="page-head">
        <div><span className="label">{p.condominio.nome}{p.condominio.cidade ? ` · ${p.condominio.cidade}` : ""}</span><h1>Este mês até agora</h1></div>
        <span className="fresh"><span className={`dot${p.medidores.semComunicacao ? " off" : ""}`} />{transmitindo} de {p.medidores.total} medidores transmitindo</span>
      </div>
      <section className="kpis">
        <div className="kpi"><span className="label">Consumo do condomínio</span><b>{nf(p.mes.m3, 1)} m³</b><span className="small muted">{nf(p.mes.kg, 0)} kg</span></div>
        <div className="kpi"><span className="label">Valor estimado</span><b>{p.mes.valor == null ? "—" : brl(p.mes.valor)}</b><span className="small muted">{p.condominio.precoKg == null ? "tarifa não cadastrada" : `a ${brl(p.condominio.precoKg)}/kg`}</span></div>
        <div className={`kpi${p.medidores.semComunicacao ? " crit" : ""}`}><span className="label">Sem comunicação</span><b>{p.medidores.semComunicacao}</b><span className="small muted">há mais de 36 horas</span></div>
        <div className={`kpi${p.pendencias.length ? " crit" : ""}`}><span className="label">Pendências</span><b>{p.pendencias.length}</b><span className="small muted">medidores com problema</span></div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>Consumo total por dia</h2><div className="legend"><span><i />Todas as unidades com dados no dia</span></div></div>
        <GraficoBarras
          rotulo="Consumo total do condomínio por dia"
          dados={p.porDia.map((d, i) => ({
            valor: d.m3,
            rotulo: i % 5 === 4 || i === p.porDia.length - 1 ? diaMes(d.periodo) : "",
            dica: (<><b>{diaSemana(d.periodo)} {diaMes(d.periodo)}</b><br />{nf(d.m3, 2)} m³<br />{d.medidores} de {p.medidores.total} medidores</>),
          }))}
        />
        <p className="note">Dias recentes podem aparecer menores enquanto houver medidores sem comunicação. Passe o mouse para ver quantos medidores entraram em cada dia.</p>
      </section>
      <section className="hero">
        <div className="panel">
          <div className="panel-head"><h2>Pendências</h2><button className="btn btn-sm" onClick={() => router.push("/admin/unidades")}>Ver todas as unidades</button></div>
          {p.pendencias.length ? (
            <div className="table-wrap"><table>
              <thead><tr><th>Unidade</th><th>Situação</th><th className="r">Última transmissão</th></tr></thead>
              <tbody>{p.pendencias.map((u) => (
                <tr key={u.id}><td>{u.tipo === "area_comum" ? u.identificacao : `${u.identificacao} ${u.bloco}`}</td><td><span className={`pill ${SITUACAO[u.situacao][0]}`}>{SITUACAO[u.situacao][1]}</span></td><td className="r">{quando(u.medidor?.ultimaTransmissao ?? null)}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <p className="muted">Nenhuma pendência.</p>}
        </div>
        <div className="panel">
          <div className="panel-head"><h2>Maior consumo por dia</h2></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Unidade</th><th className="r">m³/dia</th><th className="r">vs. média</th></tr></thead>
            <tbody>{p.maiorConsumo.map((u) => (
              <tr key={u.id}><td>{u.identificacao} {u.bloco}</td><td className="r">{nf(u.mediaDiariaMes ?? 0, 3)}</td><td className="r">{u.vsMedia == null ? "—" : `${u.vsMedia > 0 ? "+" : ""}${nf(u.vsMedia, 0)}%`}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      </section>
    </>
  );
}
