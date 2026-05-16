import Link from "next/link";
import { Mail, MessageSquareText, Users } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface SubscriberRow {
  id: string;
  display_name: string | null;
  full_name: string | null;
  phone: string | null;
  newsletter_email_optin: boolean;
  newsletter_sms_optin: boolean;
  email: string | null;
  emailConfirmedAt: string | null;
  /** „cont" = signed-in user toggled opt-in pe /cont. „anonim" = anonymous
   *  signup prin NewsletterNudge (insert in newsletter_subscribers). */
  source: "cont" | "anonim";
  /** Sortable absolute timestamp for created_at. */
  createdAt: string;
}

async function loadSubscribers(): Promise<SubscriberRow[]> {
  const admin = createSupabaseAdmin();

  // Bug 2026-05-15: admin vedea DOAR profiles cu opt-in (utilizatorii logați
  // care au bifat newsletter pe /cont). NewsletterNudge inserează in
  // tabelul separat `newsletter_subscribers` (signup anonim public).
  // Acum fac query paralel pe ambele si merge intr-un singur tabel cu
  // coloana „Sursă" — admin vede absolut tot.
  const [profilesRes, anonymousRes, usersPageRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, full_name, phone, newsletter_email_optin, newsletter_sms_optin, created_at")
      .or("newsletter_email_optin.eq.true,newsletter_sms_optin.eq.true")
      .order("created_at", { ascending: false }),
    admin
      .from("newsletter_subscribers")
      .select("id, email, confirmed_at, created_at, unsubscribed_at")
      .is("unsubscribed_at", null)
      .order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const userById = new Map(
    (usersPageRes.data?.users ?? []).map((u) => [u.id, u]),
  );

  const contRows: SubscriberRow[] = (profilesRes.data ?? []).map((p) => {
    const u = userById.get(p.id);
    return {
      id: `cont-${p.id}`,
      display_name: p.display_name,
      full_name: p.full_name,
      phone: p.phone,
      newsletter_email_optin: !!p.newsletter_email_optin,
      newsletter_sms_optin: !!p.newsletter_sms_optin,
      email: u?.email ?? null,
      emailConfirmedAt: u?.email_confirmed_at ?? null,
      source: "cont",
      createdAt: p.created_at ?? new Date(0).toISOString(),
    };
  });

  // De-dupe: dacă un anonymous email se potrivește cu unul logat, doar îl
  // marcăm pe cel cont și sărim de duplicate.
  const contEmails = new Set(
    contRows.map((r) => (r.email ?? "").toLowerCase()).filter(Boolean),
  );

  const anonymousRows: SubscriberRow[] = (anonymousRes.data ?? [])
    .filter((s) => !contEmails.has((s.email ?? "").toLowerCase()))
    .map((s) => ({
      id: `anon-${s.id}`,
      display_name: null,
      full_name: null,
      phone: null,
      newsletter_email_optin: true,
      newsletter_sms_optin: false,
      email: s.email ?? null,
      emailConfirmedAt: s.confirmed_at ?? null,
      source: "anonim",
      createdAt: s.created_at ?? new Date(0).toISOString(),
    }));

  // Merge + sort descendent dupa createdAt.
  return [...contRows, ...anonymousRows].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

export default async function NewsletterPage() {
  const subscribers = await loadSubscribers();
  const emailCount = subscribers.filter((s) => s.newsletter_email_optin).length;
  const smsCount = subscribers.filter((s) => s.newsletter_sms_optin).length;
  const anonimCount = subscribers.filter((s) => s.source === "anonim").length;

  return (
    <div className="space-y-6">
      {/* Resend free tier limitation — warning vizibil ca admin sa stie
          ca blast-ul efectiv funcționeaza doar dupa verificare domeniu. */}
      <div className="rounded-[var(--radius-md)] bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 p-4">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
          ⚠️ Resend free tier — limitare critica
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          Pe tier free, Resend trimite DOAR la emails verificate ale contului.
          Newsletter blast la abonati externi <strong>esueaza silent</strong> fara
          verificare DNS. Ca sa trimiti la oricine, verifica domeniul civia.ro la{" "}
          <a
            href="https://resend.com/domains"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            resend.com/domains
          </a>{" "}
          (SPF + DKIM + DMARC). Setup ~10 min.
        </p>
      </div>

      {/* Stats — 4 acum: email, SMS, anonim public, total. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Mail}
          label="Abonați email"
          value={emailCount}
          color="#2563EB"
        />
        <StatCard
          icon={MessageSquareText}
          label="Abonați SMS"
          value={smsCount}
          color="#059669"
        />
        <StatCard
          icon={Users}
          label="Anonimi public"
          value={anonimCount}
          color="#0EA5E9"
        />
        <StatCard
          icon={Users}
          label="Total contacte"
          value={subscribers.length}
          color="#8B5CF6"
        />
      </div>

      {/* Subscriber table */}
      {subscribers.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-10 text-center">
          <Mail size={32} className="mx-auto text-[var(--color-text-muted)] mb-3" aria-hidden="true" />
          <p className="text-sm text-[var(--color-text-muted)] mb-1 font-medium">
            Niciun abonat încă
          </p>
          <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
            Abonații vin din 2 surse: utilizatorii logați care bifează newsletter pe{" "}
            <Link href="/cont" className="text-[var(--color-primary)] underline">/cont</Link>,
            sau anonimi care introduc emailul în nudge-ul de pe site. Ambele apar aici imediat.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
              <tr>
                <th className="text-left p-3 text-[11px] uppercase tracking-wider font-semibold">Sursă</th>
                <th className="text-left p-3 text-[11px] uppercase tracking-wider font-semibold">Utilizator</th>
                <th className="text-left p-3 text-[11px] uppercase tracking-wider font-semibold">Email</th>
                <th className="text-left p-3 text-[11px] uppercase tracking-wider font-semibold">Telefon</th>
                <th className="text-center p-3 text-[11px] uppercase tracking-wider font-semibold">Email opt-in</th>
                <th className="text-center p-3 text-[11px] uppercase tracking-wider font-semibold">SMS opt-in</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/50 transition-colors"
                >
                  <td className="p-3">
                    {s.source === "cont" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold uppercase tracking-wider">
                        Cont
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-semibold uppercase tracking-wider">
                        Anonim
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">
                      {s.display_name ?? s.full_name ?? (s.source === "anonim" ? "—" : "Cetățean")}
                    </p>
                    {s.full_name && s.display_name !== s.full_name && (
                      <p className="text-[11px] text-[var(--color-text-muted)]">{s.full_name}</p>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {s.email ? (
                      <a
                        href={`mailto:${s.email}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {s.email}
                      </a>
                    ) : (
                      <span className="text-[var(--color-text-muted)] italic">(necunoscut)</span>
                    )}
                    {s.emailConfirmedAt && (
                      <span
                        className="ml-2 text-[10px] text-emerald-600 dark:text-emerald-400"
                        title={`Confirmat ${formatDateTime(s.emailConfirmedAt)}`}
                      >
                        ✓
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {s.phone ? (
                      <a href={`tel:${s.phone}`} className="text-[var(--color-primary)] hover:underline">
                        {s.phone}
                      </a>
                    ) : (
                      <span className="text-[var(--color-text-muted)] italic">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {s.newsletter_email_optin ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs">✓</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {s.newsletter_sms_optin ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs">✓</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
        Abonații vin din două surse: <strong>Cont</strong> — utilizatori logați care bifează
        newsletter pe{" "}
        <Link href="/cont" className="text-[var(--color-primary)] underline">/cont</Link>
        ; <strong>Anonim</strong> — vizitatori care introduc emailul în nudge-ul public.
        Toți primesc digestul săptămânal (luni dimineața). Pentru export, contactează
        operatorul prin /legal/confidentialitate.
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Mail;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-5">
      <div
        className="w-10 h-10 rounded-[var(--radius-xs)] grid place-items-center mb-3"
        style={{ backgroundColor: `${color}1a`, color }}
        aria-hidden="true"
      >
        <Icon size={18} />
      </div>
      <p
        className="text-3xl font-extrabold tabular-nums leading-none"
        style={{ color }}
      >
        {value.toLocaleString("ro-RO")}
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mt-2 font-medium uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}
