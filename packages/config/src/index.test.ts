import { describe, expect, it } from "vitest";

import { parseServerEnv } from "./index";

describe("parseServerEnv", () => {
  it("validates and coerces server environment values", () => {
    expect(
      parseServerEnv({
        API_PORT: "4100",
        DATABASE_URL: "postgres://fieldops:fieldops@localhost:5432/fieldops",
        REDIS_URL: "redis://localhost:6379"
      })
    ).toMatchObject({
      API_PORT: 4100,
      DATABASE_URL: "postgres://fieldops:fieldops@localhost:5432/fieldops",
      NODE_ENV: "development",
      REDIS_URL: "redis://localhost:6379"
    });
  });
});
