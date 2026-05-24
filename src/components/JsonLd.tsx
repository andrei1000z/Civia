import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/constants";

/**
 * Escape </script> sequences inside JSON-LD to prevent XSS breakout.
 * Also escapes < and > as unicode in strings.
 *
 * 2026-05-24 SECURITY FIX (audit P0.33): escapăm și U+2028 LINE SEPARATOR
 * + U+2029 PARAGRAPH SEPARATOR. Astea sunt valid JSON dar sparg JSON.parse
 * pe browsere vechi (Firefox <40, Safari <10) și pot fi folosite ca vector
 * pentru injection prin user content (sourceName, titlu, etc.).
 * Construim regex programatic ca să evităm caractere invizibile în sursă
 * (TS lexer le interpretează ca line breaks).
 */
const LS_RE = new RegExp(String.fromCharCode(0x2028), "g");
const PS_RE = new RegExp(String.fromCharCode(0x2029), "g");

function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LS_RE, "\\u2028")
    .replace(PS_RE, "\\u2029");
}

export function OrganizationJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    // Use the dynamic apple-icon route (180x180) as the Organization logo
    logo: `${SITE_URL}/apple-icon`,
    description: SITE_DESCRIPTION,
    address: {
      "@type": "PostalAddress",
      addressCountry: "RO",
    },
    areaServed: {
      "@type": "Country",
      name: "România",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}

export function WebsiteJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "ro-RO",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/sesizari?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}

export function NewsArticleJsonLd({
  headline,
  description,
  url,
  datePublished,
  dateModified,
  author,
  sourceName,
  sourceUrl,
  image,
}: {
  headline: string;
  description?: string;
  url: string;
  datePublished: string;
  /** When the article (or our cached/derived version) was last
   *  updated. Falls back to datePublished. */
  dateModified?: string;
  /** Original byline from the source, when known. Becomes a Person
   *  author. When absent, author defaults to the Civia organisation. */
  author?: string;
  /** Name of the originating publisher (e.g. "G4Media"). Used for
   *  attribution via `isBasedOn` / `provider` — Google understands we
   *  aggregated this from the source. The platform `publisher` is
   *  always Civia (the entity Google indexes us under). */
  sourceName?: string;
  /** Canonical URL on the source publisher's site. Used for
   *  `isBasedOn` so Google + readers can navigate back. */
  sourceUrl?: string;
  /** Article image — must be a high-resolution URL (Google News
   *  recommends ≥ 696px wide). */
  image?: string;
}) {
  // Logo MUST be a real PNG/JPG endpoint with explicit dimensions for
  // Google News rich results. /apple-touch-icon.png is 180×180, which
  // qualifies (Google's minimum is 60×60).
  const logoUrl = `${SITE_URL}/apple-touch-icon.png`;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    // Headline ≤ 110 chars per Google News guidelines.
    headline: headline.slice(0, 110),
    ...(description ? { description: description.slice(0, 300) } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    datePublished,
    dateModified: dateModified || datePublished,
    // Author: real byline when we have one (Person), else Civia
    // (Organization). Per Google News guidelines, Organization-only
    // authors are accepted for staff-bylined and aggregated content.
    author: author
      ? { "@type": "Person", name: author }
      : { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    // Publisher = Civia (the platform serving the page). Google
    // indexes the publisher field to attribute coverage to the
    // entity registered in Publisher Center.
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: logoUrl,
        width: 180,
        height: 180,
      },
    },
    ...(image
      ? {
          image: {
            "@type": "ImageObject",
            url: image,
          },
        }
      : {}),
    inLanguage: "ro-RO",
    isAccessibleForFree: true,
    // Plan AI #7 (5/22/2026) — speakable schema pentru voice search +
    // AI citations (Google Assistant, Alexa, ChatGPT/Perplexity preview).
    // CSS selectors target headline + first paragraph (TL;DR).
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "article p:first-of-type", ".ai-summary"],
    },
  };

  // Attribution back to the source publisher when present. Google +
  // readers can both follow this to find the original.
  if (sourceName) {
    schema.provider = {
      "@type": "Organization",
      name: sourceName,
      ...(sourceUrl ? { url: sourceUrl } : {}),
    };
  }
  if (sourceUrl) {
    schema.isBasedOn = sourceUrl;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}

/**
 * HowTo schema for /ghiduri/* — civic guide pages that walk users
 * through a concrete procedure (contest an amendă, register an NGO,
 * claim Legea 544/2001 data). Google uses this to power Featured
 * Snippets + the rich "step-by-step" cards on guide queries.
 */
export function HowToJsonLd({
  name,
  description,
  url,
  steps,
  totalTime,
  estimatedCost,
}: {
  name: string;
  description: string;
  url: string;
  steps: Array<{ name: string; text: string; url?: string }>;
  /** ISO 8601 duration, e.g. "PT30M" for 30 min, "PT2H" for 2h. */
  totalTime?: string;
  /** Plain-text cost, e.g. "0 lei" or "100 lei". */
  estimatedCost?: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description: description.slice(0, 280),
    inLanguage: "ro-RO",
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon` },
    },
    ...(totalTime ? { totalTime } : {}),
    ...(estimatedCost
      ? { estimatedCost: { "@type": "MonetaryAmount", currency: "RON", value: estimatedCost } }
      : {}),
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.url ? { url: s.url } : {}),
    })),
    // Plan AI #7 — speakable pentru voice + AI citations.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", ".howto-step-name", ".howto-step-text"],
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}

/**
 * GovernmentService schema — one per active sesizare. Tells search
 * engines this is a civic complaint with a formal recipient authority
 * and a specific problem type; eligible for structured sitelinks on
 * "sesizare {tip}" queries.
 */
export function GovernmentServiceJsonLd({
  code,
  titlu,
  tip,
  locatie,
  descriere,
  url,
  providerName,
  createdAt,
  status,
}: {
  code: string;
  titlu: string;
  tip: string;
  locatie: string;
  descriere?: string;
  url: string;
  providerName: string;
  createdAt: string;
  status: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: titlu.slice(0, 110),
    serviceType: `Sesizare civică — ${tip}`,
    description: (descriere || titlu).slice(0, 280),
    areaServed: { "@type": "AdministrativeArea", name: locatie },
    provider: { "@type": "GovernmentOrganization", name: providerName },
    url,
    identifier: code,
    inLanguage: "ro-RO",
    dateCreated: createdAt,
    additionalProperty: {
      "@type": "PropertyValue",
      name: "status",
      value: status,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}

/**
 * Petition schema — pentru /petitii/[slug]. Google nu are tip oficial
 * „Petition", deci folosim CreativeWork extended cu metadata civică
 * + schema.org/Action pentru semnare. (P2.604 — 2026-05-24)
 */
export function PetitionJsonLd({
  title,
  description,
  url,
  signatureCount,
  targetSignatures,
  createdAt,
  category,
  externalUrl,
}: {
  title: string;
  description: string;
  url: string;
  signatureCount?: number;
  targetSignatures?: number;
  createdAt: string;
  category?: string;
  externalUrl?: string;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": url,
    name: title,
    description: description.slice(0, 280),
    url,
    dateCreated: createdAt,
    inLanguage: "ro-RO",
    isAccessibleForFree: true,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    // Categorie civică (educatie, sanatate, mediu, etc.)
    ...(category ? { genre: category } : {}),
    // Sursa externă (Declic, Avaaz, etc.) când e cazul
    ...(externalUrl ? { isBasedOn: externalUrl } : {}),
    // Action — schema.org pattern pentru „signable" content
    potentialAction: {
      "@type": "EndorseAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: url,
        actionPlatform: ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"],
      },
      ...(signatureCount !== undefined ? { agent: { "@type": "AggregateRating", ratingCount: signatureCount } } : {}),
    },
    // Speakable pentru AI/voice
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", ".petitie-summary"],
    },
  };

  // InteractionStatistic pentru signature count (Google indexes acest pattern)
  if (signatureCount !== undefined) {
    schema.interactionStatistic = {
      "@type": "InteractionCounter",
      interactionType: { "@type": "EndorseAction" },
      userInteractionCount: signatureCount,
    };
  }

  // Goal/target ca metric vizibil
  if (targetSignatures !== undefined) {
    schema.contentReferenceTime = createdAt; // workaround — nu există „goal" în schema.org
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}

/**
 * ItemList for collection pages — sesizări publice, știri feed, întreruperi
 * active. Google can use this to render "List of N items" snippets.
 */
export function ItemListJsonLd({
  name,
  description,
  url,
  items,
}: {
  name: string;
  description?: string;
  url: string;
  items: Array<{ name: string; url: string; position?: number }>;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    ...(description ? { description: description.slice(0, 300) } : {}),
    url,
    numberOfItems: items.length,
    inLanguage: "ro-RO",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: it.position ?? i + 1,
      name: it.name,
      url: it.url.startsWith("http") ? it.url : `${SITE_URL}${it.url}`,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}

/**
 * CollectionPage wrapper — typically combined with ItemListJsonLd.
 * Tells search engines „this URL is a curated collection".
 */
export function CollectionPageJsonLd({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description: description.slice(0, 300),
    url,
    inLanguage: "ro-RO",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}

/**
 * GovernmentOrganization — pentru pagina /autoritati care indexează
 * primării + Poliții Locale. Google clasifică pagina ca civic catalog.
 */
export function GovernmentOrganizationJsonLd({
  name,
  description,
  url,
  areaServed,
}: {
  name: string;
  description: string;
  url: string;
  areaServed?: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "GovernmentOrganization",
    name,
    description: description.slice(0, 300),
    url,
    inLanguage: "ro-RO",
    ...(areaServed
      ? { areaServed: { "@type": "Country", name: areaServed } }
      : { areaServed: { "@type": "Country", name: "România" } }),
    parentOrganization: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}

/**
 * Event schema for /evenimente/[slug] — historical civic events
 * (Colectiv, Rahova explosion, elections) surface in Google's "historical
 * event" panel and rich search results.
 */
export function HistoricalEventJsonLd({
  name,
  description,
  startDate,
  endDate,
  url,
  location,
  image,
}: {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  url: string;
  location?: string;
  image?: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name,
    description: description.slice(0, 300),
    startDate,
    ...(endDate ? { endDate } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "ro-RO",
    organizer: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    ...(location
      ? { location: { "@type": "Place", name: location, address: { "@type": "PostalAddress", addressCountry: "RO" } } }
      : {}),
    ...(image ? { image: [image] } : {}),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}

/**
 * County page schema — Place + AdministrativeArea + LocalGovernment.
 * Pentru paginile /[judet] (homepage per judet). Ofera context Google ca
 * pagina e un dashboard civic pentru jurisdictia respectiva, nu doar
 * un articol generic. Cresc Sitelinks shot pe query-uri tip „sesizari Cluj".
 */
export function CountyPlaceJsonLd({
  countyName,
  countySlug,
  countyId,
  description,
  population,
  url,
  primarName,
  primarUrl,
}: {
  countyName: string;
  countySlug: string;
  countyId: string;
  description: string;
  population?: number;
  url: string;
  primarName?: string;
  primarUrl?: string;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "AdministrativeArea",
    name: countyName,
    description: description.slice(0, 300),
    url,
    identifier: countyId,
    alternateName: countySlug.toUpperCase(),
    addressCountry: "RO",
    inLanguage: "ro-RO",
  };
  if (population && population > 0) schema.populationSize = population;
  if (primarName) {
    schema.subOrganization = {
      "@type": "GovernmentOrganization",
      name: `Primăria ${countyName}`,
      ...(primarUrl ? { url: primarUrl } : {}),
      employee: { "@type": "Person", name: primarName, jobTitle: "Primar" },
    };
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}
