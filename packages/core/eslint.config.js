// @ts-check
import rootConfig from "../../eslint.config.js";

/**
 * Package-level ESLint config for @claude-manager/core.
 *
 * Adds the **domain purity** rules: anything under `src/domain/**` may NOT
 * import `node:fs`, `node:os`, `node:child_process`, `node:process`, or any
 * sibling `sources/**` module. This keeps the pure core testable without
 * mocking the filesystem or the OS.
 */
export default [
  ...rootConfig,
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    rules: {},
  },
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      // Pure functions only — no I/O, no clock, no environment reads.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "node:fs",
                "node:fs/*",
                "node:os",
                "node:os/*",
                "node:child_process",
                "node:process",
                "**/sources/**",
                "../../sources/**",
              ],
              message:
                "src/domain/ is pure — no I/O. Move logic to sources/ or accept values as parameters.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: "Do not call Date.now() in domain — take a `nowMs: number` parameter.",
        },
        {
          selector: "MemberExpression[object.name='process']",
          message: "Do not read process.env in domain — take values as parameters or use sources/env.",
        },
      ],
    },
  },
];