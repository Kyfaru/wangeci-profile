import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const MOCK = { group: ["**/mock-*"], message: "Fixtures are for tests and seeding only. Read the database instead." };
const ADMIN = {
  group: ["@/lib/admin", "@/lib/admin/*", "@/components/admin", "@/components/admin/*"],
  message: "Admin-only code. Import it only from app/admin, app/api/admin, components/admin or lib/admin.",
};
const ADMIN_PLACES = ["app/admin/**", "app/api/admin/**", "components/admin/**", "lib/admin/**"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Everywhere: no fixtures in production code.
  {
    files: ["app/**", "components/**", "lib/**"],
    ignores: ["lib/mock-*.ts", ...ADMIN_PLACES],
    rules: { "no-restricted-imports": ["error", { patterns: [MOCK, ADMIN] }] },
  },
  // Inside the admin folders the admin modules may be used, but fixtures still may not.
  {
    files: ADMIN_PLACES,
    rules: { "no-restricted-imports": ["error", { patterns: [MOCK] }] },
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
