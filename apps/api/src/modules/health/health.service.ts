import { Inject, Injectable } from "@nestjs/common";
import type { HealthCheck, HealthStatus } from "@fieldops/types";
import { pingPostgres, pingRedis, type RedisClient } from "@fieldops/database";
import type pg from "pg";

import { POSTGRES_POOL, REDIS_CLIENT } from "../infrastructure/infrastructure.module.js";

export interface DependencyReadiness {
  database: HealthStatus;
  redis: HealthStatus;
}

export interface ReadinessCheck extends HealthCheck {
  dependencies: DependencyReadiness;
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(POSTGRES_POOL) private readonly postgresPool: pg.Pool,
    @Inject(REDIS_CLIENT) private readonly redisClient: RedisClient
  ) {}

  liveness(): HealthCheck {
    return {
      checkedAt: new Date().toISOString(),
      service: "fieldops-api",
      status: "ok"
    };
  }

  async readiness(): Promise<ReadinessCheck> {
    const [database, redis] = await Promise.all([
      this.checkDependency(() => pingPostgres(this.postgresPool)),
      this.checkDependency(() => pingRedis(this.redisClient))
    ]);

    return {
      checkedAt: new Date().toISOString(),
      dependencies: {
        database,
        redis
      },
      service: "fieldops-api",
      status: database === "ok" && redis === "ok" ? "ok" : "degraded"
    };
  }

  private async checkDependency(ping: () => Promise<void>): Promise<HealthStatus> {
    try {
      await ping();
      return "ok";
    } catch {
      return "degraded";
    }
  }
}
