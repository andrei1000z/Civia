import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Legacy rule — React 19 handles these fine
      "react/no-unescaped-entities": "off",
      // Next-themes requires setMounted pattern; strict rule too aggressive
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      // Args/vars cu underscore prefix sunt convențional „intentionally
      // unused" (Sentry callbacks, signature-only params, etc.). ESLint
      // default warneste pe ele — dezactivăm warning-ul ca să fie clean.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      // Force all app code through src/lib/supabase/{client,server,admin}
      // wrappers — direct imports bypass the cookie + auth conventions
      // and bite us in subtle ways. Type-only imports are fine (e.g.
      // `import type { SupabaseClient } from "@supabase/supabase-js"`).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@supabase/ssr",
              importNames: [
                "createBrowserClient",
                "createServerClient",
              ],
              message:
                "Importă din @/lib/supabase/{client,server,admin} (AGENTS.md). Wrapper-ele au cookie + auth setup corect.",
            },
            {
              name: "@supabase/supabase-js",
              importNames: ["createClient"],
              message:
                "Importă din @/lib/supabase/{client,server,admin} (AGENTS.md). Direct usage bypasses wrappers.",
            },
          ],
        },
      ],
    },
  },
  // Wrappers themselves need direct access — exempt them.
  {
    files: ["src/lib/supabase/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
  ]),
]);

export default eslintConfig;
