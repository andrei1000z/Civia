/**
 * Generator pentru plângerea către Avocatul Poporului (AVP).
 *
 * Conform OG 27/2002 art. 8 alin. (1): primăria are 30 zile termen legal
 * + extensie 15 zile = 45 zile MAX. La 60+ zile fără răspuns, cetățeanul
 * are dreptul să se plângă la AVP că instituția nu a respectat termenul.
 *
 * Adresa AVP: avp@avp.ro (Avocatul Poporului — site avp.ro)
 *
 * Template-ul e DETERMINIST, fără AI — referință legală exactă. User-ul
 * apasă „Trimite la AVP" → trimitem din contul lui via Resend (Reply-To
 * = email-ul lui ca AVP să răspundă direct la cetățean).
 */

import { formatDateRo } from "./formal-template";

export interface AvpEscalationArgs {
  /** Codul sesizării (ex: „00047") — apare în subject + body. */
  code: string;
  /** Titlul sesizării. */
  titlu: string;
  /** Locația problemei (din DB, sanitized). */
  locatie: string;
  /** Numele cetățeanului. Apare în semnătură. */
  nume: string;
  /** Adresa cetățeanului. Apare în corpul plângerii ca date contact. */
  adresa?: string | null;
  /** Email pentru contact returnabil de AVP. */
  email: string;
  /** Data depunerii inițiale a sesizării (created_at), folosit pentru
   *  calculul termenului legal expirat. */
  createdAt: Date;
  /** Lista emailurilor către care a fost trimisă sesizarea inițial. */
  destinatari: string[];
  /** Data la care s-a marcat „ignorat" (azi, dacă e proaspăt). */
  ignoredAt?: Date;
}

export interface AvpPlangereResult {
  subject: string;
  body: string;
  to: string;
  replyTo: string;
}

const AVP_EMAIL = "avp@avp.ro";

export function buildAvpPlangere(args: AvpEscalationArgs): AvpPlangereResult {
  const ignoredAt = args.ignoredAt ?? new Date();
  const zileTrecute = Math.floor(
    (ignoredAt.getTime() - args.createdAt.getTime()) / (24 * 60 * 60 * 1000),
  );
  const dataDepunere = formatDateRo(args.createdAt);
  const dataAzi = formatDateRo(ignoredAt);

  const destinatariFormatted = args.destinatari.length > 0
    ? args.destinatari.map((d) => `   • ${d}`).join("\n")
    : "   • (nu am date despre destinatari)";

  const adresaInfo = args.adresa
    ? `Mă numesc ${args.nume}, domiciliat în ${args.adresa}, contactabil la adresa de email ${args.email}.`
    : `Mă numesc ${args.nume}, contactabil la adresa de email ${args.email}.`;

  const subject = `Plângere — instituție publică nu a respectat termenul OG 27/2002 (Sesizare ${args.code})`;

  const body = [
    `Stimată doamnă / Stimate domnule Avocat al Poporului,`,
    ``,
    adresaInfo,
    ``,
    `Mă adresez instituției Avocatului Poporului pentru a sesiza încălcarea art. 8 alin. (1) din Ordonanța Guvernului nr. 27/2002 privind reglementarea activității de soluționare a petițiilor, de către autoritățile publice către care am depus, la data de ${dataDepunere}, sesizarea cu codul Civia ${args.code}.`,
    ``,
    `OBIECTUL SESIZĂRII INIȚIALE`,
    `Titlu: „${args.titlu}".`,
    `Locație: ${args.locatie}.`,
    ``,
    `INSTITUȚII NOTIFICATE INIȚIAL`,
    `Sesizarea a fost transmisă prin platforma civia.ro la următoarele adrese de email oficiale:`,
    destinatariFormatted,
    ``,
    `TEMEIUL JURIDIC ÎNCĂLCAT`,
    `Conform art. 8 alin. (1) din OG 27/2002, autoritățile și instituțiile publice sunt obligate să comunice petentului, în termen de 30 de zile de la data înregistrării petiției, răspunsul, indiferent dacă soluția este favorabilă sau nefavorabilă. Termenul poate fi prelungit cu cel mult 15 zile, cu notificarea prealabilă a petentului (art. 9). Nerespectarea termenelor constituie abatere disciplinară (art. 15).`,
    ``,
    `SITUAȚIA DE FAPT`,
    `De la data depunerii (${dataDepunere}) și până la data prezentei plângeri (${dataAzi}) au trecut ${zileTrecute} de zile calendaristice. Nu am primit niciun răspuns oficial, niciun număr de înregistrare și nicio notificare de prelungire a termenului din partea autorităților menționate mai sus.`,
    ``,
    `SOLICITARE`,
    `Vă solicit respectuos:`,
    `1. Să dispuneți verificarea modului în care au fost soluționate petițiile la nivelul instituțiilor menționate.`,
    `2. Să comunicați autorităților vizate obligația de a răspunde la sesizare conform termenului legal.`,
    `3. Să luați măsurile prevăzute de Legea 35/1997 privind organizarea și funcționarea instituției Avocatului Poporului, inclusiv recomandări către autoritățile vizate.`,
    `4. Să îmi comunicați rezultatul demersurilor instituției dumneavoastră.`,
    ``,
    `Anexez codul Civia ${args.code} ca referință pentru documentația electronică a sesizării (disponibilă public la https://civia.ro/sesizari/${args.code}).`,
    ``,
    `Vă mulțumesc anticipat pentru atenția acordată și pentru sprijinul instituției pe care o reprezentați.`,
    ``,
    `Cu deosebită stimă,`,
    args.nume,
    dataAzi,
  ].join("\n");

  return {
    subject,
    body,
    to: AVP_EMAIL,
    replyTo: args.email,
  };
}
