import nextConfig from "eslint-config-next";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const nextRules = Array.isArray(nextConfig) ? nextConfig : [nextConfig];

const eslintConfig = [
  {
    ignores: [
      "**/.next/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "pnpm-lock.yaml",
      // Arquivos de configuração na raiz do workspace: eslint-config-next tenta
      // usar o parser Babel do pacote `next`, que só existe como dependência de
      // apps/web e apps/mobile-web, não da raiz — a resolução falha aqui.
      "eslint.config.mjs",
      "vitest.config.mts",
      "**/postcss.config.mjs"
    ]
  },
  ...nextRules,
  {
    settings: {
      next: {
        rootDir: ["apps/web/", "apps/mobile-web/"]
      },
      react: {
        version: "19.3.0"
      }
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off"
    }
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/require-await": "error"
    }
  }
];

export default eslintConfig;
