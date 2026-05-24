import { NextResponse } from "next/server";

/**
 * RFC 9116 security.txt — machine-readable security contact info.
 * Standard pentru responsible disclosure cercetători + tooling automat.
 *
 * Reference: https://securitytxt.org/
 */
export async function GET() {
  // Expirare: 1 an de la build
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString();

  const body = [
    `Contact: mailto:security@civia.ro`,
    `Expires: ${expires}`,
    `Preferred-Languages: ro, en`,
    `Canonical: https://civia.ro/.well-known/security.txt`,
    `Policy: https://civia.ro/security`,
    `Acknowledgments: https://civia.ro/security#hall-of-fame`,
    `Hiring: https://civia.ro/despre`,
    `# Civia este platformă civică open-source non-profit.`,
    `# Repository: https://github.com/andrei1000z/Civia`,
    `# Safe harbor pentru research de bună-credință — vezi /security`,
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
