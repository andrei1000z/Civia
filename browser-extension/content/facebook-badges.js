/**
 * Civia Lens — Facebook content script.
 *
 * Detectează pagini Facebook de primării (regex pe URL + match cu
 * /api/v2/authorities) și injectează un badge "Răspunde la X%" lângă
 * numele paginii.
 */

const CIVIA_API = "https://civia.ro/api/v2";

async function main() {
  // Doar pe pagini de Facebook page (nu profile, nu groups)
  const pageMatch = window.location.pathname.match(/^\/(primaria[^/]+|sectorul?[0-9]+|[A-Za-z]+\.[A-Za-z]+\.?\d*)\/?$/i);
  if (!pageMatch) return;

  const pageSlug = pageMatch[1];

  try {
    const res = await fetch(`${CIVIA_API}/clasament`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok) return;

    // Caut autoritatea cu nume similar
    const match = (data.clasament || []).find((c) =>
      c.county_name.toLowerCase().includes(pageSlug.toLowerCase().slice(0, 6)),
    );
    if (!match) return;

    // Inject badge
    const badge = document.createElement("a");
    badge.href = `https://civia.ro/${match.county_slug}`;
    badge.target = "_blank";
    badge.rel = "noopener";
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-left: 8px;
      padding: 4px 10px;
      background: linear-gradient(135deg, #10b981, #06b6d4);
      color: white;
      font-size: 12px;
      font-weight: 600;
      border-radius: 999px;
      text-decoration: none;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
    `;
    badge.textContent = `🏛️ Civia: ${match.response_rate_pct}% rate răspuns`;
    badge.title = "Click pentru date publice Civia.ro";

    // Inserează lângă titlul paginii Facebook
    const pageTitle = document.querySelector('h1[role="heading"]');
    if (pageTitle && !pageTitle.querySelector('[data-civia-badge]')) {
      badge.setAttribute("data-civia-badge", "1");
      pageTitle.appendChild(badge);
    }
  } catch {
    // Silent fail
  }
}

// Run on initial load + on SPA navigation
main();
const observer = new MutationObserver(() => {
  if (!document.querySelector('[data-civia-badge]')) main();
});
observer.observe(document.body, { childList: true, subtree: true });
