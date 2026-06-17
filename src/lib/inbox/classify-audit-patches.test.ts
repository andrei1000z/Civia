import { describe, it, expect } from "vitest";
import { classifyReply } from "./classify";

/**
 * 6/17/2026 — Hardening clasificator din auditul adversarial (workflow
 * inbox-classifier-audit, corpus de 86 răspunsuri reale RO). Fiecare caz
 * pozitiv trebuie să atingă pre-clasificatorul DETERMINIST (source=deterministic),
 * fără AI. Gărzile de false-positive sunt construite să aterizeze pe un ALT status
 * determinist, ca testul să rămână rapid și ne-flaky.
 */
const t = (body: string, subject = "raspuns autoritate") =>
  classifyReply({ subject, body, trusted_sender: true });

describe("audit — REDIRECȚIONATĂ (formule OG 27/2002)", () => {
  it("declinăm competența → redirectionata", async () => {
    const r = await t("în temeiul art. 6^1 din OG 27/2002 declinăm competența și redirecționăm prezenta către Administrația Bazinală de Apă Argeș-Vedea");
    expect(r.status).toBe("redirectionata");
    expect(r.source).toBe("deterministic");
  });
  it("vă transmitem spre soluționare (caz real #58356) → redirectionata", async () => {
    const r = await t("vă transmitem spre soluționare petițiile înregistrate la Direcția Generală de Poliție Locală cu numerele 45457 și 50217, întrucât competența de autorizare revine Primăriei Sectorului 1");
    expect(r.status).toBe("redirectionata");
    expect(r.source).toBe("deterministic");
  });
  it("a fost înaintată Primăriei → redirectionata", async () => {
    const r = await t("soluționarea excedează atribuțiilor Prefecturii Județului Cluj. petiția a fost înaintată Primăriei Municipiului Cluj-Napoca, pentru analiză");
    expect(r.status).toBe("redirectionata");
  });
  it("adresați Companiei (dativ) → redirectionata", async () => {
    const r = await t("nu intra in competenta Primariei Municipiului Bucuresti. Va rugam sa va adresati Companiei Nationale de Administrare a Infrastructurii Rutiere");
    expect(r.status).toBe("redirectionata");
  });
  it("vă invităm să vă adresați acestei structuri → redirectionata", async () => {
    const r = await t("este de competența Poliției Locale a Sectorului 6, motiv pentru care vă invităm să vă adresați acestei structuri, căreia i-am remis o copie");
    expect(r.status).toBe("redirectionata");
  });
});

describe("audit — CERERE INFORMAȚII", () => {
  it("precizați data aproximativă a constatării → cerere_informatii", async () => {
    const r = await t("precizați va rugam si data aproximativa a constatarii, pentru a putea demara verificarile.");
    expect(r.status).toBe("cerere_informatii");
  });
});

describe("audit — REZOLVAT (confirmari fara cuvintele remediat/finalizat)", () => {
  it("problema semnalată nu mai există → rezolvat", async () => {
    const r = await t("vegetatia care obtura vizibilitatea a fost toaletata. Problema semnalata nu mai exista.");
    expect(r.status).toBe("rezolvat");
  });
  it("situația soluționată în fapt → rezolvat", async () => {
    const r = await t("lucrarile de remediere a santului colmatat au fost executate, situatia fiind solutionata in fapt.");
    expect(r.status).toBe("rezolvat");
  });
});

describe("audit — INTERVENȚIE", () => {
  it("stâlpișori cu cuvinte intercalate, montați la trecut → interventie", async () => {
    const r = await t("stalpisorii de delimitare solicitati au fost montati pe tronsonul indicat, pentru a impiedica parcarea");
    expect(r.status).toBe("interventie");
  });
  it("indicatorul a fost înlocuit cu unul nou → interventie", async () => {
    const r = await t("lucrarea a fost executata. indicatorul rutier deteriorat a fost inlocuit cu unul nou.");
    expect(r.status).toBe("interventie");
  });
  // GARDĂ: relaxarea {0,3} NU trebuie să prindă viitorul „vor fi montați".
  it("GARDĂ: stâlpișori care VOR FI montați (viitor) → NU interventie (e amanata)", async () => {
    const r = await t("stalpisorii antiparcare care vor fi montati in functie de bugetul alocat pentru anul 2026");
    expect(r.status).not.toBe("interventie");
    expect(r.status).toBe("amanata");
  });
});

describe("audit — AMÂNATĂ", () => {
  it("ulterior recepției lucrărilor → amanata", async () => {
    const r = await t("montarea elementelor de protectie va fi analizata si implementata ulterior receptiei lucrarilor de modernizare");
    expect(r.status).toBe("amanata");
  });
});

describe("audit — IN-LUCRU (viitor/pasiv) + capcana de ordine", () => {
  it("vor fi executate lucrări → in-lucru", async () => {
    const r = await t("Vor fi executate lucrari de plombare a gropilor identificate, cuprinse in programul operativ al lunii curente.");
    expect(r.status).toBe("in-lucru");
  });
  it("echipele se vor deplasa → in-lucru", async () => {
    const r = await t("am programat interventiile. echipele noastre se vor deplasa pentru remedierea aspectelor reclamate in zilele urmatoare.");
    expect(r.status).toBe("in-lucru");
  });
  // REGRESIE CHEIE: cerere VIITOARE de sancțiuni = in-lucru, NU actiune-autoritate.
  it("REGRESIE: vom solicita aplicarea sancțiunilor → in-lucru, NU actiune-autoritate", async () => {
    const r = await t("in baza referatului de constatare, vom solicita compartimentului de specialitate aplicarea sanctiunilor contraventionale ce se impun");
    expect(r.status).toBe("in-lucru");
    expect(r.status).not.toBe("actiune-autoritate");
  });
  // CONTROL: acțiunea poliției la TRECUT rămâne actiune-autoritate.
  it("CONTROL: au aplicat sancțiuni (trecut) → actiune-autoritate", async () => {
    const r = await t("politistii locali au aplicat sanctiuni contraventionale conducatorilor auto depistati stationati neregulamentar");
    expect(r.status).toBe("actiune-autoritate");
  });
});

describe("audit — RESPINS", () => {
  it("solutionata prin clasare → respins (desi solutionata pare rezolvat)", async () => {
    const r = await t("Petitia a fost solutionata prin clasare, intrucat aspectele reclamate nu se confirma, iar sanctionarea nu se justifica");
    expect(r.status).toBe("respins");
  });
});

describe("audit — ÎNREGISTRATĂ (forme neacoperite)", () => {
  it("recepționată și înregistrată → inregistrata", async () => {
    const r = await t("Sesizarea Dvs. a fost receptionata si inregistrata la registratura institutiei. Numar inregistrare: ADP-S2-2099/2026.");
    expect(r.status).toBe("inregistrata");
  });
  it("înregistrată cu succes (ticketing) → inregistrata", async () => {
    const r = await t("Sesizare inregistrata cu succes! Vei primi un e-mail de confirmare cu numarul de referinta.");
    expect(r.status).toBe("inregistrata");
  });
  it("vă transmitem numărul de înregistrare → inregistrata", async () => {
    const r = await t("Va transmitem alaturat numarul de inregistrare aferent sesizarii. Cu stima, Compartiment Relatii cu Publicul.");
    expect(r.status).toBe("inregistrata");
  });
  it("luată în evidență sub nr → inregistrata", async () => {
    const r = await t("adresa transmisa de dumneavoastra a fost luata in evidenta sub nr. 12.884/2026. Vom reveni in 30 de zile.");
    expect(r.status).toBe("inregistrata");
  });
  it("plural: au fost înregistrate sub numerele → inregistrata", async () => {
    const r = await t("Petitiile transmise de dumneavoastra au fost inregistrate sub numerele 21044 si 21045 din 11.06.2026.");
    expect(r.status).toBe("inregistrata");
  });
  it("laconic: Înregistrat. Nr. 90217 → inregistrata", async () => {
    const r = await t("Inregistrat. Nr. 90217. Va raspundem.");
    expect(r.status).toBe("inregistrata");
  });
});

describe("audit — GĂRZI false-positive (block order)", () => {
  it("înregistrare reală nu e furată de redirect → inregistrata", async () => {
    const r = await t("petitia dumneavoastra a fost inregistrata sub numarul 50828/10.06.2026");
    expect(r.status).toBe("inregistrata");
  });
  it("înaintată instituției noastre (intern) → NU redirectionata", async () => {
    // ținta „instituției" a fost scoasă din regex-ul de înaintare → intern ≠ redirect.
    const r = await t("petitia a fost inaintata conducerii institutiei noastre spre informare. Va vom raspunde in 30 de zile conform OG 27/2002.");
    expect(r.status).not.toBe("redirectionata");
  });
});
