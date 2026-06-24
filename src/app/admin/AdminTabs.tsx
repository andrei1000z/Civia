"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Megaphone,
  Flag,
  AlertTriangle,
  MessageSquareText,
  BarChart3,
  Mail,
  Sparkles,
  Users,
  Inbox,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/sesizari", label: "Sesizări", icon: FileText, exact: false },
  { href: "/admin/inbox", label: "Inbox", icon: Inbox, exact: false },
  { href: "/admin/petitii", label: "Petiții", icon: Megaphone, exact: false },
  { href: "/admin/proteste", label: "Proteste", icon: Flag, exact: false },
  { href: "/admin/intreruperi", label: "Întreruperi", icon: AlertTriangle, exact: false },
  { href: "/admin/primarie", label: "Primărie", icon: Building2, exact: false },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquareText, exact: false },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail, exact: false },
  { href: "/admin/categorii-noi", label: "Categorii AI", icon: Sparkles, exact: false },
  { href: "/admin/utilizatori", label: "Utilizatori", icon: Users, exact: false },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, exact: false },
] as const;

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-1 mb-7 overflow-x-auto no-scrollbar -mx-2 px-2"
      aria-label="Secțiuni admin"
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-full)] text-xs md:text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
              isActive
                ? "bg-[var(--color-primary)] text-white shadow-[var(--shadow-1)]"
                : "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
            )}
          >
            <Icon size={13} aria-hidden="true" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
