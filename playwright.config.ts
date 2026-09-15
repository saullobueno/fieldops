import { defineConfig, devices } from "@playwright/test";

export const e2eBaseUrls = {
  api: "http://localhost:4000",
  mobileWeb: "http://localhost:3001",
  web: "http://localhost:3000"
};

/**
 * Usa as mesmas portas de `pnpm dev` (4000/3000/3001): os scripts `dev` de
 * `apps/web`/`apps/mobile-web` têm a porta do Next hardcoded no próprio
 * script (`next dev -p 3000`), então não dá para sobrepor via env var sem
 * duplicar os scripts. `reuseExistingServer` cobre o caso de já haver um
 * `pnpm dev` ativo (não inicia um segundo processo na mesma porta).
 */
export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: process.env.CI ? "dot" : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "./tests/e2e",
  use: {
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "pnpm --filter @fieldops/api dev",
      env: {
        // parseServerEnv exige essas variáveis para o boot, mesmo que os
        // serviços individuais caiam no fallback demo em memória quando a
        // conexão real falhar — não é preciso um Postgres/Redis de verdade
        // rodando para os testes E2E, que usam GET /health (liveness, sem
        // tocar no banco) como sinal de "servidor pronto".
        ATTACHMENT_URL_SECRET: "fieldops-e2e-secret-0123456789",
        DATABASE_URL: "postgres://fieldops:fieldops@localhost:5432/fieldops",
        FIELDOPS_SESSION_SECRET: "fieldops-e2e-session-secret-0123456789",
        REDIS_URL: "redis://localhost:6379"
      },
      reuseExistingServer: true,
      timeout: 60_000,
      url: `${e2eBaseUrls.api}/health`
    },
    {
      command: "pnpm --filter @fieldops/web dev",
      reuseExistingServer: true,
      timeout: 60_000,
      url: e2eBaseUrls.web
    },
    {
      command: "pnpm --filter @fieldops/mobile-web dev",
      reuseExistingServer: true,
      timeout: 60_000,
      url: e2eBaseUrls.mobileWeb
    }
  ]
});
