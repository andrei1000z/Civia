import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Stable identity — Chrome uses `id` to keep the PWA install
    // associated with the same logical app even if start_url changes
    // (e.g., we A/B-test landing destinations). MUST stay constant
    // forever once first user installs.
    id: "/?source=pwa",
    name: SITE_NAME,
    short_name: "Civia",
    description: SITE_DESCRIPTION,
    // When the app boots from the installed icon, send the user
    // straight to the primary action (sesizare submit) — that's
    // why most people installed it.
    start_url: "/sesizari?utm_source=pwa",
    display: "standalone",
    // display_override lets Chrome desktop use the window-controls
    // overlay (full-bleed title bar) when available, falling back to
    // standalone (no browser chrome) then to a plain browser tab.
    display_override: ["window-controls-overlay", "standalone", "minimal-ui", "browser"],
    // 5/22/2026 — TWA Play Store prep:
    // background_color = #0d2e2a (dark mode bg ca să match-uiască splash
    // screen Android) — înlocuit #FAFAFA pentru consistenţă.
    background_color: "#0d2e2a",
    theme_color: "#059669",
    lang: "ro-RO",
    dir: "ltr" as const,
    scope: "/",
    orientation: "any" as const,
    prefer_related_applications: false,
    categories: ["government", "civic", "utilities", "news"],
    icons: [
      // Multi-size set so Android picks the closest match without
      // scaling. Maskable variants give Android adaptive icons their
      // safe-zone padding (no clipped edges on circular masks).
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // 2026-06-14 — `screenshots` scos din manifest: pointau spre fișiere
    // inexistente (/screenshots/*.png → 404, semnalat de PWABuilder). Pentru
    // Play Store screenshot-urile se urcă SEPARAT în Play Console (store
    // listing), nu din manifest. Le re-adăugăm aici doar dacă punem fișierele
    // reale în /public/screenshots/ (îmbunătățește dialogul de install Chrome).
    shortcuts: [
      { name: "Trimite o sesizare", short_name: "Sesizare", url: "/sesizari", description: "Scrie o sesizare formală către primărie" },
      { name: "Urmărește sesizarea", short_name: "Urmărește", url: "/urmareste", description: "Verifică statusul cu codul primit" },
      { name: "Întreruperi apă/caldură", short_name: "Întreruperi", url: "/intreruperi", description: "Vezi când ți se oprește apa, caldura, curentul" },
      { name: "Sesizări publice", short_name: "Publice", url: "/sesizari-publice", description: "Votează și trimite și tu sesizări civice" },
    ],
    // Web Share Target API — when another app shares a photo/text
    // (e.g. camera roll → Share menu → Civia), land directly in the
    // sesizare form with the file pre-attached. Title and text become
    // the description. This is the killer feature that turns PWA
    // Civia into a "report it now" reflex on mobile.
    share_target: {
      action: "/sesizari/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "description",
        url: "link",
        files: [
          {
            name: "photo",
            accept: ["image/jpeg", "image/png", "image/webp", "image/heic"],
          },
        ],
      },
    },
    // launch_handler tells the browser what to do when the PWA is
    // already open and the user clicks a Civia link from elsewhere:
    // navigate the existing window instead of opening a new tab.
    // Better UX than fragmenting state across instances.
    launch_handler: { client_mode: "navigate-existing" },
    // Empty array is intentional — declares "we have no native app
    // to redirect to" so Chrome doesn't suggest one.
    related_applications: [],
  };
}
