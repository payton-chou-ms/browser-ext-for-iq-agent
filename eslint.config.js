import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,

  // ── TypeScript files ──
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ["**/*.ts"],
  })),
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-unused-vars": "off",
    },
  },

  // ── Node files (proxy, config, scripts) ──
  {
    files: ["proxy.js", "copilot-rpc.js", "playwright.config.js", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },

  // ── Background service worker ──
  {
    files: ["background.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.serviceworker,
        chrome: "readonly",
        importScripts: "readonly",
        COPILOT_RPC: "readonly",
      },
    },
  },

  // ── Browser extension files ──
  {
    files: ["sidebar.js", "content_script.js", "achievement-engine.js", "lib/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        chrome: "readonly",
        AchievementEngine: "writable",
      },
    },
    rules: {
      "no-redeclare": ["error", { builtinGlobals: false }],
    },
  },

  // ── Playwright tests (page.evaluate uses browser globals) ──
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        // page.evaluate() callbacks run in browser context
        document: "readonly",
        window: "readonly",
      },
    },
  },

  // ── Shared rules (JS only — TS has its own) ──
  {
    files: ["**/*.js", "**/*.mjs"],
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-constant-condition": "warn",
      "no-debugger": "warn",
      "no-empty": "warn",
      "no-undef": "error",
      "no-useless-assignment": "warn",
      "no-useless-escape": "warn",
      "prefer-const": "warn",
      eqeqeq: ["warn", "smart"],
    },
  },

  // ── Ignores ──
  {
    ignores: [
      "node_modules/",
      "dist/",
      "playwright-report/",
      "test-results/",
      "achievement-engine.js",
    ],
  },
];
