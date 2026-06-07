import { describe, it, expect } from "vitest";
import { classifyReply } from "./classify";

// Testează pre-classifier-ul DETERMINIST (fără AI): acțiunile autorității care
// NU înseamnă rezolvare. Bug real (00007): „Note de Constatare. Se vor demara
// lucrări" era clasificat „rezolvat" — corect e „in-lucru".
describe("classifyReply — acțiune autoritate ≠ rezolvat (determinist)", () => {
  it("Note de Constatare + se vor demara lucrări → in-lucru, NU rezolvat", async () => {
    const r = await classifyReply({
      subject: "raspuns sesizare",
      body: "Politia Locala a confirmat neregulile semnalate si a aplicat Note de Constatare. Se vor demara lucrari de reparatii si semnalizare.",
    });
    expect(r.status).toBe("in-lucru");
  });

  it("sancțiuni/amenzi aplicate → in-lucru", async () => {
    const r = await classifyReply({
      subject: "raspuns",
      body: "Ca urmare a sesizarii, echipele s-au deplasat si au aplicat sanctiuni contraventionale.",
    });
    expect(r.status).toBe("in-lucru");
  });

  it("lucrare efectiv finalizată → rezolvat (rămâne corect)", async () => {
    const r = await classifyReply({
      subject: "raspuns",
      body: "Va comunicam ca lucrarea a fost finalizata, iar problema semnalata a fost remediata.",
    });
    expect(r.status).toBe("rezolvat");
  });
});
