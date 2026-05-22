import { redirect, notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getActualizareByVersiune } from "@/lib/actualizari/repository";
import { ActualizareForm } from "../ActualizariForm";

export const dynamic = "force-dynamic";

export default async function EditActualizarePage({
  params,
}: {
  params: Promise<{ versiune: string }>;
}) {
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

  const { versiune } = await params;
  const actualizare = await getActualizareByVersiune(versiune);
  if (!actualizare) notFound();

  return (
    <ActualizareForm
      initial={{
        versiune: actualizare.versiune,
        data: actualizare.data,
        titlu: actualizare.titlu,
        descriere: actualizare.descriere,
        schimbari: actualizare.schimbari,
        major: actualizare.major,
        minimalist: actualizare.minimalist,
        continut_markdown: actualizare.continut_markdown,
        published: actualizare.published,
      }}
    />
  );
}
