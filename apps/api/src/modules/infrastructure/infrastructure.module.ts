import { Module } from "@nestjs/common";
import { parseServerEnv } from "@fieldops/config";
import {
  createPostgresPool,
  createRedisClient,
  type RedisClient
} from "@fieldops/database";
import type pg from "pg";

export const POSTGRES_POOL = Symbol("POSTGRES_POOL");
export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

@Module({
  providers: [
    {
      provide: POSTGRES_POOL,
      useFactory: (): pg.Pool => {
        const env = parseServerEnv(process.env);
        return createPostgresPool(env.DATABASE_URL);
      }
    },
    {
      provide: REDIS_CLIENT,
      useFactory: (): RedisClient => {
        const env = parseServerEnv(process.env);
        return createRedisClient(env.REDIS_URL);
      }
    }
  ],
  exports: [POSTGRES_POOL, REDIS_CLIENT]
})
export class InfrastructureModule {}
