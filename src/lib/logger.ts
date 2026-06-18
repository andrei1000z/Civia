// Thin logging wrapper. Silent in production so stdout stays clean —
// Sentry catches server errors via instrumentation.ts, and the browser
// console in prod is mostly noise for end users.
//
// Usage: `import { log } from "@/lib/logger"; log.warn("[email] send failed", { err })`
// The `tag` prefix convention ("[email]", "[sesizari]") keeps greppable context.

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getMinLevel(): number {
  const env = process.env.NODE_ENV;
  const override = process.env.LOG_LEVEL as LogLevel | undefined;
  if (override && override in LEVEL_WEIGHT) return LEVEL_WEIGHT[override];
  if (env === "production") return LEVEL_WEIGHT.warn;
  if (env === "test") return LEVEL_WEIGHT.error;
  return LEVEL_WEIGHT.debug;
}

function emit(level: LogLevel, args: unknown[]) {
  if (LEVEL_WEIGHT[level] < getMinLevel()) return;
  const fn =
    level === "error" ? console.error :
    level === "warn" ? console.warn :
    level === "info" ? console.info :
    console.debug;
  fn(...args);
}

export const log = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
