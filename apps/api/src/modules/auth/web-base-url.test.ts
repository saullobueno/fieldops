import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveWebBaseUrl } from "./web-base-url.js";

describe("resolveWebBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prioriza FIELDOPS_WEB_BASE_URL quando configurada", () => {
    vi.stubEnv("FIELDOPS_WEB_BASE_URL", "https://fieldops-web.vercel.app/");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://outra-origem.example");

    expect(resolveWebBaseUrl()).toBe("https://fieldops-web.vercel.app");
  });

  it("usa a primeira origem pública do CORS quando a base web explícita não existe", () => {
    vi.stubEnv("FIELDOPS_WEB_BASE_URL", "");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000, https://fieldops-web.vercel.app");

    expect(resolveWebBaseUrl()).toBe("https://fieldops-web.vercel.app");
  });

  it("mantém localhost como fallback local", () => {
    vi.stubEnv("FIELDOPS_WEB_BASE_URL", "");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001");

    expect(resolveWebBaseUrl()).toBe("http://localhost:3000");
  });
});
