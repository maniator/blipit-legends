import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  // Ignore generated and dependency directories
  { ignores: ["dist/**", "node_modules/**", ".vite/**"] },

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // React flat-config recommended rules
  react.configs.flat.recommended,

  // Project-wide rules
  {
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "simple-import-sort": simpleImportSort,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // React
      "react/react-in-jsx-scope": "off", // Not needed with React 17+ JSX transform
      "react/prop-types": "off", // TypeScript covers this

      // React Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Import / export ordering
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            // Side-effect imports (e.g. CSS)
            ["^\\u0000"],
            // React packages first
            ["^react$", "^react-dom(/.*)?", "^react/"],
            // Other external packages
            ["^@?\\w"],
            // Internal aliases
            ["^@(components|context|hooks|utils|constants|storage|test)(/|$)"],
            // Relative imports
            ["^\\."],
          ],
        },
      ],
      "simple-import-sort/exports": "error",

      // TypeScript
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // General
      "no-console": "warn",

      // Deprecated shim guard: import sanctionedWrite from the canonical path only.
      // TODO(League Mode v2 cleanup): remove this rule once the shim file is deleted.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@feat/league/storage/sanctionedWrite",
              message:
                "Import from @storage/sanctionedWrite instead. The @feat/league/storage/sanctionedWrite shim is deprecated.",
            },
          ],
        },
      ],
    },
  },

  // Relax rules for test files
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
    },
  },

  // E2E Playwright tests — Node.js environment, no React rules
  {
    files: ["e2e/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
    },
  },

  // logger.ts intentionally uses console — it IS the logging abstraction
  {
    files: ["src/shared/utils/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // Service worker: add service-worker globals
  {
    files: ["src/sw.ts"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.serviceworker },
    },
  },

  // Prettier (must be last – disables all conflicting formatting rules)
  prettierRecommended,
);
