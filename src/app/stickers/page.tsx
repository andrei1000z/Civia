import type { Metadata } from "next";
import { Sticker, Printer, Download } from "lucide-react";
import { PageHero, HERO_GRADIENT } from "@/components/layout/PageHero";
import { Card } from "@/components/ui/Card";
import { StickerGrid } from "@/components/stickers/StickerGrid";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Stickere Civia — viralitate offline",
  description:
    "Descarcă stickere QR printabile pe care le lipesti pe groape, copaci căzuți, gunoaie. Trecători → scanează → ajung pe sesizare → semnează și ei.",
  alternates: { canonical: "/stickers" },
};

export default function StickersPage() {
  return (
    <div className="container-narrow py-8 md:py-12">
      <PageHero
        title="Stickere QR pentru sesizări"
        icon={Sticker}
        gradient={HERO_GRADIENT.warning}
        description="Pune un sticker pe groapa pe care ai raportat-o. Trecătorii scanează codul, ajung direct la sesizare, semnează și ei. Pressure publică reală pe primărie."
        tagline="Print at home · A4 · 8 stickere/pagină"
      />

      <section className="mb-10">
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-4 flex items-center gap-2">
          <Printer size={18} aria-hidden="true" />
          Cum funcționează
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Card>
            <div className="text-3xl mb-2" aria-hidden="true">1️⃣</div>
            <h3 className="font-semibold text-sm mb-1">Generează</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Lipești codul sesizării tale pe sticker. Sau folosești unul generic „raportează aici".
            </p>
          </Card>
          <Card>
            <div className="text-3xl mb-2" aria-hidden="true">2️⃣</div>
            <h3 className="font-semibold text-sm mb-1">Printează</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              A4 cu 8 stickere. Hartie autocolanta sau printez normal + scotch.
            </p>
          </Card>
          <Card>
            <div className="text-3xl mb-2" aria-hidden="true">3️⃣</div>
            <h3 className="font-semibold text-sm mb-1">Lipești</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Pe groapa / trotuar / panou. Trecătorii scanează → ajung pe Civia → co-semnează.
            </p>
          </Card>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold mb-4 flex items-center gap-2">
          <Download size={18} aria-hidden="true" />
          Stickere
        </h2>
        <StickerGrid baseUrl={SITE_URL} />
      </section>

      <div className="rounded-[var(--radius-md)] bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 p-5 text-xs leading-relaxed">
        <p className="font-semibold text-amber-900 dark:text-amber-200 mb-2">
          ⚠️ Lipește responsabil
        </p>
        <ul className="list-disc pl-5 space-y-1 text-amber-800 dark:text-amber-300">
          <li>NU lipi pe proprietate privată fără permisiunea proprietarului.</li>
          <li>NU lipi pe vehicule, pe oameni, sau pe semne de circulație oficiale.</li>
          <li>OK pe trotuar deteriorat, panou neutral, stâlp de iluminat (cu condiția să nu obturezi semnalizare).</li>
          <li>Folosește hârtie biodegradabilă sau lipici care se dezlipește la apă.</li>
        </ul>
      </div>
    </div>
  );
}
