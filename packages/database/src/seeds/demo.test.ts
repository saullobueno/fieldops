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

  it("mantém placeholders SQL compatíveis com o número de valores", () => {
    for (const [index, statement] of createDemoSeedStatements().entries()) {
      const placeholders = [...statement.text.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
      const maxPlaceholder = Math.max(...placeholders, 0);

      if (maxPlaceholder !== statement.values.length) {
        throw new Error(
          `Statement ${index} tem ${maxPlaceholder} placeholders e ${statement.values.length} valores: ${statement.text}`
        );
      }
    }
  });
});
