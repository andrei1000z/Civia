/**
 * Mini-markdown renderer pentru /actualizari + admin editor.
 *
 * Suportă:
 *  - `**bold**`            → <strong>
 *  - `*italic*`            → <em>
 *  - `~~strikethrough~~`   → <del>
 *  - `__underline__`       → <u>
 *  - `==highlight==`       → <mark>
 *  - `` `code` ``          → <code>
 *  - `[text](url)`         → <a>
 *  - `# H1`, `## H2`, `### H3`  → headings
 *  - `- item`              → <ul><li>
 *  - `{color:red}text{/color}` → <span style="color:...">
 *  - `{size:large}text{/size}` → <span style="font-size:...">
 *  - Line breaks            → <br/>
 *  - Empty line            → paragraph break
 *
 * SAFE: NU acceptă raw HTML — totul e text escaped înainte de regex.
 * NU folosește dangerouslySetInnerHTML — render direct React elements.
 *
 * Plan 5/23/2026 — folosit pe /actualizari + /admin/actualizari editor
 * cu preview live.
 */

import React, { Fragment } from "react";

const COLOR_MAP: Record<string, string> = {
  red: "#DC2626",
  rosu: "#DC2626",
  orange: "#F97316",
  portocaliu: "#F97316",
  yellow: "#F59E0B",
  galben: "#F59E0B",
  green: "#059669",
  verde: "#059669",
  blue: "#0891B2",
  albastru: "#0891B2",
  purple: "#7C3AED",
  violet: "#7C3AED",
  pink: "#EC4899",
  roz: "#EC4899",
  gray: "#6B7280",
  gri: "#6B7280",
};

const SIZE_MAP: Record<string, string> = {
  small: "0.875em",
  mic: "0.875em",
  normal: "1em",
  large: "1.25em",
  mare: "1.25em",
  huge: "1.5em",
  uriaș: "1.5em",
  uria: "1.5em",
};

/**
 * Procesează un span de text inline (NO line breaks) și returnează un
 * array de React nodes. Apelat pe content de paragraph.
 */
function renderInline(text: string, keyPrefix = "i"): React.ReactNode[] {
  // Lucrăm cu un index ca să nu re-parsăm același substring de mai multe ori.
  const tokens: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < text.length) {
    // 1. Bold **text**
    const boldMatch = text.slice(i).match(/^\*\*([^*\n]+?)\*\*/);
    if (boldMatch) {
      tokens.push(<strong key={`${keyPrefix}-${key++}`}>{renderInline(boldMatch[1] ?? "", `${keyPrefix}-${key}b`)}</strong>);
      i += boldMatch[0].length;
      continue;
    }
    // 2. Italic *text*
    const italicMatch = text.slice(i).match(/^\*([^*\n]+?)\*/);
    if (italicMatch) {
      tokens.push(<em key={`${keyPrefix}-${key++}`}>{renderInline(italicMatch[1] ?? "", `${keyPrefix}-${key}i`)}</em>);
      i += italicMatch[0].length;
      continue;
    }
    // 3. Strikethrough ~~text~~
    const strikeMatch = text.slice(i).match(/^~~([^~\n]+?)~~/);
    if (strikeMatch) {
      tokens.push(<del key={`${keyPrefix}-${key++}`}>{renderInline(strikeMatch[1] ?? "", `${keyPrefix}-${key}s`)}</del>);
      i += strikeMatch[0].length;
      continue;
    }
    // 4. Underline __text__
    const ulineMatch = text.slice(i).match(/^__([^_\n]+?)__/);
    if (ulineMatch) {
      tokens.push(<u key={`${keyPrefix}-${key++}`}>{renderInline(ulineMatch[1] ?? "", `${keyPrefix}-${key}u`)}</u>);
      i += ulineMatch[0].length;
      continue;
    }
    // 5. Highlight ==text==
    const markMatch = text.slice(i).match(/^==([^=\n]+?)==/);
    if (markMatch) {
      tokens.push(
        <mark
          key={`${keyPrefix}-${key++}`}
          style={{ background: "var(--color-primary-soft)", color: "var(--color-primary-on-soft)", padding: "0 0.25em", borderRadius: 3 }}
        >
          {renderInline(markMatch[1] ?? "", `${keyPrefix}-${key}h`)}
        </mark>,
      );
      i += markMatch[0].length;
      continue;
    }
    // 6. Inline code `text`
    const codeMatch = text.slice(i).match(/^`([^`\n]+?)`/);
    if (codeMatch) {
      tokens.push(
        <code
          key={`${keyPrefix}-${key++}`}
          className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[0.9em] font-mono"
        >
          {codeMatch[1]}
        </code>,
      );
      i += codeMatch[0].length;
      continue;
    }
    // 7. Link [text](url) — sanitized: doar http(s) și paths interne
    const linkMatch = text.slice(i).match(/^\[([^\]\n]+?)\]\(([^)\n\s]+?)\)/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      const safeUrl = url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/") || url.startsWith("#"))
        ? url
        : "#";
      const isExternal = safeUrl.startsWith("http");
      tokens.push(
        <a
          key={`${keyPrefix}-${key++}`}
          href={safeUrl}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="text-[var(--color-primary)] hover:underline"
        >
          {label}
        </a>,
      );
      i += linkMatch[0].length;
      continue;
    }
    // 8. Color {color:red}text{/color}
    const colorMatch = text.slice(i).match(/^\{color:([\w]+)\}([^{}\n]+?)\{\/color\}/);
    if (colorMatch) {
      const [, colorName, content] = colorMatch;
      const color = COLOR_MAP[(colorName ?? "").toLowerCase()] ?? (colorName ?? "inherit");
      tokens.push(
        <span key={`${keyPrefix}-${key++}`} style={{ color }}>
          {renderInline(content ?? "", `${keyPrefix}-${key}c`)}
        </span>,
      );
      i += colorMatch[0].length;
      continue;
    }
    // 9. Size {size:large}text{/size}
    const sizeMatch = text.slice(i).match(/^\{size:([\w]+)\}([^{}\n]+?)\{\/size\}/);
    if (sizeMatch) {
      const [, sizeName, content] = sizeMatch;
      const fontSize = SIZE_MAP[(sizeName ?? "").toLowerCase()] ?? "1em";
      tokens.push(
        <span key={`${keyPrefix}-${key++}`} style={{ fontSize }}>
          {renderInline(content ?? "", `${keyPrefix}-${key}sz`)}
        </span>,
      );
      i += sizeMatch[0].length;
      continue;
    }
    // 10. Plain char — accumulate until next match
    // Avansăm un caracter, dar buffer-uim text-ul ca să-l adăugăm într-un
    // singur Fragment (mai puține key-uri React).
    let plainEnd = i + 1;
    while (plainEnd < text.length) {
      const ch = text[plainEnd];
      if (ch === "*" || ch === "~" || ch === "_" || ch === "=" || ch === "`" || ch === "[" || ch === "{") {
        break;
      }
      plainEnd++;
    }
    tokens.push(<Fragment key={`${keyPrefix}-${key++}`}>{text.slice(i, plainEnd)}</Fragment>);
    i = plainEnd;
  }

  return tokens;
}

/**
 * Render markdown content ca array de React block-level elements.
 * Splituim pe linii și apoi grupăm: listă consecutivă, paragraph, heading.
 */
export function renderMarkdown(content: string): React.ReactNode {
  if (!content) return null;
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    // Empty line → skip (paragraph break is automatic)
    if (!trimmed) {
      i++;
      continue;
    }

    // Heading: ### / ## / #
    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={`mb-${key++}`} className="font-[family-name:var(--font-sora)] text-lg md:text-xl font-bold mt-6 mb-3">
          {renderInline(trimmed.slice(4))}
        </h3>,
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={`mb-${key++}`} className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-bold mt-8 mb-4">
          {renderInline(trimmed.slice(3))}
        </h2>,
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1 key={`mb-${key++}`} className="font-[family-name:var(--font-sora)] text-2xl md:text-3xl font-bold mt-8 mb-4">
          {renderInline(trimmed.slice(2))}
        </h1>,
      );
      i++;
      continue;
    }

    // List — consume consecutive lines starting with `- `
    if (trimmed.startsWith("- ")) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && (lines[i]?.trim().startsWith("- ") ?? false)) {
        const itemText = (lines[i] ?? "").trim().slice(2);
        items.push(
          <li key={`li-${key++}`} className="leading-relaxed">
            {renderInline(itemText)}
          </li>,
        );
        i++;
      }
      blocks.push(
        <ul key={`mb-${key++}`} className="list-disc pl-6 space-y-2 my-4">
          {items}
        </ul>,
      );
      continue;
    }

    // Paragraph — consume consecutive non-empty non-heading lines
    const paragraphLines: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const next = (lines[i] ?? "").trim();
      if (!next) break;
      if (next.startsWith("#") || next.startsWith("- ")) break;
      paragraphLines.push(next);
      i++;
    }
    blocks.push(
      <p key={`mb-${key++}`} className="text-sm md:text-base leading-relaxed my-3">
        {paragraphLines.flatMap((ln, idx) => {
          const rendered = renderInline(ln, `p${key}-${idx}`);
          if (idx === paragraphLines.length - 1) return rendered;
          return [...rendered, <br key={`br-${key}-${idx}`} />];
        })}
      </p>,
    );
  }

  return <>{blocks}</>;
}
