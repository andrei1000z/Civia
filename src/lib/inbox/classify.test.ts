import { describe, it, expect } from "vitest";
import { classifyReply } from "./classify";

// Testează pre-classifier-ul DETERMINIST (fără AI): acțiunile autorității care
// NU înseamnă rezolvare. Bug real (00007): „Note de Constatare. Se vor demara
// lucrări" era clasificat „rezolvat" — corect NU e rezolvat.
// 6/17 — upgrade: acțiunea poliției (Note de Constatare / sancțiuni) primește
// acum statusul PRECIS „actiune-autoritate" (înainte generic „in-lucru"). Tot
// ≠ rezolvat — intenția testului e păstrată.
describe("classifyReply — acțiune autoritate ≠ rezolvat (determinist)", () => {
  it("Note de Constatare + se vor demara lucrări → actiune-autoritate, NU rezolvat", async () => {
    const r = await classifyReply({
      subject: "raspuns sesizare",
      body: "Politia Locala a confirmat neregulile semnalate si a aplicat Note de Constatare. Se vor demara lucrari de reparatii si semnalizare.",
    });
    expect(r.status).toBe("actiune-autoritate");
    expect(r.status).not.toBe("rezolvat");
  });

  it("sancțiuni/amenzi aplicate → actiune-autoritate", async () => {
    const r = await classifyReply({
      subject: "raspuns",
      body: "Ca urmare a sesizarii, echipele s-au deplasat si au aplicat sanctiuni contraventionale.",
    });
    expect(r.status).toBe("actiune-autoritate");
  });

  it("lucrare efectiv finalizată → rezolvat (rămâne corect)", async () => {
    const r = await classifyReply({
      subject: "raspuns",
      body: "Va comunicam ca lucrarea a fost finalizata, iar problema semnalata a fost remediata.",
    });
    expect(r.status).toBe("rezolvat");
  });
});
