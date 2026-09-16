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
    origin: [/^http:\/\/localhost:3000$/, /^http:\/\/localhost:3001$/]
  });

  await app.listen(env.API_PORT);
}

void bootstrap();
