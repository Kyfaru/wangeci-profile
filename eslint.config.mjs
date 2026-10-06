import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Fixture modules are for tests and the seed script only. Production code must not import
// them. These files still use the catalogue fixture until Phase 2 replaces it with the database.
const LEGACY_FIXTURE_USERS = [
  "app/(marketing)/store/**",
  "app/api/books/**",
  "app/api/search/**",
  "app/(dashboard)/dashboard/books/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**", "components/**", "lib/**"],
    ignores: ["lib/mock-*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["**/mock-*"], message: "Fixtures are for tests and seeding only. Read the database instead." }] },
      ],
    },
  },
  { files: LEGACY_FIXTURE_USERS, rules: { "no-restricted-imports": "off" } }, // TODO(phase-2): remove this override
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
