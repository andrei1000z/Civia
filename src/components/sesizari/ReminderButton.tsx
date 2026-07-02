"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { evaluateOverdue } from "@/lib/sesizari/overdue";

interface Props {
  /** Codul sesizării — folosit pentru POST /api/sesizari/[code]/remind. */
  code: string;
  createdAt: string | Date;
  status: string;
  officialResponseAt: string | Date | null;
}

/**
 * Buton „Reamintire către autoritate" pentru sesizările cu termen depășit.
 * 2026-07-01 — trimite SERVER-SIDE de pe sesizari@civia.ro (nu mai deschide
 * mailto în clientul userului). O poate declanșa oricine (nudge comunitar);
 * conținutul e impersonal/anonim. Vizibil doar dacă termenul e depășit.
 */
export function ReminderButton({ code, createdAt, status, officialResponseAt }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const { toast } = useToast();
  const router = useRouter();

  const r = evaluateOverdue({ created_at: createdAt, status, official_response_at: officialResponseAt });
  if (!r.isOverdue) return null;

  const onClick = async () => {
    if (state !== "idle") return;
    setState("sending");
    try {
      const res = await fetch(`/api/sesizari/${code}/remind`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("idle");
        toast(json.error || "Reamintirea nu a putut fi trimisă.", "error", 4000);
        return;
      }
      setState("sent");
      const dest =
        typeof json.count === "number"
          ? `${json.count} ${json.count === 1 ? "autoritate" : "autorități"}`
          : "autorități";
      toast(`Reamintire trimisă către ${dest}. Așteptăm răspunsul.`, "success", 4000);
      router.refresh();
    } catch {
      setState("idle");
      toast("Eroare de rețea. Încearcă din nou.", "error", 4000);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="md"
      onClick={onClick}
      loading={state === "sending"}
      aria-disabled={state === "sent"}
      leftIcon={state === "sent" ? <Check size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
      className="whitespace-normal text-center leading-tight"
      title="Trimite o reamintire formală conform art. 14 OG 27/2002, direct de pe sesizari@civia.ro"
    >
      {state === "sent" ? "Reamintire trimisă" : "Reamintire către autoritate"}
    </Button>
  );
}
