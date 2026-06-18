import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contul meu",
  description: "Gestionează profilul Civia: date personale, sesizările tale, export GDPR.",
  alternates: { canonical: "/cont" },
  robots: { index: false, follow: false },
};

export default function ContLayout({ children }: { children: React.ReactNode }) {
  return children;
}
