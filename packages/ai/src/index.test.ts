import { describe, expect, it } from "vitest";

import { copilotToolDefinitions, copilotToolNames } from "./index";

describe("copilotToolDefinitions", () => {
  it("define exatamente uma ferramenta para cada nome do conjunto fechado", () => {
    const definedNames = copilotToolDefinitions.map((tool) => tool.name).sort();
    expect(definedNames).toEqual([...copilotToolNames].sort());
  });

  it("toda ferramenta tem descrição e schema de entrada como objeto", () => {
    for (const tool of copilotToolDefinitions) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.additionalProperties).toBe(false);
    }
  });
});
