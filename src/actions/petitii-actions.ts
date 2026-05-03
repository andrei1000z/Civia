"use server";

/**
 * Server Actions pentru petiții user-initiated.
 *
 * De ce server actions aici (vs API routes ca restul Civia)?
 * - Form-ul de pe /petitii/initiaza folosește useFormState + useFormStatus
 *   pentru loading state și validation feedback fără round-trip-uri
 *   client-side. Server actions e Next 15+ pattern idiomatic pentru asta.
 * - Workflow simplu: submit → validate → insert → redirect. Un endpoint
 *   API ar fi adăugat 30 linii de glue cod fără benefit real.
 *
 * Action-ul rulează server-side cu sesiunea utilizatorului via cookies
 * (createSupabaseServer), deci RLS din DB e activ — chiar dacă cineva
 * apelează action-ul cu payload manipulat, RLS blochează (vezi
 * migration 033 → policy petitii_user_initiate).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { PETITIE_CATEGORII } from "@/lib/constants";

// ============================================================
// Schema
// ============================================================

const VALID_CATEGORIES = PETITIE_CATEGORII.map((c) => c.value) as readonly string[];
// Target valid: 5 trepte numerice + 0 = sentinel pentru „nelimitat"
// (transformat în NULL la insert, ca progress-bar-ul să afișeze
// „Fără limită" în loc de procent imposibil).
const VALID_TARGETS = [500, 1000, 5000, 10000, 50000, 100000] as const;

const createSchema = z.object({
  title: z
    .string()
    .trim()
    .min(10, "Titlul trebuie să aibă minim 10 caractere")
    .max(160, "Titlul nu poate depăși 160 caractere"),
  category: z.enum(VALID_CATEGORIES as [string, ...string[]], {
    message: "Alege o categorie validă",
  }),
  summary: z
    .string()
    .trim()
    .min(40, "Sumarul trebuie să aibă minim 40 caractere")
    .max(280, "Sumarul nu poate depăși 280 caractere (e tagline-ul cardului)"),
  body: z
    .string()
    .trim()
    .min(150, "Descrierea detaliată trebuie să aibă minim 150 caractere ca să fie credibilă")
    .max(20000, "Descrierea nu poate depăși 20.000 caractere"),
  // 0 = sentinel pentru nelimitat (transformat în NULL la insert).
  // Restul valorilor: din lista predefinită.
  target_signatures: z.coerce
    .number()
    .int()
    .refine((n) => n === 0 || (VALID_TARGETS as readonly number[]).includes(n), {
      message: "Target invalid — alege una din opțiunile predefinite",
    }),
  county_code: z
    .string()
    .trim()
    .toUpperCase()
    .max(4)
    .optional()
    .or(z.literal("")),
  // Cover image — URL produs de /api/upload (Supabase Storage public bucket).
  // Optional ca să nu blocăm petițiile fără imagine. Validare URL strictă
  // ca să nu putem injecta orice payload în html-ul ulterior.
  image_url: z
    .string()
    .url("URL imagine invalid")
    .max(500)
    .optional()
    .or(z.literal("")),
});

// ============================================================
// State type — standardizat pentru useFormState
// ============================================================

export type CreatePetitieState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; slug: string };

// ============================================================
// Slug generation cu retry pe collision
// ============================================================

/**
 * Generează un slug unic pe baza titlului. Dacă slug-ul de bază e luat,
 * adaugă suffix incremental (-2, -3, ...) până găsește unul liber sau
 * dă fail după 50 de încercări (improbabil în practică).
 *
 * Slug-ul e capat la 80 caractere — URL-uri prea lungi sunt rele pentru
 * SEO + share. „Cerem-modernizarea-infrastructurii-de-transport-public..."
 * devine „cerem-modernizarea-infrastructurii-de-transport-public" care
 * e citibil și util.
 */
async function generateUniqueSlug(
  title: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<string> {
  const base = (slugify(title).slice(0, 80) || "petitie").replace(/-+$/, "");

  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data: existing } = await supabase
      .from("petitii")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!existing) return candidate;
  }
  // Improbabil — fallback cu timestamp
  return `${base}-${Date.now().toString(36).slice(-5)}`;
}

// ============================================================
// Action: createPetitie
// ============================================================

/**
 * Server Action pentru crearea unei petiții user-initiated.
 *
 * Validează FormData cu Zod, autentifică utilizatorul, generează slug
 * unic, inserează cu status='draft' + moderation_status='pending'
 * (necesar pentru policy „petitii_user_initiate"). Pe success, face
 * redirect către pagina petiției proprii (vizibilă doar pentru autor
 * până la moderare via policy „petitii_owner_read").
 *
 * Erorile sunt returnate ca state object (nu thrown) pentru ca form-ul
 * să le poată afișa contextual cu useFormState.
 */
export async function createPetitie(
  _prevState: CreatePetitieState,
  formData: FormData,
): Promise<CreatePetitieState> {
  // 1. Auth check — server-side pentru că action-ul rulează cu cookies-urile
  // utilizatorului (sau ale anon-ului dacă nu e logat).
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: 'Trebuie să fii autentificat ca să inițiezi o petiție. Apasă pe „Conectare" din dreapta sus.',
    };
  }

  // 2. Validare strictă cu Zod
  const raw = {
    title: formData.get("title"),
    category: formData.get("category"),
    summary: formData.get("summary"),
    body: formData.get("body"),
    target_signatures: formData.get("target_signatures"),
    county_code: formData.get("county_code"),
    image_url: formData.get("image_url"),
  };
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return {
      status: "error",
      message: "Verifică datele formularului — ceva nu e valid.",
      fieldErrors,
    };
  }
  const data = parsed.data;

  // 3. Anti-spam ușor: titluri all-caps sau cu URL-uri sunt blocate.
  // Real anti-spam (rate limit, captcha) ar fi over-engineering pentru
  // moment — auth-only blochează deja botii basic.
  if (data.title === data.title.toUpperCase() && data.title.length > 20) {
    return {
      status: "error",
      message: "Titlul e tot cu majuscule. Folosește scriere normală — petițiile cu CAPS în titlu primesc mai puține semnături.",
    };
  }
  if (/https?:\/\//i.test(data.title)) {
    return {
      status: "error",
      message: "Titlul nu poate conține URL-uri.",
    };
  }

  // 4. Generăm slug unic
  const slug = await generateUniqueSlug(data.title, supabase);

  // 5. Insert. RLS policy „petitii_user_initiate" enforce-uiește că
  // is_user_initiated=true AND moderation_status='pending' AND status='draft'
  // AND created_by=auth.uid(). Dacă oricare lipsește, RLS rejects.
  const { error: insertError } = await supabase.from("petitii").insert({
    slug,
    title: data.title,
    summary: data.summary,
    body: data.body,
    // 0 = sentinel pentru „nelimitat" → DB NULL (constraint allows null,
    // default fallback la 1000 nu se aplică pentru NULL explicit).
    target_signatures: data.target_signatures === 0 ? null : data.target_signatures,
    category: data.category,
    county_code: data.county_code || null,
    image_url: data.image_url || null,
    status: "draft",
    is_user_initiated: true,
    moderation_status: "pending",
    created_by: user.id,
  });

  if (insertError) {
    return {
      status: "error",
      message: `Nu am putut salva petiția: ${insertError.message}. Reîncearcă în câteva secunde.`,
    };
  }

  // 6. Revalidăm listing-ul + admin-ul ca să apară noua submisie imediat.
  revalidatePath("/petitii");
  revalidatePath("/admin/petitii");

  // 7. Redirect la pagina de confirmare — petiția nu e încă vizibilă
  // public (status='draft', moderation_status='pending'), deci /petitii/[slug]
  // ar 404. Pagina de confirmare îi arată autorului că s-a trimis cu
  // succes + estimează când va fi live.
  redirect(`/petitii/initiaza/multumim?slug=${slug}`);
}
