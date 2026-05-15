import type { Metadata } from "next";
import Link from "next/link";
import { Smartphone, Apple, Bot, ExternalLink, Copy } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Widget pe home screen — Civia",
  description:
    "Adaugă Civia pe home screen-ul telefonului ca shortcut, widget cu sesizările active, sau quick-action. Instrucțiuni pas-cu-pas pentru iOS și Android.",
  alternates: { canonical: "/widget/setup" },
};

export default function WidgetSetupPage() {
  return (
    <div className="container-narrow py-8 md:py-12 max-w-3xl">
      <PageHero
        title="Civia pe home screen"
        icon={Smartphone}
        gradient={HERO_GRADIENT.primary}
        description={
          <>
            Trei moduri să ai Civia la un tap distanță: shortcut PWA, widget cu sesizări, sau Apple Shortcut cu Siri.
          </>
        }
        tagline="Funcționează pe iOS 16.4+ și Android 8+."
      />

      <div className="space-y-8">
        {/* ─── METODA 1: PWA installation ─── */}
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 shadow-[var(--shadow-1)]">
          <h2 className="font-[family-name:var(--font-sora)] font-bold text-lg mb-2 inline-flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 grid place-items-center text-sm font-bold">1</span>
            Instalează Civia ca aplicație
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-3 leading-relaxed">
            Cea mai rapidă cale — icoană Civia direct pe home screen, fără bara browser-ului, primește notificări push.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] p-3">
              <div className="inline-flex items-center gap-1.5 mb-2 text-xs font-semibold">
                <Apple size={13} aria-hidden="true" /> iOS (Safari)
              </div>
              <ol className="text-xs text-[var(--color-text-muted)] space-y-1 list-decimal list-inside leading-relaxed">
                <li>Deschide civia.ro în <strong>Safari</strong></li>
                <li>Tap pe Share (pătrat cu săgeată sus)</li>
                <li>Tap pe „Adaugă pe ecranul principal"</li>
                <li>Pe iOS 16.4+ → activează notificările din `/cont`</li>
              </ol>
            </div>
            <div className="rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] p-3">
              <div className="inline-flex items-center gap-1.5 mb-2 text-xs font-semibold">
                <Bot size={13} aria-hidden="true" /> Android (Chrome)
              </div>
              <ol className="text-xs text-[var(--color-text-muted)] space-y-1 list-decimal list-inside leading-relaxed">
                <li>Deschide civia.ro în Chrome</li>
                <li>Tap pe meniu (3 puncte) → „Adaugă la ecran de pornire"</li>
                <li>Long-press pe icoana Civia → quick-actions (Voce, Sesizare, Publice, Petiții)</li>
                <li>Push notifications merg implicit pe Chrome/Firefox</li>
              </ol>
            </div>
          </div>
        </section>

        {/* ─── METODA 2: Widget cu sesizările ─── */}
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 shadow-[var(--shadow-1)]">
          <h2 className="font-[family-name:var(--font-sora)] font-bold text-lg mb-2 inline-flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 grid place-items-center text-sm font-bold">2</span>
            Widget pe home screen
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-3 leading-relaxed">
            Vezi în timp real câte sesizări active sunt în județul tău + ultimele 3, fără să deschizi aplicația.
          </p>

          <div className="rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] p-3 mb-3">
            <p className="text-xs font-semibold mb-1.5">URL widget (embeddable):</p>
            <code className="block text-[11px] font-mono bg-[var(--color-bg)] p-2 rounded-[var(--radius-xs)] break-all">
              {SITE_URL}/widget?judet=b&size=medium&theme=auto
            </code>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-2 leading-relaxed">
              Parametri opționali: <code>judet</code> (slug: b, cj, ts, ...), <code>size</code> (small/medium/large), <code>theme</code> (light/dark/auto).
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] p-3">
              <p className="text-xs font-semibold mb-2 inline-flex items-center gap-1.5">
                <Apple size={13} aria-hidden="true" /> iOS — Apple Shortcuts
              </p>
              <ol className="text-xs text-[var(--color-text-muted)] space-y-1 list-decimal list-inside leading-relaxed">
                <li>Deschide aplicația <strong>Shortcuts</strong> (built-in)</li>
                <li>Tap „+" → „Add Action" → „Get Contents of URL"</li>
                <li>Pune URL: <code className="text-[10px]">{SITE_URL}/api/widget?format=text</code></li>
                <li>Add Action „Show Result"</li>
                <li>Tap nume → „Civia stats"</li>
                <li>Adaugă pe home screen ca widget: hold-press home → +<br />→ Shortcuts → alege „Civia stats"</li>
              </ol>
            </div>
            <div className="rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] p-3">
              <p className="text-xs font-semibold mb-2 inline-flex items-center gap-1.5">
                <Bot size={13} aria-hidden="true" /> Android — WebView widget
              </p>
              <ol className="text-xs text-[var(--color-text-muted)] space-y-1 list-decimal list-inside leading-relaxed">
                <li>Instalează <strong>Tasker</strong> sau <strong>KWGT</strong> din Play Store</li>
                <li>Adaugă un widget de tip „Web View"</li>
                <li>Pune URL: <code className="text-[10px]">{SITE_URL}/widget?theme=auto</code></li>
                <li>Setează auto-refresh la 5-10 minute</li>
                <li>Adaugă widget-ul pe home screen</li>
              </ol>
            </div>
          </div>
        </section>

        {/* ─── METODA 3: Voice command Siri ─── */}
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 shadow-[var(--shadow-1)]">
          <h2 className="font-[family-name:var(--font-sora)] font-bold text-lg mb-2 inline-flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 grid place-items-center text-sm font-bold">3</span>
            „Hey Siri, sesizare nouă"
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-3 leading-relaxed">
            Voice-trigger pe iOS — spui o comandă vocală, Siri deschide direct pagina de sesizare prin voce.
          </p>
          <ol className="text-xs text-[var(--color-text-muted)] space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>Aplicația Shortcuts → „+" → „Add Action" → „Open URL"</li>
            <li>URL: <code className="text-[10px]">{SITE_URL}/sesizari/voce</code></li>
            <li>Tap pe nume sus → „Sesizare nouă"</li>
            <li>Apoi tap pe iconița ⓘ → „Add to Siri" → înregistrează expresia ta („Sesizare nouă")</li>
            <li>Acum poți zice „Hey Siri, sesizare nouă" oriunde — deschide pagina vocală</li>
          </ol>
        </section>

        {/* CTA */}
        <div className="text-center pt-2">
          <Link
            href="/cont"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            Mergi pe /cont să activezi notificările push
            <ExternalLink size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
