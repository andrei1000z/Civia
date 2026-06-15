"use client";

import { useState } from "react";
import { Bell, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
    <Button
      type="button"
      variant="danger"
      size="md"
      onClick={onClick}
      loading={submitting}
      leftIcon={<Bell size={16} aria-hidden="true" />}
      rightIcon={<ExternalLink size={12} aria-hidden="true" />}
      title="Trimite o reamintire formală conform art. 14 OG 27/2002"
    >
      Reamintire către autoritate
    </Button>
  );
}
