import { redirect } from "next/navigation";
import { getCountyBySlug } from "@/data/counties";
import { notFound } from "next/navigation";

/**
 * URL legacy: /[judet]/intreruperi
 * URL nou canonic: /intreruperi/[judet]
 *
 * User decision (2026-05-19): mutam routing-ul per-judet la
 * /intreruperi/[county-slug] ca sa fie consistent cu paginile detail
 * de outage (toate sub /intreruperi/...). Pastram acest route ca
 * redirect 308 (permanent) pentru SEO + bookmarks vechi.
 */
export default async function LegacyJudetIntreruperiRedirect({
  params,
}: {
  params: Promise<{ judet: string }>;
}) {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  if (!county) notFound();
  redirect(`/intreruperi/${county.slug}`);
}
