import { drizzle } from "drizzle-orm/node-postgres";
import { Redis } from "ioredis";
import pg from "pg";

import * as schema from "./schema.js";

const { Pool } = pg;

export type DatabaseClient = ReturnType<typeof drizzle>;
export type RedisClient = Redis;

export function createPostgresPool(connectionString: string): pg.Pool {
  return new Pool({
    connectionString,
    max: 10
  });
}

export function createDatabaseClient(pool: pg.Pool): DatabaseClient {
  return drizzle(pool, { schema });
}

export * from "./schema.js";

export function createRedisClient(redisUrl: string): RedisClient {
  return new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3
  });
}

export async function pingPostgres(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("select 1");
  } finally {
    client.release();
  }
}

export async function pingRedis(redis: RedisClient): Promise<void> {
  if (redis.status === "wait") {
    await redis.connect();
  }

  await redis.ping();
}
