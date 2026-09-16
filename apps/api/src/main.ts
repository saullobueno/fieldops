import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { parseServerEnv } from "@fieldops/config";

import { AppModule } from "./modules/app.module.js";

async function bootstrap(): Promise<void> {
  const env = parseServerEnv(process.env);
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.enableCors({
    credentials: true,
    origin: parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS)
  });

  await app.listen(resolveListenPort(env.API_PORT));
}

void bootstrap();

function parseAllowedOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveListenPort(defaultPort: number): number {
  if (!process.env.PORT) {
    return defaultPort;
  }

  const platformPort = Number(process.env.PORT);
  return Number.isInteger(platformPort) && platformPort > 0 ? platformPort : defaultPort;
}
