import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { IntreruperiSubmissions } from "./IntreruperiSubmissions";

export const metadata = {
  title: "Submisii întreruperi — Admin",
};

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  text: string;
  image_url: string | null;
  email: string | null;
  ip_hash: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export default async function AdminIntreruperiPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") notFound();

  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("interruption_submissions")
    .select("id, text, image_url, email, ip_hash, status, admin_notes, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as Row[];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
        >
          ← Admin home
        </Link>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold mt-2">
          Submisii întreruperi
        </h1>
      </div>

      <IntreruperiSubmissions rows={rows} />
    </div>
  );
}
