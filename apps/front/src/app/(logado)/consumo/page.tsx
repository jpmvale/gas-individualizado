"use client";

import { useEffect, useState } from "react";

import { GraficoBarras } from "@/components/grafico-barras";
import { Odometro } from "@/components/odometro";
import { useMe } from "@/components/sessao";
import { api, type PontoSerie, type Resumo } from "@/lib/api";
import { brl, diaMes, diaSemana, MESES_LONGOS, nf, quando } from "@/lib/formato";

/** UC-02: painel do morador. */
export default function MeuConsumo() {
  const me = useMe();
  const unidadeId = me?.unidades[0]?.unidadeId;
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [serie, setSerie] = useState<PontoSerie[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!unidadeId) return;
    api<Resumo>(`/unidades/${unidadeId}/resumo`)
      .then(async (r) => {
        setResumo(r);
        if (r.comparacao) {
          const s = await api<{ serie: PontoSerie[] }>(`/unidades/${unidadeId}/consumo?granularidade=dia&de=${r.comparacao.de}&ate=${r.comparacao.ate}`);
          setSerie(s.serie);
        }
      })
      .catch((e) => setErro(e.message));
  }, [unidadeId]);

  if (!unidadeId) return <p className="muted">Sua conta não tem unidade vinculada.</p>;
  if (erro) return <div className="error" role="alert">{erro}</div>;
  if (!resumo) return <p className="muted">Carregando…</p>;

  const { unidade, mes, medidor, comparacao, condominio } = resumo;
  const nomeMes = MESES_LONGOS[Number(mes.referencia.slice(5, 7)) - 1];
  const diff = comparacao?.mediaCondominio ? (comparacao.mediaDiaria / comparacao.mediaCondominio - 1) * 100 : null;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="label">Apto {unidade.identificacao} · Bloco {unidade.bloco}</span>
          <h1>{nomeMes} até agora</h1>
        </div>
        {medidor && (
          <span className="fresh"><span className="dot" />Dados até {quando(medidor.dadosAte)} · o medidor transmite uma vez por dia</span>
        )}
      </div>
      <section className="hero">
        <div className="panel hero-main">
          <div className="big num">{nf(mes.m3, 2)}<small>m³</small></div>
          <div className="facts">
            <div className="fact"><span className="label">Em quilos</span><b>{nf(mes.kg, 1)} kg</b></div>
            {mes.valor != null && <div className="fact"><span className="label">Valor até agora</span><b>{brl(mes.valor)}</b></div>}
            {mes.projecaoValor != null && <div className="fact"><span className="label">Projeção do mês</span><b>{brl(mes.projecaoValor)}</b></div>}
            <div className="fact"><span className="label">Hoje</span><b>{nf(resumo.hoje.m3, 3)} m³</b></div>
          </div>
          <p className="note">
            {condominio.precoKg != null
              ? `Valores estimados com a tarifa atual de ${brl(condominio.precoKg)}/kg e ${nf(condominio.fatorM3Kg, 1)} kg por m³. O valor final sai no fechamento do mês.`
              : "O condomínio ainda não cadastrou a tarifa do gás, então os valores em reais não aparecem."}
          </p>
        </div>
        <div className="meter-card">
          <span className="label">Leitura do medidor</span>
          {medidor?.leituraAtualM3 != null ? <Odometro valor={medidor.leituraAtualM3} /> : <span className="muted">Sem leitura ainda</span>}
          <p className="small muted">Igual ao mostrador do seu medidor{medidor?.modelo ? ` (${medidor.modelo})` : ""}. Os dígitos vermelhos são litros.</p>
        </div>
      </section>
      {comparacao && diff != null && (
        <div className={`compare${diff > 0 ? " above" : ""}`}>
          <span>
            Nos últimos {comparacao.dias} dias você usou em média <strong>{nf(comparacao.mediaDiaria, 3)} m³ por dia</strong>, {nf(Math.abs(diff), 0)}% {diff > 0 ? "acima" : "abaixo"} da média das unidades do condomínio.
          </span>
        </div>
      )}
      {serie.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>Últimos {serie.length} dias</h2>
            <div className="legend"><span><i />Seu consumo diário</span><span><i className="ref" />Média do condomínio</span></div>
          </div>
          <GraficoBarras
            rotulo="Consumo diário, em metros cúbicos"
            referencia={serie.map((p) => p.mediaCondominio)}
            dados={serie.map((p, i) => ({
              valor: p.m3,
              rotulo: i % 5 === 4 || i === serie.length - 1 ? diaMes(p.periodo) : "",
              dica: (<><b>{diaSemana(p.periodo)} {diaMes(p.periodo)}</b><br />Você: {nf(p.m3, 3)} m³{p.mediaCondominio != null && <><br />Média: {nf(p.mediaCondominio, 3)} m³</>}</>),
            }))}
          />
        </section>
      )}
    </>
  );
}
