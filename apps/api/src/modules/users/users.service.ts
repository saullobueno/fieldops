import { randomUUID } from "node:crypto";

import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { NamedOption, UserAccountSummary } from "@fieldops/types";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";
import { computeCredentialFingerprint, createActionToken } from "../auth/auth.guard.js";
import { resolveWebBaseUrl } from "../auth/web-base-url.js";
import { demoRoleOptions, demoUsers, findDemoUserByEmail, findDemoUserById } from "./users.demo-store.js";

export interface InviteUserInput {
  readonly organizationId: string;
  readonly email: string;
  readonly name: string;
  readonly roleIds: readonly string[];
}

export interface InviteUserResult {
  readonly user: UserAccountSummary;
  readonly inviteLink: string;
}

interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly status: UserAccountSummary["status"];
  readonly roles: readonly NamedOption[] | null;
}

@Injectable()
export class UsersService {
  constructor(@Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool) {}

  async list(organizationId: string): Promise<readonly UserAccountSummary[]> {
    if (!this.postgresPool) {
      return demoUsers
        .filter((user) => user.organizationId === organizationId)
        .map((user) => toDemoSummary(user));
    }

    try {
      const result = await this.postgresPool.query<UserRow>(
        `select
           u.id,
           u.email,
           u.name,
           u.status,
           coalesce(
             json_agg(json_build_object('id', r.id, 'name', r.name)) filter (where r.id is not null),
             '[]'
           ) as roles
         from users u
         left join user_roles ur on ur.user_id = u.id
         left join roles r on r.id = ur.role_id
         where u.organization_id = $1
         group by u.id
         order by u.name asc`,
        [organizationId]
      );

      return result.rows.map((row) => ({
        email: row.email,
        id: row.id,
        name: row.name,
        roles: row.roles ?? [],
        status: row.status
      }));
    } catch {
      return demoUsers
        .filter((user) => user.organizationId === organizationId)
        .map((user) => toDemoSummary(user));
    }
  }

  async listRoles(organizationId: string): Promise<readonly NamedOption[]> {
    if (!this.postgresPool) {
      return demoRoleOptions;
    }

    try {
      const result = await this.postgresPool.query<NamedOption>(
        `select id, name from roles where organization_id = $1 order by name asc`,
        [organizationId]
      );

      return result.rows;
    } catch {
      return demoRoleOptions;
    }
  }

  async invite(input: InviteUserInput): Promise<InviteUserResult> {
    if (!this.postgresPool) {
      return inviteInMemory(input);
    }

    try {
      return await this.inviteInDatabase(this.postgresPool, input);
    } catch (error) {
      // ConflictException aqui significa que o Postgres respondeu de verdade
      // (email duplicado é uma regra de negócio, não uma falha técnica) —
      // só cai no fallback demo para falhas técnicas de conexão/consulta,
      // no mesmo espírito do restante do projeto (ex.: CustomersService).
      if (error instanceof ConflictException) {
        throw error;
      }
      return inviteInMemory(input);
    }
  }

  private async inviteInDatabase(pool: pg.Pool, input: InviteUserInput): Promise<InviteUserResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const client = await pool.connect();
    try {
      await client.query("begin");

      const insertResult = await client.query<{ id: string }>(
        `insert into users (organization_id, email, name, status)
         values ($1, $2, $3, 'invited')
         returning id`,
        [input.organizationId, normalizedEmail, input.name]
      );
      const userId = insertResult.rows[0]?.id;

      if (!userId) {
        throw new Error("Falha ao criar usuário convidado.");
      }

      if (input.roleIds.length > 0) {
        const values = input.roleIds.map((_, index) => `($1, $${index + 2})`).join(", ");
        await client.query(`insert into user_roles (user_id, role_id) values ${values}`, [userId, ...input.roleIds]);
      }

      await client.query("commit");

      const roles = await this.listRoles(input.organizationId);
      const invitedRoles = roles.filter((role) => input.roleIds.includes(role.id));

      return {
        inviteLink: buildInviteLink(userId, input.organizationId, null),
        user: { email: normalizedEmail, id: userId, name: input.name, roles: invitedRoles, status: "invited" }
      };
    } catch (error) {
      await client.query("rollback");
      if (isUniqueViolation(error)) {
        throw new ConflictException("Já existe um usuário com este email.");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async resendInvite(organizationId: string, userId: string): Promise<{ inviteLink: string }> {
    if (!this.postgresPool) {
      return resendInviteInMemory(organizationId, userId);
    }

    try {
      const result = await this.postgresPool.query<{ status: string; password_hash: string | null }>(
        `select status, password_hash from users where id = $1 and organization_id = $2`,
        [userId, organizationId]
      );
      const user = result.rows[0];

      if (!user) {
        throw new NotFoundException("Usuário não encontrado.");
      }
      if (user.status !== "invited") {
        throw new BadRequestException("Só é possível reenviar convite para um usuário ainda não ativado.");
      }

      return { inviteLink: buildInviteLink(userId, organizationId, user.password_hash) };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      return resendInviteInMemory(organizationId, userId);
    }
  }

  async setStatus(
    organizationId: string,
    userId: string,
    nextStatus: "active" | "disabled"
  ): Promise<UserAccountSummary> {
    if (!this.postgresPool) {
      return setStatusInMemory(organizationId, userId, nextStatus);
    }

    try {
      return await this.setStatusInDatabase(this.postgresPool, organizationId, userId, nextStatus);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      return setStatusInMemory(organizationId, userId, nextStatus);
    }
  }

  private async setStatusInDatabase(
    pool: pg.Pool,
    organizationId: string,
    userId: string,
    nextStatus: "active" | "disabled"
  ): Promise<UserAccountSummary> {
    const requiredCurrentStatus = nextStatus === "active" ? "disabled" : "active";
    const invalidTransitionMessage =
      nextStatus === "active"
        ? "Só é possível reativar um usuário desativado."
        : "Só é possível desativar um usuário ativo.";

    const result = await pool.query<UserRow>(
      `update users set status = $1
       where id = $2 and organization_id = $3 and status = $4
       returning id, email, name, status`,
      [nextStatus, userId, organizationId, requiredCurrentStatus]
    );
    const updated = result.rows[0];

    if (!updated) {
      throw new BadRequestException(invalidTransitionMessage);
    }

    const roles = await pool.query<NamedOption>(
      `select r.id, r.name
       from user_roles ur
       join roles r on r.id = ur.role_id
       where ur.user_id = $1`,
      [userId]
    );

    return { email: updated.email, id: updated.id, name: updated.name, roles: roles.rows, status: updated.status };
  }
}

function inviteInMemory(input: InviteUserInput): InviteUserResult {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (findDemoUserByEmail(normalizedEmail)) {
    throw new ConflictException("Já existe um usuário com este email.");
  }

  const user = {
    email: normalizedEmail,
    id: randomUUID(),
    name: input.name,
    organizationId: input.organizationId,
    passwordHash: null,
    roleIds: [...input.roleIds],
    status: "invited" as const
  };
  demoUsers.push(user);

  return { inviteLink: buildInviteLink(user.id, user.organizationId, null), user: toDemoSummary(user) };
}

function resendInviteInMemory(organizationId: string, userId: string): { inviteLink: string } {
  const user = findDemoUserById(userId);
  if (!user || user.organizationId !== organizationId) {
    throw new NotFoundException("Usuário não encontrado.");
  }
  if (user.status !== "invited") {
    throw new BadRequestException("Só é possível reenviar convite para um usuário ainda não ativado.");
  }

  return { inviteLink: buildInviteLink(user.id, user.organizationId, user.passwordHash) };
}

function setStatusInMemory(
  organizationId: string,
  userId: string,
  nextStatus: "active" | "disabled"
): UserAccountSummary {
  const requiredCurrentStatus = nextStatus === "active" ? "disabled" : "active";
  const user = findDemoUserById(userId);
  if (!user || user.organizationId !== organizationId) {
    throw new NotFoundException("Usuário não encontrado.");
  }
  if (user.status !== requiredCurrentStatus) {
    throw new BadRequestException(
      nextStatus === "active"
        ? "Só é possível reativar um usuário desativado."
        : "Só é possível desativar um usuário ativo."
    );
  }

  user.status = nextStatus;
  return toDemoSummary(user);
}

function toDemoSummary(user: {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly status: UserAccountSummary["status"];
  readonly roleIds: readonly string[];
}): UserAccountSummary {
  return {
    email: user.email,
    id: user.id,
    name: user.name,
    roles: demoRoleOptions.filter((role) => user.roleIds.includes(role.id)),
    status: user.status
  };
}

function buildInviteLink(userId: string, organizationId: string, currentPasswordHash: string | null): string {
  const token = createActionToken("invite", {
    fingerprint: computeCredentialFingerprint(userId, currentPasswordHash),
    organizationId,
    userId
  });

  return `${resolveWebBaseUrl()}/convite?token=${token}`;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}
