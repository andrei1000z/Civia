/**
 * Page transition wrapper. Next App Router re-mounts template.tsx on every
 * navigation (unlike layout.tsx), so `.page-transition` runs a subtle opacity
 * fade-in each time the route changes — modern app feel, no chrome flicker
 * (Navbar/Footer live in layout.tsx and persist).
 *
 * Carries `flex flex-1 flex-col` to preserve the contract from <main> so
 * full-height pages (maps, etc.) still stretch. Opacity-only animation (no
 * transform) → keeps `position: fixed` descendants (modals/FAB/toasts) intact.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition flex flex-1 flex-col">{children}</div>;
}
