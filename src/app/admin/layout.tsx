import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { createSupabaseServer } from "@/lib/supabase/server";
import { AdminTabs } from "./AdminTabs";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="lc-canvas lc-canvas--flat flex-1">
      <div className="container-narrow py-8 md:py-10">
      {/* Hero header — gradient strip identifies the admin area at a glance */}
      <header className="relative mb-6 overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br from-rose-600 via-rose-700 to-orange-700 p-5 md:p-6 text-white shadow-[var(--shadow-3)]">
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute -bottom-12 -left-8 w-56 h-56 rounded-full bg-orange-400/20 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="relative flex items-center gap-4 flex-wrap">
          <div
            className="w-12 h-12 rounded-[var(--radius-xs)] bg-white/15 backdrop-blur-sm ring-2 ring-white/30 grid place-items-center shrink-0"
            aria-hidden="true"
          >
            <ShieldCheck size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-extrabold leading-tight">
              Admin panel
            </h1>
            <p className="text-xs text-white/85 truncate max-w-[260px] md:max-w-md">
              Conectat ca <span className="font-mono">{user.email}</span>
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-full)] bg-white/15 backdrop-blur-sm border border-white/30 text-xs font-medium hover:bg-white/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            Înapoi la site
          </Link>
        </div>
      </header>

      <AdminTabs />

      {children}
      </div>
    </div>
  );
}
