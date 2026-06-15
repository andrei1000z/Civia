"use client";

import { useState } from "react";
import { Bell, ExternalLink, Loader2 } from "lucide-react";
import { buildReminderText, buildEmailPayload, type MailtoInput } from "@/lib/sesizari/mailto";
import { evaluateOverdue } from "@/lib/sesizari/overdue";

interface Props {
  /** Toate datele necesare pentru a reconstrui emailul formal complet. */
  emailInput: MailtoInput;
  createdAt: string | Date;
  status: string;
  officialResponseAt: string | Date | null;
}

/**
 * Buton „Trimite reamintire formală" pentru sesizările cu termen depășit.
 * Vizibil DOAR autorului + DOAR dacă isOverdue. Generează un mailto cu
 * opener art. 14 OG 27/2002 + corpul original al sesizării.
 */
export function ReminderButton({
  emailInput,
  createdAt,
  status,
  officialResponseAt,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  const r = evaluateOverdue({
    created_at: createdAt,
    status,
    official_response_at: officialResponseAt,
  });

  if (!r.isOverdue) return null;

  const onClick = () => {
    setSubmitting(true);
    try {
      const reminderInput = {
        ...emailInput,
        daysOverdue: r.daysOverdue,
        originalFiledAt: createdAt,
      };
      // Build subject + body fresh — folosim buildEmailPayload pentru
      // destinatari + subiect, dar override body cu buildReminderText.
      const payload = buildEmailPayload(emailInput);
      const reminderBody = buildReminderText(reminderInput);
      const subject = `Reamintire — ${payload.subject}`;
      const ccPart = payload.cc.length > 0 ? `&cc=${payload.cc.join(",")}` : "";
      const url = `mailto:${payload.to.join(",")}?subject=${encodeURIComponent(subject)}${ccPart}&body=${encodeURIComponent(reminderBody)}`;
      window.location.href = url;
    } finally {
      setTimeout(() => setSubmitting(false), 1000);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitting}
      className="inline-flex items-center gap-2 h-11 px-4 rounded-[var(--radius-xs)] bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors shadow-[var(--shadow-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-600"
      title="Trimite o reamintire formală conform art. 14 OG 27/2002"
    >
      {submitting ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        <Bell size={16} aria-hidden="true" />
      )}
      Reamintire către autoritate
      <ExternalLink size={12} aria-hidden="true" />
    </button>
  );
}
