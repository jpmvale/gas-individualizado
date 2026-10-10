"use client";

import { useEffect, useMemo, useState } from "react";

import { GraficoBarras } from "@/components/grafico-barras";
import { useMe } from "@/components/sessao";
import { api, type PontoSerie } from "@/lib/api";
import { diaMes, diaSemana, MESES, MESES_LONGOS, nf, somaDias } from "@/lib/formato";

type Modo = "hora" | "dia" | "mes";

const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** UC-03: histórico por hora, dia ou mês, em gráfico ou tabela. */
export default function Historico() {
  const me = useMe();
  const unidade = me?.unidades[0];
  const [modo, setModo] = useState<Modo>("dia");
  const [dia, setDia] = useState(() => somaDias(hojeSP(), -1));
  const [tabela, setTabela] = useState(false);
  const [serie, setSerie] = useState<PontoSerie[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const periodo = useMemo(() => {
    const hoje = hojeSP();
    if (modo === "hora") return { de: dia, ate: somaDias(dia, 1), titulo: `Consumo por hora em ${diaMes(dia)}` };
    if (modo === "dia") return { de: somaDias(hoje, -30), ate: somaDias(hoje, 1), titulo: "Consumo por dia, últimos 30 dias" };
    const inicio = new Date(`${hoje.slice(0, 7)}-01T12:00:00Z`);
    inicio.setUTCMonth(inicio.getUTCMonth() - 11);
    return { de: inicio.toISOString().slice(0, 10), ate: somaDias(hoje, 1), titulo: "Consumo por mês, últimos 12 meses" };
  }, [modo, dia]);

  useEffect(() => {
    if (!unidade) return;
    setSerie(null);
    api<{ serie: PontoSerie[] }>(`/unidades/${unidade.unidadeId}/consumo?granularidade=${modo}&de=${periodo.de}&ate=${periodo.ate}`)
      .then((r) => setSerie(r.serie))
      .catch((e) => setErro(e.message));
  }, [unidade, modo, periodo]);

  if (!unidade) return <p className="muted">Sua conta não tem unidade vinculada.</p>;

  const rotulo = (p: PontoSerie, i: number, n: number) => {
    if (modo === "hora") return Number(p.periodo.slice(11, 13)) % 3 === 0 ? `${p.periodo.slice(11, 13)}h` : "";
    if (modo === "dia") return i % 5 === 4 || i === n - 1 ? diaMes(p.periodo) : "";
    return MESES[Number(p.periodo.slice(5, 7)) - 1];
  };
  const nome = (p: PontoSerie) =>
    modo === "hora" ? `${p.periodo.slice(11, 16)}` : modo === "dia" ? `${diaSemana(p.periodo)} ${diaMes(p.periodo)}` : `${MESES_LONGOS[Number(p.periodo.slice(5, 7)) - 1]}/${p.periodo.slice(0, 4)}`;
  const mesAtual = hojeSP().slice(0, 7);

  return (
    <>
      <div className="page-head">
        <div><span className="label">Apto {unidade.identificacao} · Bloco {unidade.bloco}</span><h1>Histórico</h1></div>
        <div className="controls">
          <div className="seg" role="group" aria-label="Agrupar por">
            {(["hora", "dia", "mes"] as Modo[]).map((m) => (
              <button key={m} aria-pressed={modo === m} onClick={() => setModo(m)}>{m === "hora" ? "Hora" : m === "dia" ? "Dia" : "Mês"}</button>
            ))}
          </div>
          {modo === "hora" && (
            <>
              <label className="small muted" htmlFor="dia-hist">Dia</label>
              <input className="input" style={{ width: "auto" }} type="date" id="dia-hist" max={hojeSP()} value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} />
            </>
          )}
          <button className="btn btn-sm" onClick={() => setTabela(!tabela)}>{tabela ? "Ver gráfico" : "Ver tabela"}</button>
        </div>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>{periodo.titulo}</h2>
          <div className="legend"><span><i />Seu consumo</span><span><i className="ref" />Média do condomínio</span></div>
        </div>
        {erro && <div className="error" role="alert">{erro}</div>}
        {!serie && !erro && <p className="muted">Carregando…</p>}
        {serie && serie.length === 0 && <p className="muted">Sem leituras neste período.</p>}
        {serie && serie.length > 0 && (tabela ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{modo === "hora" ? "Hora" : modo === "dia" ? "Dia" : "Mês"}</th><th className="r">m³</th><th className="r">Média do condomínio (m³)</th></tr></thead>
              <tbody>{serie.map((p) => (<tr key={p.periodo}><td>{nome(p)}</td><td className="r">{nf(p.m3, 3)}</td><td className="r">{p.mediaCondominio == null ? "—" : nf(p.mediaCondominio, 3)}</td></tr>))}</tbody>
            </table>
          </div>
        ) : (
          <GraficoBarras
            rotulo={periodo.titulo}
            referencia={serie.map((p) => p.mediaCondominio)}
            dados={serie.map((p, i) => ({
              valor: p.m3,
              rotulo: rotulo(p, i, serie.length),
              parcial: modo === "mes" && p.periodo === mesAtual,
              dica: (<><b>{nome(p)}</b>{modo === "mes" && p.periodo === mesAtual ? " (parcial)" : ""}<br />Você: {nf(p.m3, 3)} m³{p.mediaCondominio != null && <><br />Média: {nf(p.mediaCondominio, 3)} m³</>}</>),
            }))}
          />
        ))}
        {modo === "hora" && <p className="note">O medidor registra o consumo de cada hora e envia o dia inteiro de uma vez. Horas depois da última transmissão ainda não aparecem.</p>}
      </section>
    </>
  );
}
