import { AUTH } from "@/lib/sesizari/authorities";

// AUTH-ul are forma { id, name, email, phone? } pe fiecare entry. Tipul
// `AuthorityContact` din /data/autoritati-contact.ts e diferit (doar
// phone/email/website/address) — n-ar fi corect aici. Folosim o
// declarație inline pentru tipul AUTH entries.
type AuthEntry = { id: string; name: string; email?: string; phone?: string };

/**
 * Identify which authority sent the reply email.
 *
 * Strategie:
 *   1. Match exact pe email-ul From: vs lista AUTH (cel mai precis)
 *   2. Match pe domeniul From: vs domeniile cunoscute (mai larg)
 *   3. Anti-spoof check: marchează ca "trusted" doar dacă domeniul
 *      e dintr-o listă albă de TLD-uri guvernamentale RO.
 *
 * Used by:
 *   - /api/inbox/reply: salvăm authority_id în sesizare_replies
 *   - AI classifier: contextul "cine a răspuns" îmbunătățește
 *     clasificarea (ex: dacă a răspuns prefectura, e probabil
 *     redirectionare)
 */

export interface SenderIdentity {
  email: string;
  authority_id: string | null;
  authority_name: string | null;
  trusted: boolean;
  domain: string;
}

/**
 * Domenii guvernamentale RO din care marchez automat ca "trusted".
 * Ăsta e un whitelist conservator — autoritatea trebuie să fie pe un
 * domeniu .gov.ro / .ro institutional. Spam-erii care folosesc Gmail
 * să facă spoof la primării NU trec testul.
 */
const TRUSTED_DOMAIN_PATTERNS: RegExp[] = [
  /\.gov\.ro$/i,
  /\.gov$/i,
  /^primaria\d*\.ro$/i,
  /^.*\.primarie\.ro$/i,
  /pmb\.ro$/i,
  /sector[1-6]\.ro$/i,
  /politiaromana\.ro$/i,
  /b\.politiaromana\.ro$/i,
  /jandarmeriaromana\.ro$/i,
  /prefectur[ăa]?[a-z]*\.ro$/i,
  /\.prefectur[ăa]?[a-z]*\.ro$/i,
  /apanovabucuresti\.ro$/i,
  /aspmb\.ro$/i,
  /alpab\.ro$/i,
  /stbsa\.ro$/i,
  /^plmb\.ro$/i,
  /cnair\.ro$/i,
  /enel\.ro$/i,
  /eon\.ro$/i,
  /electricacf?\.ro$/i,
  /termoenergetica\.ro$/i,
  /salubris\.ro$/i,
  /sallubritate.*\.ro$/i,
  /retim\.ro$/i,
  /supercom\.ro$/i,
  /avp\.ro$/i, // Avocatul Poporului
];

/**
 * Identify the sender from a `From:` header.
 *
 * Input examples:
 *   "Brigada Rutieră <bpr@b.politiaromana.ro>"
 *   "<office@aspmb.ro>"
 *   "primarie.sector5@sector5.ro"
 *   "Bogdan Pop <bogdanp@gmail.com>" (NOT trusted — personal Gmail)
 */
export function identifySender(fromHeader: string): SenderIdentity | null {
  if (!fromHeader) return null;

  // Extract email — supports both "Name <email@x>" and bare "email@x"
  const emailMatch = fromHeader.match(/<([^>]+@[^>]+)>|([^\s<>]+@[^\s<>]+)/);
  const email = (emailMatch?.[1] ?? emailMatch?.[2] ?? "").toLowerCase().trim();
  if (!email || !email.includes("@")) return null;

  const domain = email.split("@")[1] ?? "";

  // 1. Exact email match in AUTH catalog
  for (const [id, auth] of Object.entries(AUTH)) {
    if ((auth as AuthEntry).email?.toLowerCase() === email) {
      return {
        email,
        authority_id: id,
        authority_name: (auth as AuthEntry).name,
        trusted: true,
        domain,
      };
    }
  }

  // 2. Domain match — e.g., reply comes from a different mailbox
  // (admin@sector5.ro instead of relatiipublice@sector5.ro) but the
  // domain is still recognized.
  for (const [id, auth] of Object.entries(AUTH)) {
    const authDomain = (auth as AuthEntry).email?.split("@")[1]?.toLowerCase();
    if (authDomain && authDomain === domain) {
      return {
        email,
        authority_id: id,
        authority_name: (auth as AuthEntry).name,
        trusted: true,
        domain,
      };
    }
  }

  // 3. Domain isn't in AUTH but matches a trusted RO gov pattern.
  // We don't know which authority but we know it's legit.
  const trusted = TRUSTED_DOMAIN_PATTERNS.some((re) => re.test(domain));
  if (trusted) {
    return {
      email,
      authority_id: null,
      authority_name: prettyAuthorityFromDomain(domain),
      trusted: true,
      domain,
    };
  }

  // 4. Unknown sender — return identity with trusted=false.
  return {
    email,
    authority_id: null,
    authority_name: null,
    trusted: false,
    domain,
  };
}

/**
 * Best-effort human name from a domain when AUTH catalog doesn't have
 * an exact match. Example: "primaria-arad.ro" → "Primăria Arad".
 */
function prettyAuthorityFromDomain(domain: string): string {
  if (/pmb\.ro$/i.test(domain)) return "Primăria Municipiului București";
  if (/sector1\.ro$/i.test(domain)) return "Primăria Sector 1";
  if (/sector2\.ro$/i.test(domain)) return "Primăria Sector 2";
  if (/sector3\.ro$/i.test(domain)) return "Primăria Sector 3";
  if (/sector4\.ro$/i.test(domain)) return "Primăria Sector 4";
  if (/sector5\.ro$/i.test(domain)) return "Primăria Sector 5";
  if (/sector6\.ro$/i.test(domain)) return "Primăria Sector 6";
  if (/politiaromana\.ro$/i.test(domain)) return "Poliția Română";
  if (/prefectur/i.test(domain)) return "Prefectura";
  if (/cnair\.ro$/i.test(domain)) return "CNAIR";
  if (/apanovabucuresti\.ro$/i.test(domain)) return "ApaNova";
  return domain;
}
