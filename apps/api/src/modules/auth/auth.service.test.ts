import { UnauthorizedException } from "@nestjs/common";
import { hashPassword } from "@fieldops/auth";
import type pg from "pg";
import { describe, expect, it, vi } from "vitest";

import { AuthService } from "./auth.service.js";
import { parseActorFromHeaders } from "./auth.guard.js";
import type { AuthenticatedRequest } from "./auth.decorators.js";

function bearerRequest(token: string): AuthenticatedRequest {
  return { headers: { authorization: `Bearer ${token}` } } as unknown as AuthenticatedRequest;
}

describe("AuthService (sem Postgres configurado)", () => {
  it("autentica um usuário demo com a senha correta e retorna um token de sessão válido", async () => {
    const service = new AuthService();

    const result = await service.login("admin@acmefield.example", "demo1234");

    expect(result.actor.id).toBe("00000000-0000-4000-8000-000000000011");
    expect(result.actor.permissions).toContain("admin:manage_roles");
    expect(parseActorFromHeaders(bearerRequest(result.token))).toMatchObject({ id: result.actor.id });
  });

  it("é case-insensitive e ignora espaços no email", async () => {
    const service = new AuthService();

    const result = await service.login("  Ana@AcmeField.example ", "demo1234");

    expect(result.actor.id).toBe("00000000-0000-4000-8000-000000000012");
  });

  it("rejeita senha incorreta para um email demo válido", async () => {
    const service = new AuthService();

    await expect(service.login("admin@acmefield.example", "senha-errada")).rejects.toThrow(UnauthorizedException);
  });

  it("rejeita email desconhecido", async () => {
    const service = new AuthService();

    await expect(service.login("ninguem@acmefield.example", "demo1234")).rejects.toThrow(UnauthorizedException);
  });
});

describe("AuthService (com Postgres configurado)", () => {
  function createPoolMock(passwordHash: string): pg.Pool {
    const query = vi.fn((sql: string) => {
      if (sql.includes("from users")) {
        return {
          rows: [
            {
              id: "user-db-1",
              organization_id: "org-db-1",
              password_hash: passwordHash,
              status: "active"
            }
          ]
        };
      }

      if (sql.includes("from user_roles")) {
        return { rows: [{ permissions: ["work_order:read", "work_order:update"], role_id: "role-db-1" }] };
      }

      if (sql.includes("from team_members")) {
        return { rows: [{ team_id: "team-db-1", territory_id: "territory-db-1" }] };
      }

      if (sql.includes("from technician_profiles")) {
        return { rows: [] };
      }

      throw new Error(`Query inesperada no teste: ${sql}`);
    });

    return { query } as unknown as pg.Pool;
  }

  it("autentica contra o banco e resolve permissões/equipes/territórios", async () => {
    const passwordHash = await hashPassword("senha-real-123");
    const pool = createPoolMock(passwordHash);
    const service = new AuthService(pool);

    const result = await service.login("pessoa@empresa.example", "senha-real-123");

    expect(result.actor).toEqual({
      id: "user-db-1",
      organizationId: "org-db-1",
      permissions: ["work_order:read", "work_order:update"],
      roleIds: ["role-db-1"],
      teamIds: ["team-db-1"],
      territoryIds: ["territory-db-1"]
    });
  });

  it("rejeita senha incorreta contra o banco sem cair no fallback demo", async () => {
    const passwordHash = await hashPassword("senha-real-123");
    const pool = createPoolMock(passwordHash);
    const service = new AuthService(pool);

    await expect(service.login("pessoa@empresa.example", "senha-errada")).rejects.toThrow(UnauthorizedException);
  });

  it("cai no fallback demo quando a consulta ao banco falha tecnicamente", async () => {
    const pool = { query: vi.fn().mockRejectedValue(new Error("connection refused")) } as unknown as pg.Pool;
    const service = new AuthService(pool);

    const result = await service.login("bruno@acmefield.example", "demo1234");

    expect(result.actor.id).toBe("00000000-0000-4000-8000-000000000013");
  });
});
