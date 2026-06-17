import { describe, it, expect } from "vitest";
import { classifyReply } from "./classify";

/**
 * Cazuri din răspunsuri REALE de la autoritățile bucureștene (iunie 2026):
 * verifică că pre-clasificatorul determinist alege statusul PRECIS din paleta
 * Civia, nu generic „in-lucru". Toate trebuie să nu atingă AI (source=deterministic).
 */
describe("classifyReply — statusuri precise din răspunsuri reale", () => {
  it("Poliția Locală: Note de Constatare + procese-verbale → actiune-autoritate", async () => {
    const r = await classifyReply({
      subject: "răspuns sesizări",
      body: "Polițiștii locali din cadrul Serviciului Circulație Rutieră au efectuat verificări în zona mai sus menționată, context în care au fost depistate autovehicule staționate neregulamentar, fiind aplicate atât Note de Constatare în vederea sancționării ulterioare a conducătorilor auto, cât și procese-verbale de sancționare a contravenienților.",
      trusted_sender: true,
    });
    expect(r.status).toBe("actiune-autoritate");
    expect(r.source).toBe("deterministic");
  });

  it("Poliția Locală S5: au aplicat înștiințări vehiculelor → actiune-autoritate", async () => {
    const r = await classifyReply({
      subject: "MUSAT EDUARD - 80884",
      body: "polițiștii locali din cadrul Serviciului Circulație au întreprins verificări pe Calea 13 Septembrie nr. 104-120 și au aplicat înștiințări vehiculelor depistate oprite/staționate neregulamentar.",
      trusted_sender: true,
    });
    expect(r.status).toBe("actiune-autoritate");
  });

  it("Adm. Străzilor: materializați în funcție de bugetul alocat → amanata", async () => {
    const r = await classifyReply({
      subject: "Adresa nr 14071",
      body: "Administrația Străzilor urmează să demareze lucrări de securizare a trotuarelor în Sector 2, Lot 2, care vor cuprinde și montarea de stâlpișori antiparcare. Aceștia vor fi materializați în teren în funcție de bugetul alocat pentru anul 2026.",
      trusted_sender: true,
    });
    expect(r.status).toBe("amanata");
  });

  it("Adm. Străzilor: nu vă putem oferi un termen estimativ → amanata", async () => {
    const r = await classifyReply({
      subject: "16124 Vasile Lascar",
      body: "Având în vedere numărul foarte mare de solicitări venite din partea cetățenilor, acestea sunt analizate și materializate în funcție de gradul de risc. Urmare celor menționate mai sus nu vă putem oferi un termen estimativ pentru implementarea în teren.",
      trusted_sender: true,
    });
    expect(r.status).toBe("amanata");
  });

  it("Adm. Străzilor: după finalizarea modernizării → amanata", async () => {
    const r = await classifyReply({
      subject: "16450 Morarilor",
      body: "Deoarece pe Bd. Basarabia se află în derulare lucrări de modernizare a infrastructurii de transport public, eventualele măsuri suplimentare vor fi analizate și implementate ulterior finalizării lucrărilor de modernizare.",
      trusted_sender: true,
    });
    expect(r.status).toBe("amanata");
  });

  it("PMB: a fost transmisă la Primăria Sectorului 2 → redirectionata", async () => {
    const r = await classifyReply({
      subject: "PMB 75827",
      body: "Referitor la petiția dumneavoastră înregistrată la Primăria Municipiului București, vă informăm că, potrivit O.G. nr. 27/2002, aceasta a fost transmisă la Primăria Sectorului 2, care are competența legală de soluționare.",
      trusted_sender: true,
    });
    expect(r.status).toBe("redirectionata");
  });

  it("stâlpișorii au fost montați → interventie", async () => {
    const r = await classifyReply({
      subject: "actualizare",
      body: "Vă comunicăm că stâlpișorii de protecție au fost montați pe trotuarul indicat în sesizarea dumneavoastră.",
      trusted_sender: true,
    });
    expect(r.status).toBe("interventie");
  });

  it("DISTINCȚIE: 'solicităm aplicarea sancțiunilor' (cerere viitoare) NU e actiune-autoritate, ci amanata", async () => {
    const r = await classifyReply({
      subject: "16124",
      body: "Instituția noastră urmează să demareze proiectul în cadrul unui contract. Până la montarea stâlpișorilor antiparcare, solicităm sprijinul Poliției Locale Sector 2 pentru aplicarea sancțiunilor conform legislației în vigoare.",
      trusted_sender: true,
    });
    // verbul e la viitor + 'în cadrul unui contract' → amanata, nu actiune-autoritate
    expect(r.status).toBe("amanata");
  });
});
