import { describe, expect, it } from "vitest";
import type { RedisClient } from "@fieldops/database";
import type pg from "pg";

import { HealthService } from "./health.service.js";

describe("HealthService", () => {
  it("returns liveness without infrastructure access", () => {
    const postgresPool = {} as unknown as pg.Pool;
    const redisClient = {} as unknown as RedisClient;
    const service = new HealthService(postgresPool, redisClient);

    expect(service.liveness()).toMatchObject({
      service: "fieldops-api",
      status: "ok"
    });
  });
});
