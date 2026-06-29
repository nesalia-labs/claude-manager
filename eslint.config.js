// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Root ESLint config (flat config, ESLint 9).
 * Each package extends this via its own `eslint.config.js` that imports and spreads it.
 */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.config.js",
    ],
  },
  {
    rules: {
      // Off by default — we need `any` for FFI and JSON parsing shapes.
      "@typescript-eslint/no-explicit-any": "off",
      // Allow underscore-prefixed unused args/vars (e.g. `_home`, `_event`,
      // `_error`). Conventional across many TS codebases.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      // Style nudges; tighten later if desired.
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
);