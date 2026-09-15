import { describe, expect, it } from "vitest";

import { createDemoSeedStatements, demoIds, demoSeedSummary } from "./demo";

describe("createDemoSeedStatements", () => {
  it("gera statements determinísticos para o modo demo", () => {
    const firstRun = createDemoSeedStatements();
    const secondRun = createDemoSeedStatements();

    expect(firstRun).toEqual(secondRun);
    expect(firstRun.length).toBeGreaterThanOrEqual(10);
    expect(demoSeedSummary.organization).toBe("Acme Field Services");
    expect(Object.values(demoIds)).toContain("00000000-0000-4000-8000-000000000001");
  });
});
