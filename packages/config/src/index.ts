import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);

export const serverEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  ATTACHMENT_STORAGE_ROOT: z.string().min(1).default("storage"),
  ATTACHMENT_URL_SECRET: z.string().min(16).default("fieldops-demo-secret"),
  CORS_ALLOWED_ORIGINS: z.string().min(1).default("http://localhost:3000,http://localhost:3001"),
  DATABASE_URL: z.string().url(),
  FIELDOPS_SESSION_SECRET: z.string().min(16).default("fieldops-demo-session-secret"),
  MAPS_PROVIDER_BASE_URL: z.string().url().optional().or(z.literal("")),
  REDIS_URL: z.string().url(),
  SENTRY_DSN: z.string().url().optional().or(z.literal(""))
});

export const webEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:4000")
});

export const mobileWebEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  MOBILE_WEB_PORT: z.coerce.number().int().positive().default(3001),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:4000")
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type MobileWebEnv = z.infer<typeof mobileWebEnvSchema>;

export function parseServerEnv(env: NodeJS.ProcessEnv): ServerEnv {
  return parseEnv(serverEnvSchema, env, "server");
}

export function parseWebEnv(env: NodeJS.ProcessEnv): WebEnv {
  return parseEnv(webEnvSchema, env, "web");
}

export function parseMobileWebEnv(env: NodeJS.ProcessEnv): MobileWebEnv {
  return parseEnv(mobileWebEnvSchema, env, "mobile-web");
}

function parseEnv<TSchema extends z.ZodType>(schema: TSchema, env: NodeJS.ProcessEnv, label: string): z.infer<TSchema> {
  const parsed = schema.safeParse(env);

  if (parsed.success) {
    return parsed.data;
  }

  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Configuração de ambiente inválida (${label}): ${issues}`);
}
