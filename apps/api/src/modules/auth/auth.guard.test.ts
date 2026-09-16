import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { AuthenticatedRequest } from "./auth.decorators.js";
import { SESSION_COOKIE_NAME, createSignedActorToken, parseActorFromHeaders } from "./auth.guard.js";

describe("parseActorFromHeaders", () => {
  it("cria um ator autenticado a partir dos headers validados", () => {
    const request = {
      headers: {
        "x-fieldops-organization-id": "org-1",
        "x-fieldops-permissions": "work_order:read,work_order:update,invalida",
        "x-fieldops-role-ids": "role-1",
        "x-fieldops-team-ids": "team-1",
        "x-fieldops-territory-ids": "territory-1",
        "x-fieldops-user-id": "user-1"
      }
    } as unknown as AuthenticatedRequest;

    expect(parseActorFromHeaders(request)).toEqual({
      id: "user-1",
      organizationId: "org-1",
      permissions: ["work_order:read", "work_order:update"],
      roleIds: ["role-1"],
      teamIds: ["team-1"],
      territoryIds: ["territory-1"]
    });
  });

  it("rejeita requests sem ator", () => {
    const request = { headers: {} } as unknown as AuthenticatedRequest;

    expect(() => parseActorFromHeaders(request)).toThrow(UnauthorizedException);
  });

  it("aceita bearer token assinado para sessão do ator", () => {
    const token = createSignedActorToken(
      {
        id: "user-1",
        organizationId: "org-1",
        permissions: ["notification:read"],
        roleIds: ["role-1"],
        teamIds: [],
        territoryIds: []
      },
      "test-secret"
    );
    process.env.FIELDOPS_SESSION_SECRET = "test-secret";
    const request = {
      headers: { authorization: `Bearer ${token}` }
    } as unknown as AuthenticatedRequest;

    expect(parseActorFromHeaders(request)).toMatchObject({
      id: "user-1",
      organizationId: "org-1",
      permissions: ["notification:read"]
    });
  });

  it("aceita token de sessão via cookie httpOnly", () => {
    process.env.FIELDOPS_SESSION_SECRET = "test-secret";
    const token = createSignedActorToken(
      {
        id: "user-1",
        organizationId: "org-1",
        permissions: ["notification:read"],
        roleIds: [],
        teamIds: [],
        territoryIds: []
      },
      "test-secret"
    );
    const request = {
      headers: { cookie: `outro=valor; ${SESSION_COOKIE_NAME}=${token}` }
    } as unknown as AuthenticatedRequest;

    expect(parseActorFromHeaders(request)).toMatchObject({
      id: "user-1",
      organizationId: "org-1",
      permissions: ["notification:read"]
    });
  });

  it("rejeita token de sessão expirado", () => {
    process.env.FIELDOPS_SESSION_SECRET = "test-secret";
    const originalNow = Date.now;
    Date.now = () => 0;
    const token = createSignedActorToken(
      {
        id: "user-1",
        organizationId: "org-1",
        permissions: [],
        roleIds: [],
        teamIds: [],
        territoryIds: []
      },
      "test-secret"
    );
    Date.now = originalNow;

    const request = {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` }
    } as unknown as AuthenticatedRequest;

    expect(() => parseActorFromHeaders(request)).toThrow(UnauthorizedException);
  });
});
