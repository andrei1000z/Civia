import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ActualizareForm } from "../ActualizariForm";

export const dynamic = "force-dynamic";

export default async function NouActualizarePage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?login=1");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    redirect("/");
  }

  return <ActualizareForm />;
}
