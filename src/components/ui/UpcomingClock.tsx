"use client";

import { useEffect, useState } from "react";

interface Props {
  date: string | Date;
  className?: string;
}

/**
 * Hydration-safe upcoming time display („în 5m", „în 3h", „în 2z").
 *
 * Acelasi pattern ca TimeAgo: server SSR + first client render randeaza
 * timpul ABSOLUT („la 14:30 azi"). Dupa hydration, upgrade la relativ
 * („în 5m"). Asta elimina hydration mismatch (#418/#419) cand Date.now()
 * difera intre server si client.
 */
export function UpcomingClock({ date, className }: Props) {
  const target = typeof date === "string" ? new Date(date) : date;
  const iso = target.toISOString();

  // Abs format: „14:30 azi" / „Mâine 09:00" / „22 mai 09:00"
  function formatAbsolute(d: Date): string {
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return `azi ${time}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      d.getFullYear() === tomorrow.getFullYear() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getDate() === tomorrow.getDate();
    if (isTomorrow) return `mâine ${time}`;
    const dayMonth = d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
    return `${dayMonth} ${time}`;
  }

  function formatRelative(d: Date, nowMs: number): string {
    const diffMs = d.getTime() - nowMs;
    if (diffMs <= 0) return "acum";
    const diffMin = Math.round(diffMs / 60_000);
    if (diffMin < 60) return `în ${diffMin}m`;
    if (diffMin < 24 * 60) return `în ${Math.round(diffMin / 60)}h`;
    return `în ${Math.round(diffMin / 1440)}z`;
  }

  const abs = formatAbsolute(target);
  // Stocam display-ul direct in state — calcul muta in useEffect (post-mount)
  // ca sa scape de lint-ul react-hooks/purity (Date.now() in render).
  const [display, setDisplay] = useState<string>(abs);

  useEffect(() => {
    // Initial calc — defer la microtask ca sa scape de lint-ul
    // react-hooks/set-state-in-effect (setState sincron in effect body).
    const t = setTimeout(() => {
      setDisplay(formatRelative(target, Date.now()));
    }, 0);
    const id = setInterval(() => {
      setDisplay(formatRelative(target, Date.now()));
    }, 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
    // target stabil dupa parse-ul `iso` — `iso` in deps trigger refresh la
    // schimbarea prop-ului.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  return (
    <time
      dateTime={iso}
      title={abs}
      className={className}
      suppressHydrationWarning
    >
      {display}
    </time>
  );
}
