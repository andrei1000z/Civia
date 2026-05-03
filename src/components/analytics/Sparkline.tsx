/**
 * Mini-grafic SVG (sparkline) pentru afișarea trendului unei valori
 * lângă cifra principală în dashboard. ~80×24px, nici un library extern.
 *
 * Folosit pe /admin/analytics ca să vezi „DAU 247 ↗" cu trend vizual al
 * ultimelor 7 zile, fără să faci click pe alt grafic detaliat.
 *
 * Design: linie cu fill subtil sub ea (gradient), ultim punct evidențiat
 * cu cerc mic. Culoare derivată din variant.
 */

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Culoare semantica: emerald = creștere bună, rose = în scădere,
   *  primary = neutru. */
  variant?: "primary" | "success" | "danger" | "warning";
  /** Title pentru tooltip native browser. Apare la hover. */
  title?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  variant = "primary",
  title,
}: SparklineProps) {
  if (data.length < 2) {
    // Cu 0 sau 1 punct nu putem desena trend — randăm un placeholder gri.
    return (
      <span
        className="inline-block bg-[var(--color-surface-2)] rounded"
        style={{ width, height }}
        aria-hidden="true"
        title={title}
      />
    );
  }

  const colors = {
    primary: { stroke: "var(--color-primary)", fill: "var(--color-primary)" },
    success: { stroke: "#10b981", fill: "#10b981" },
    danger: { stroke: "#e11d48", fill: "#e11d48" },
    warning: { stroke: "#f59e0b", fill: "#f59e0b" },
  }[variant];

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    // Y inversat — în SVG 0 e sus
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y] as const;
  });

  const pathLine = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`)
    .join(" ");
  // Path pentru fill — închide forma sub linie
  const pathFill = `${pathLine} L${width.toFixed(2)},${height} L0,${height} Z`;

  const last = points[points.length - 1]!;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title ?? `Trend ${data.length} puncte`}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`sparkfill-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.fill} stopOpacity="0.25" />
          <stop offset="100%" stopColor={colors.fill} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathFill} fill={`url(#sparkfill-${variant})`} />
      <path
        d={pathLine}
        fill="none"
        stroke={colors.stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2" fill={colors.stroke} />
    </svg>
  );
}
