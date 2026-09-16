import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { hashPassword } from "@fieldops/auth";
import type pg from "pg";
import { describe, expect, it, vi } from "vitest";

import { demoUsers } from "../users/users.demo-store.js";
import { AuthService } from "./auth.service.js";
import { computeCredentialFingerprint, createActionToken, parseActorFromHeaders } from "./auth.guard.js";
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

describe("Ciclo de vida de senha (sem Postgres configurado)", () => {
  const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

  function seedInvitedDemoUser(email: string): void {
    demoUsers.push({
      email,
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: "Convidado de teste",
      organizationId: DEMO_ORGANIZATION_ID,
      passwordHash: null,
      roleIds: ["00000000-0000-4000-8000-000000000103"],
      status: "invited"
    });
  }

  it("aceita um convite e devolve uma sessão válida", async () => {
    const email = `convite-${Date.now()}@acmefield.example`;
    seedInvitedDemoUser(email);
    const service = new AuthService();

    // Usuário ainda convidado (sem senha) não deve conseguir link de redefinição.
    const { resetToken } = await service.forgotPassword(email);
    expect(resetToken).toBeUndefined();

    const inviteToken = createInviteTokenFor(email);
    const result = await service.acceptInvite(inviteToken, "senha-nova-123");

    expect(result.actor.id).toBe(demoUsers.find((user) => user.email === email)?.id);

    // O mesmo token não pode ser reutilizado — o fingerprint mudou ao definir a senha.
    await expect(service.acceptInvite(inviteToken, "outra-senha-123")).rejects.toThrow(BadRequestException);
  });

  it("permite redefinir a senha de um usuário ativo e depois logar com a nova senha", async () => {
    const email = `reset-${Date.now()}@acmefield.example`;
    demoUsers.push({
      email,
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: "Ativo de teste",
      organizationId: DEMO_ORGANIZATION_ID,
      passwordHash: await hashPassword("senha-antiga-123"),
      roleIds: [],
      status: "active"
    });
    const service = new AuthService();

    const { resetToken } = await service.forgotPassword(email);
    expect(resetToken).toBeDefined();

    await service.resetPassword(resetToken!, "senha-nova-456");

    const result = await service.login(email, "senha-nova-456");
    expect(result.actor.organizationId).toBe(DEMO_ORGANIZATION_ID);
    await expect(service.login(email, "senha-antiga-123")).rejects.toThrow(UnauthorizedException);
  });

  it("não gera token de redefinição para email desconhecido", async () => {
    const service = new AuthService();

    const { resetToken } = await service.forgotPassword("ninguem-nesse-teste@acmefield.example");

    expect(resetToken).toBeUndefined();
  });

  it("troca a senha do próprio usuário autenticado", async () => {
    const email = `troca-${Date.now()}@acmefield.example`;
    const passwordHash = await hashPassword("senha-atual-123");
    demoUsers.push({
      email,
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: "Troca de teste",
      organizationId: DEMO_ORGANIZATION_ID,
      passwordHash,
      roleIds: [],
      status: "active"
    });
    const service = new AuthService();
    const actor = { ...(await service.login(email, "senha-atual-123")).actor };

    await service.changePassword(actor, "senha-atual-123", "senha-troca-456");

    await expect(service.login(email, "senha-atual-123")).rejects.toThrow(UnauthorizedException);
    const result = await service.login(email, "senha-troca-456");
    expect(result.actor.id).toBe(actor.id);
  });

  it("rejeita troca de senha com senha atual incorreta", async () => {
    const email = `troca-errada-${Date.now()}@acmefield.example`;
    demoUsers.push({
      email,
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: "Troca errada",
      organizationId: DEMO_ORGANIZATION_ID,
      passwordHash: await hashPassword("senha-certa-123"),
      roleIds: [],
      status: "active"
    });
    const service = new AuthService();
    const actor = (await service.login(email, "senha-certa-123")).actor;

    await expect(service.changePassword(actor, "senha-errada", "nova-senha-123")).rejects.toThrow(UnauthorizedException);
  });

  function createInviteTokenFor(email: string): string {
    const user = demoUsers.find((candidate) => candidate.email === email);
    if (!user) {
      throw new Error("Usuário demo não encontrado no teste.");
    }

    return createActionToken("invite", {
      fingerprint: computeCredentialFingerprint(user.id, user.passwordHash),
      organizationId: user.organizationId,
      userId: user.id
    });
  }
});
