import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Guard against accidentally importing the service-role Supabase client
  // (which carries SUPABASE_SERVICE_ROLE_KEY) into any client component.
  // The service client may only be used from server-only modules:
  //   - src/app/api/**       (Route Handlers)
  //   - src/middlewares/**   (server-side guards)
  //   - src/modules/**       (domain services consumed by route handlers)
  //   - src/lib/**           (server helpers, e.g. lib/telegram.js)
  {
    files: ["src/components/**", "src/hooks/**", "src/store/**", "src/services/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/service",
              message:
                "The service-role Supabase client must never be imported into client code. Use @/lib/supabase/client or @/lib/supabase/server instead.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
