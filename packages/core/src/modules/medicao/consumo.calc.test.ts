import { describe, expect, it } from "vitest";

import { derivarConsumo } from "./consumo.calc";

const t = (h: number) => new Date(Date.UTC(2026, 9, 1, h));

describe("derivarConsumo (RN-100/102)", () => {
  it("atribui a diferença à hora que termina na leitura", () => {
    const r = derivarConsumo([
      { instante: t(1), valorM3: 100 },
      { instante: t(2), valorM3: 100.012 },
      { instante: t(3), valorM3: 100.02 },
    ]);
    expect(r.consumos).toEqual([
      { hora: t(1), m3: 0.012 },
      { hora: t(2), m3: 0.008 },
    ]);
    expect(r.anomalas).toEqual([]);
  });

  it("usa a leitura anterior ao lote como base", () => {
    const r = derivarConsumo([{ instante: t(5), valorM3: 50.5 }], { instante: t(4), valorM3: 50.25 });
    expect(r.consumos).toEqual([{ hora: t(4), m3: 0.25 }]);
  });

  it("não perde consumo num buraco de leituras: aparece inteiro na hora seguinte", () => {
    const r = derivarConsumo([
      { instante: t(1), valorM3: 10 },
      { instante: t(4), valorM3: 10.3 },
    ]);
    expect(r.consumos).toEqual([{ hora: t(3), m3: 0.3 }]);
  });

  it("leitura menor que a anterior é anômala, não gera consumo negativo e vira a nova base", () => {
    const r = derivarConsumo([
      { instante: t(1), valorM3: 500 },
      { instante: t(2), valorM3: 0.002 },
      { instante: t(3), valorM3: 0.01 },
    ]);
    expect(r.anomalas).toEqual([t(2)]);
    expect(r.consumos).toEqual([
      { hora: t(1), m3: 0 },
      { hora: t(2), m3: 0.008 },
    ]);
  });
});
