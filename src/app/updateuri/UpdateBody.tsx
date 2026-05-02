/**
 * Tiny markdown subset renderer for changelog entries. Parses:
 *   - paragraphs (blank-line separated)
 *   - "## Heading"
 *   - "- bullet" lists
 *   - **bold** spans
 *
 * Server component. No external deps. Same conventions the AI
 * synthesis renderer uses, so authors who write changelog entries
 * can rely on the same vocabulary.
 *
 * Anything more complex (tables, code blocks, links) currently
 * passes through as plain text — extend if needed.
 */

import { Fragment } from "react";

interface Props {
  markdown: string;
}

/**
 * Renders **bold** spans inside a string. Returns React children
 * that the caller can drop into a <p> / <li>.
 */
function renderInlineBold(text: string, keyPrefix: string): React.ReactNode {
  // Split on bold markers, keeping them so we can identify which
  // chunks were inside ** **. Even-index = plain, odd = bold.
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 0 ? (
      <Fragment key={`${keyPrefix}-${i}`}>{p}</Fragment>
    ) : (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-[var(--color-text)]">
        {p}
      </strong>
    ),
  );
}

interface Block {
  kind: "h2" | "p" | "ul";
  text?: string;
  items?: string[];
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];
  let buffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (buffer.length === 0) return;
    blocks.push({ kind: "p", text: buffer.join(" ").trim() });
    buffer = [];
  };
  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push({ kind: "ul", items: [...listBuffer] });
    listBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      listBuffer.push(line.replace(/^[-*]\s+/, "").trim());
      continue;
    }
    flushList();
    buffer.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function UpdateBody({ markdown }: Props) {
  const blocks = parseBlocks(markdown);
  return (
    <div className="space-y-3 text-sm md:text-[15px] text-[var(--color-text)] leading-relaxed">
      {blocks.map((b, i) => {
        if (b.kind === "h2") {
          return (
            <h3
              key={i}
              className="font-[family-name:var(--font-sora)] font-bold text-base md:text-lg mt-5 first:mt-0 text-[var(--color-text)]"
            >
              {renderInlineBold(b.text ?? "", `h2-${i}`)}
            </h3>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul
              key={i}
              className="list-none space-y-1.5 pl-0"
              role="list"
            >
              {(b.items ?? []).map((item, j) => (
                <li
                  key={j}
                  className="relative pl-5 text-[var(--color-text-muted)]"
                >
                  <span
                    className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"
                    aria-hidden="true"
                  />
                  {renderInlineBold(item, `li-${i}-${j}`)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[var(--color-text-muted)]">
            {renderInlineBold(b.text ?? "", `p-${i}`)}
          </p>
        );
      })}
    </div>
  );
}
