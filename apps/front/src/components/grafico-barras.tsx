"use client";

import { useEffect, useRef, useState } from "react";

import { nf } from "@/lib/formato";

export interface Barra {
  valor: number;
  rotulo?: string;
  destaque?: boolean;
  parcial?: boolean;
  dica: React.ReactNode;
}

/** Eixo com 4 passos "redondos" e casas decimais suficientes para o passo. */
function escala(v: number) {
  const bruto = v > 0 ? v / 4 : 0.25;
  const e = Math.pow(10, Math.floor(Math.log10(bruto)));
  const f = bruto / e;
  const passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  let dec = 0;
  while (dec < 4 && Math.abs(Math.round(passo * 10 ** dec) - passo * 10 ** dec) > 1e-9) dec++;
  return { max: passo * 4, dec };
}

/** Barras com linha tracejada de referência (média do condomínio) e dica ao passar o mouse. */
export function GraficoBarras({ dados, referencia, rotulo, altura = 220 }: { dados: Barra[]; referencia?: (number | null)[]; rotulo: string; altura?: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  const [ativo, setAtivo] = useState<number | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLargura(Math.max(280, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = largura, H = altura, m = { l: 46, r: 12, t: 14, b: 26 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const refMax = referencia ? Math.max(0, ...referencia.filter((v): v is number => v != null)) : 0;
  const { max, dec } = escala(Math.max(0, ...dados.map((d) => d.valor), refMax) * 1.05);
  const y = (v: number) => m.t + ph - (v / max) * ph;
  const slot = pw / Math.max(1, dados.length);
  const gap = Math.min(4, Math.max(2, slot * 0.2)), bw = Math.max(1, slot - gap), rr = Math.min(4, bw / 2);

  let caminhoRef = "";
  if (referencia) {
    let caneta = false;
    referencia.forEach((v, i) => {
      if (v == null) { caneta = false; return; }
      caminhoRef += `${caneta ? "L" : "M"}${m.l + i * slot + 1},${y(v)} L${m.l + (i + 1) * slot - 1},${y(v)} `;
      caneta = true;
    });
  }

  const dica = ativo != null ? dados[ativo] : null;
  const xDica = ativo != null ? Math.min(Math.max(m.l + (ativo + 0.5) * slot, 70), W - 70) : 0;
  const yDica = ativo != null ? Math.min(y(dados[ativo].valor), y(referencia?.[ativo] ?? 0)) - 8 : 0;

  return (
    <div className={`chart${ativo != null ? " hovering" : ""}`} ref={caixa} onMouseLeave={() => setAtivo(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} height={H} role="img" aria-label={rotulo}>
        {[0, 1, 2, 3, 4].map((k) => {
          const v = (max * k) / 4;
          return (
            <g key={k}>
              <line className="grid" x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} />
              <text className="axis" x={m.l - 8} y={y(v) + 4} textAnchor="end">{nf(v, dec)}</text>
            </g>
          );
        })}
        {dados.map((d, i) => {
          const x = m.l + i * slot + gap / 2, topo = y(d.valor), h = m.t + ph - topo;
          const r = Math.min(rr, h);
          return (
            <g key={i}>
              {h > 0.5 && (
                <path
                  className={`bar${d.destaque ? " flag" : ""}${d.parcial ? " partial" : ""}${ativo === i ? " on" : ""}`}
                  d={`M${x},${m.t + ph} V${topo + r} Q${x},${topo} ${x + r},${topo} H${x + bw - r} Q${x + bw},${topo} ${x + bw},${topo + r} V${m.t + ph} Z`}
                />
              )}
              {d.rotulo && <text className="axis" x={x + bw / 2} y={H - 6} textAnchor="middle">{d.rotulo}</text>}
            </g>
          );
        })}
        {caminhoRef && <path className="ref" d={caminhoRef} />}
        {dados.map((_, i) => (
          <rect key={i} className="hit" x={m.l + i * slot} y={m.t} width={slot} height={ph} onMouseEnter={() => setAtivo(i)} onTouchStart={() => setAtivo(i)} />
        ))}
      </svg>
      {dica && (
        <div className="tip" style={{ left: xDica * ((caixa.current?.clientWidth ?? W) / W), top: yDica * ((caixa.current?.clientWidth ?? W) / W) }}>
          {dica.dica}
        </div>
      )}
    </div>
  );
}
