const LOCAL_WEB_BASE_URL = "http://localhost:3000";

export function resolveWebBaseUrl(): string {
  const explicitBaseUrl = normalizeOrigin(process.env.FIELDOPS_WEB_BASE_URL);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const publicAllowedOrigin = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .find((origin): origin is string => typeof origin === "string" && !isLocalOrigin(origin));

  return publicAllowedOrigin ?? LOCAL_WEB_BASE_URL;
}

function normalizeOrigin(origin: string | undefined): string | undefined {
  const normalized = origin?.trim().replace(/\/+$/, "");
  return normalized ? normalized : undefined;
}

function isLocalOrigin(origin: string): boolean {
  return origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("[::1]");
}
