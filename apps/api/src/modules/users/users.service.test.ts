import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type pg from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoUsers } from "./users.demo-store.js";
import { UsersService } from "./users.service.js";

const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

describe("UsersService (sem Postgres configurado)", () => {
  // `demoUsers` é um módulo compartilhado (mesmo estado entre testes no mesmo
  // worker) — cada teste convida um email único para não colidir com outros
  // arquivos de teste que também leem esse estado (ex.: auth.service.test.ts).
  function uniqueEmail(label: string): string {
    return `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@acmefield.example`;
  }

  it("lista os usuários semeados da organização", async () => {
    const service = new UsersService();

    const users = await service.list(DEMO_ORGANIZATION_ID);

    expect(users.some((user) => user.email === "admin@acmefield.example" && user.status === "active")).toBe(true);
  });

  it("lista os papéis demo disponíveis", async () => {
    const service = new UsersService();

    const roles = await service.listRoles(DEMO_ORGANIZATION_ID);

    expect(roles.map((role) => role.name)).toContain("Administrador");
  });

  it("convida um novo usuário e devolve um link de convite", async () => {
    const service = new UsersService();
    const email = uniqueEmail("convite");

    const result = await service.invite({
      email,
      name: "Novo Usuário",
      organizationId: DEMO_ORGANIZATION_ID,
      roleIds: ["00000000-0000-4000-8000-000000000103"]
    });

    expect(result.user.status).toBe("invited");
    expect(result.user.roles.map((role) => role.name)).toEqual(["Técnico"]);
    expect(result.inviteLink).toContain("/convite?token=");
  });

  it("rejeita convite para um email já existente", async () => {
    const service = new UsersService();

    await expect(
      service.invite({
        email: "admin@acmefield.example",
        name: "Duplicado",
        organizationId: DEMO_ORGANIZATION_ID,
        roleIds: []
      })
    ).rejects.toThrow(ConflictException);
  });

  it("reenvia convite só para usuário ainda convidado", async () => {
    const service = new UsersService();
    const email = uniqueEmail("reenvio");
    const invited = await service.invite({
      email,
      name: "Pendente",
      organizationId: DEMO_ORGANIZATION_ID,
      roleIds: []
    });

    const resent = await service.resendInvite(DEMO_ORGANIZATION_ID, invited.user.id);
    expect(resent.inviteLink).toContain("/convite?token=");

    await expect(service.resendInvite(DEMO_ORGANIZATION_ID, "id-inexistente")).rejects.toThrow(NotFoundException);
  });

  it("desativa e reativa um usuário ativo", async () => {
    const service = new UsersService();
    const email = uniqueEmail("ciclo");
    const invited = await service.invite({
      email,
      name: "Ciclo de vida",
      organizationId: DEMO_ORGANIZATION_ID,
      roleIds: []
    });
    const demoUser = demoUsers.find((user) => user.id === invited.user.id);
    if (demoUser) {
      demoUser.status = "active";
    }

    const disabled = await service.setStatus(DEMO_ORGANIZATION_ID, invited.user.id, "disabled");
    expect(disabled.status).toBe("disabled");

    const reactivated = await service.setStatus(DEMO_ORGANIZATION_ID, invited.user.id, "active");
    expect(reactivated.status).toBe("active");
  });

  it("rejeita reativar um usuário que já está ativo", async () => {
    const service = new UsersService();

    await expect(service.setStatus(DEMO_ORGANIZATION_ID, "00000000-0000-4000-8000-000000000011", "active")).rejects.toThrow(
      BadRequestException
    );
  });
});

describe("UsersService (com Postgres configurado)", () => {
  let queries: string[];
  let pool: pg.Pool;

  beforeEach(() => {
    queries = [];
    const client = {
      query: vi.fn((sql: string) => {
        queries.push(sql);
        if (sql.includes("insert into users")) {
          return { rows: [{ id: "user-db-1" }] };
        }
        return { rows: [] };
      }),
      release: vi.fn()
    };

    pool = {
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn((sql: string) => {
        queries.push(sql);
        if (sql.includes("from roles")) {
          return { rows: [{ id: "role-1", name: "Despachante" }] };
        }
        return { rows: [] };
      })
    } as unknown as pg.Pool;
  });

  it("insere o usuário e os papéis dentro de uma transação", async () => {
    const service = new UsersService(pool);

    const result = await service.invite({
      email: "novo@empresa.example",
      name: "Novo",
      organizationId: "org-1",
      roleIds: ["role-1"]
    });

    expect(result.user.id).toBe("user-db-1");
    expect(queries.some((sql) => sql.includes("begin"))).toBe(true);
    expect(queries.some((sql) => sql.includes("insert into user_roles"))).toBe(true);
    expect(queries.some((sql) => sql.includes("commit"))).toBe(true);
  });
});
