/**
 * Embed layout — fără navbar, fără footer, fără chrome.
 *
 * Iframe-urile pe site-uri externe vor doar conținutul widget-ului, nu și
 * UI-ul Civia.ro complet. Acest layout fiicare nestat sub `<RootLayout>`
 * dar Next 16 nu permite layouturi „flat" (fără nesting). Așa că randăm
 * minimal — un wrapper care nu include Navbar/Footer (acelea sunt în
 * src/app/layout.tsx la root level si din pacate nu putem opta out).
 *
 * Hack: în /embed/[county]/page.tsx folosim CSS să ascundem navbar/footer
 * via class .embed-mode pe <body> — vezi globals.css.
 *
 * Mai pragmatic: rezultatul vizual e ok cu navbar+footer pentru ca utilizatorul
 * embed-uitor poate seta iframe height = 520px care ascunde restul.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
