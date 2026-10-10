import { describe, expect, it } from "vitest";

import { FonteSimulada } from "./fonte-simulada";

const ancora = new Date("2026-10-10T03:00:00Z");
const fonte = new FonteSimulada({ ancora, mudos: ["MUDO"], vazamento: ["VAZA"], consumoAlto: [], bateriaBaixa: ["BAT"] });
const H = 3_600_000;

describe("FonteSimulada", () => {
  it("é determinística: a mesma consulta devolve as mesmas leituras", async () => {
    const a = await fonte.buscarLeituras("SIM-1", new Date(ancora.getTime() - 48 * H), ancora);
    const b = await fonte.buscarLeituras("SIM-1", new Date(ancora.getTime() - 48 * H), ancora);
    expect(a).toEqual(b);
  });

  it("entrega leituras acumuladas, de hora em hora, que nunca diminuem", async () => {
    const { leituras } = await fonte.buscarLeituras("SIM-1", new Date(ancora.getTime() - 72 * H), ancora);
    expect(leituras.length).toBeGreaterThan(40);
    for (let i = 1; i < leituras.length; i++) {
      expect(leituras[i].instante.getTime() - leituras[i - 1].instante.getTime()).toBe(H);
      expect(leituras[i].valorM3).toBeGreaterThanOrEqual(leituras[i - 1].valorM3);
    }
  });

  it("só entrega o que já foi transmitido (uma vez por dia)", async () => {
    const { leituras, transmitidoEm } = await fonte.buscarLeituras("SIM-1", new Date(ancora.getTime() - 72 * H), ancora);
    expect(transmitidoEm!.getTime()).toBeLessThanOrEqual(ancora.getTime());
    expect(leituras.at(-1)!.instante.getTime()).toBe(transmitidoEm!.getTime());
  });

  it("medidor mudo para de transmitir 3 dias antes da âncora", async () => {
    const { transmitidoEm } = await fonte.buscarLeituras("MUDO", new Date(ancora.getTime() - 240 * H), ancora);
    expect(transmitidoEm!.getTime()).toBeLessThanOrEqual(ancora.getTime() - 72 * H);
  });

  it("o vazamento simulado gera consumo em todas as horas da madrugada", () => {
    const dia = ancora.getTime() - 8 * 24 * H;
    for (let h = 1; h < 9; h++) expect(fonte.consumoNaHora("VAZA", dia + h * H)).toBeGreaterThan(0.01);
  });

  it("informa bateria baixa no cenário", async () => {
    expect((await fonte.buscarLeituras("BAT", ancora, ancora)).bateriaV).toBe(3.31);
  });
});
