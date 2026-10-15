import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const ADMIN = {
  group: ["@/lib/admin", "@/lib/admin/*", "@/components/admin", "@/components/admin/*"],
  message: "Admin-only code. Import it only from app/admin, app/api/admin, components/admin or lib/admin.",
};
const ADMIN_PLACES = ["app/admin/**", "app/api/admin/**", "components/admin/**", "lib/admin/**"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Outside the admin folders, admin modules may not be imported.
  {
    files: ["app/**", "components/**", "lib/**"],
    ignores: ADMIN_PLACES,
    rules: { "no-restricted-imports": ["error", { patterns: [ADMIN] }] },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees and design source files are not part of the app.
    ".claude/**",
    "design-assets/**",
  ]),
]);

export default eslintConfig;
