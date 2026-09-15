import { describe, expect, it } from "vitest";

import {
  authorizeObjectAccess,
  hashPassword,
  verifyPassword,
  type AuthenticatedActor,
  type OrganizationScopedResource
} from "./index";

describe("hashPassword/verifyPassword", () => {
  it("gera um hash verificável para a senha correta e rejeita senhas incorretas", async () => {
    const passwordHash = await hashPassword("demo1234");

    expect(passwordHash).not.toBe("demo1234");
    await expect(verifyPassword("demo1234", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("senha-errada", passwordHash)).resolves.toBe(false);
  });

  it("gera hashes diferentes para a mesma senha em chamadas distintas", async () => {
    const first = await hashPassword("demo1234");
    const second = await hashPassword("demo1234");

    expect(first).not.toBe(second);
  });
});

const actor: AuthenticatedActor = {
  id: "user-1",
  organizationId: "org-1",
  permissions: ["work_order:read"],
  roleIds: ["role-dispatcher"],
  teamIds: ["team-1"],
  territoryIds: ["territory-1"]
};

describe("authorizeObjectAccess", () => {
  it("permite acesso quando organização e equipe batem", () => {
    const resource: OrganizationScopedResource = {
      organizationId: "org-1",
      teamId: "team-1"
    };

    expect(authorizeObjectAccess(actor, "work_order:read", resource)).toEqual({
      allowed: true
    });
  });

  it("nega acesso entre organizações", () => {
    const resource: OrganizationScopedResource = {
      organizationId: "org-2",
      teamId: "team-1"
    };

    expect(authorizeObjectAccess(actor, "work_order:read", resource)).toMatchObject({
      allowed: false
    });
  });

  it("nega acesso sem permissão explícita", () => {
    const resource: OrganizationScopedResource = {
      organizationId: "org-1",
      teamId: "team-1"
    };

    expect(authorizeObjectAccess(actor, "work_order:update", resource)).toMatchObject({
      allowed: false
    });
  });
});
