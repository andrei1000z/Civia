interface Faq {
  question: string;
  answer: string;
}

function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function FaqJsonLd({ items }: { items: Faq[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
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
 * Schema.org Dataset — signals to Google that a page contains structured
 * statistical data, enabling Google Dataset Search indexing.
 * Use on /impact, /buget, /v1/stats, and other metric-heavy pages.
 */
export function DatasetJsonLd({
  name,
  description,
  url,
  keywords,
  lastUpdated,
  creator = "Civia",
  license = "https://creativecommons.org/licenses/by/4.0/",
}: {
  name: string;
  description: string;
  url: string;
  keywords?: string[];
  lastUpdated?: string; // ISO
  creator?: string;
  license?: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name,
    description,
    url,
    keywords: keywords?.join(", "),
    license,
    creator: {
      "@type": "Organization",
      name: creator,
      url: "https://civia.ro",
    },
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: "https://civia.ro/api/v1/stats",
    },
    dateModified: lastUpdated ?? new Date().toISOString().slice(0, 10),
    isAccessibleForFree: true,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}

/**
 * Schema.org Event — for calendar-civic entries. Rendered as an ItemList of
 * Event nodes so Google can surface them in rich results.
 */
export function EventListJsonLd({
  events,
}: {
  events: Array<{
    name: string;
    startDate: string;
    endDate?: string;
    description: string;
    url: string;
    location?: string;
  }>;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: events.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Event",
        name: e.name,
        description: e.description,
        startDate: e.startDate,
        endDate: e.endDate ?? e.startDate,
        url: e.url,
        eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        location: e.location
          ? {
              "@type": "Place",
              name: e.location,
              address: { "@type": "PostalAddress", addressCountry: "RO" },
            }
          : {
              "@type": "VirtualLocation",
              url: "https://civia.ro",
            },
        organizer: {
          "@type": "Organization",
          name: "Civia",
          url: "https://civia.ro",
        },
      },
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
 * Schema.org DefinedTermSet — for glossary pages with civic vocabulary.
 * Each term has slug-based @id so AI grounding (ChatGPT/Perplexity) can
 * cite a specific term. Search engines may surface DefinedTerm entries
 * in „Knowledge Panel" sidebar.
 */
export function DefinedTermSetJsonLd({
  name,
  description,
  url,
  terms,
}: {
  name: string;
  description: string;
  url: string;
  terms: Array<{
    slug: string;
    termen: string;
    definitie: string;
    temeiLegal?: string;
    sinonime?: string[];
  }>;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": url,
    name,
    description,
    url,
    inLanguage: "ro-RO",
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm",
      "@id": `${url}#${t.slug}`,
      name: t.termen,
      description: t.definitie,
      inDefinedTermSet: url,
      ...(t.temeiLegal ? { sameAs: `https://legislatie.just.ro` } : {}),
      ...(t.sinonime && t.sinonime.length > 0
        ? { alternateName: t.sinonime }
        : {}),
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
 * Schema.org GovernmentService — describes civic services accessible via the
 * platform. Good for /cum-functioneaza + /[judet]/autoritati.
 */
export function GovernmentServiceJsonLd({
  name,
  description,
  url,
  area = "România",
}: {
  name: string;
  description: string;
  url: string;
  area?: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name,
    description,
    url,
    areaServed: {
      "@type": "Country",
      name: area,
    },
    provider: {
      "@type": "Organization",
      name: "Civia",
      url: "https://civia.ro",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
}
