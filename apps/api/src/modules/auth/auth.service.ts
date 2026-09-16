import { BadRequestException, Inject, Injectable, Optional, UnauthorizedException } from "@nestjs/common";
import { hashPassword, permissions as knownPermissions, verifyPassword } from "@fieldops/auth";
import type { AuthenticatedActor, Permission } from "@fieldops/auth";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";
import { demoRolePermissionsById, findDemoUserByEmail, findDemoUserById } from "../users/users.demo-store.js";
import {
  computeCredentialFingerprint,
  createActionToken,
  createSignedActorToken,
  parseActionToken
} from "./auth.guard.js";

export interface LoginResult {
  readonly token: string;
  readonly actor: AuthenticatedActor;
}

interface UserRow {
  readonly id: string;
  readonly organization_id: string;
  readonly password_hash: string | null;
  readonly status: string;
}

interface RoleRow {
  readonly role_id: string;
  readonly permissions: string[] | null;
}

interface TeamRow {
  readonly team_id: string;
  readonly territory_id: string | null;
}

const knownPermissionSet = new Set<Permission>(knownPermissions);

// Espelha os três usuários semeados por packages/database/src/seeds/demo.ts.
// Usado apenas quando não há Postgres configurado ou a consulta ao banco
// falha por motivo técnico — nunca como alternativa quando a senha informada
// está errada (a validação de senha em si usa `demoUsers`, ver `users.demo-store.ts`).
const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

const DEMO_ACTORS_BY_EMAIL: ReadonlyMap<string, AuthenticatedActor> = new Map([
  [
    "admin@acmefield.example",
    {
      id: "00000000-0000-4000-8000-000000000011",
      organizationId: DEMO_ORGANIZATION_ID,
      permissions: [
        "work_order:read",
        "work_order:create",
        "work_order:update",
        "work_order:assign",
        "work_order:cancel",
        "schedule:read",
        "schedule:update",
        "customer:read",
        "customer:manage",
        "asset:read",
        "asset:manage",
        "technician:read",
        "report:read",
        "notification:read",
        "notification:update",
        "admin:manage_users",
        "admin:manage_roles",
        "audit_log:read",
        "ai:read"
      ],
      roleIds: ["00000000-0000-4000-8000-000000000101"],
      teamIds: [],
      territoryIds: []
    }
  ],
  [
    "ana@acmefield.example",
    {
      id: "00000000-0000-4000-8000-000000000012",
      organizationId: DEMO_ORGANIZATION_ID,
      permissions: [
        "work_order:read",
        "work_order:update",
        "schedule:read",
        "asset:read",
        "customer:read",
        "notification:read",
        "notification:update"
      ],
      roleIds: ["00000000-0000-4000-8000-000000000103"],
      teamIds: ["00000000-0000-4000-8000-000000000201"],
      territoryIds: ["00000000-0000-4000-8000-000000000801"]
    }
  ],
  [
    "bruno@acmefield.example",
    {
      id: "00000000-0000-4000-8000-000000000013",
      organizationId: DEMO_ORGANIZATION_ID,
      permissions: [
        "work_order:read",
        "work_order:update",
        "schedule:read",
        "asset:read",
        "customer:read",
        "notification:read",
        "notification:update"
      ],
      roleIds: ["00000000-0000-4000-8000-000000000103"],
      teamIds: ["00000000-0000-4000-8000-000000000201"],
      territoryIds: ["00000000-0000-4000-8000-000000000801", "00000000-0000-4000-8000-000000000802"]
    }
  ]
]);

@Injectable()
export class AuthService {
  constructor(@Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();

    if (this.postgresPool) {
      try {
        const actor = await this.authenticateAgainstDatabase(this.postgresPool, normalizedEmail, password);
        if (!actor) {
          throw new UnauthorizedException("Email ou senha inválidos.");
        }

        return { actor, token: createSignedActorToken(actor) };
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        // Falha técnica ao consultar o Postgres (ex.: banco ainda não provisionado
        // neste ambiente) — cai no fallback demo abaixo, igual aos outros serviços.
      }
    }

    const demoActor = await this.authenticateAgainstDemo(normalizedEmail, password);
    if (!demoActor) {
      throw new UnauthorizedException("Email ou senha inválidos.");
    }

    return { actor: demoActor, token: createSignedActorToken(demoActor) };
  }

  private async authenticateAgainstDemo(email: string, password: string): Promise<AuthenticatedActor | undefined> {
    // `demoUsers` é a fonte da verdade para credenciais em modo demo (mutável,
    // já que convite/troca/redefinição de senha precisam surtir efeito); o
    // mapa estático abaixo só complementa com o "ator rico" (equipes,
    // territórios) dos 3 usuários semeados, que não dá para derivar só do
    // papel para um usuário novo convidado neste modo.
    const demoUser = findDemoUserByEmail(email);
    if (!demoUser || demoUser.status !== "active" || !demoUser.passwordHash) {
      return undefined;
    }

    const passwordMatches = await verifyPassword(password, demoUser.passwordHash);
    if (!passwordMatches) {
      return undefined;
    }

    const staticActor = DEMO_ACTORS_BY_EMAIL.get(email);
    if (staticActor) {
      return staticActor;
    }

    return {
      id: demoUser.id,
      organizationId: demoUser.organizationId,
      permissions: [...new Set(demoUser.roleIds.flatMap((roleId) => demoRolePermissionsById[roleId] ?? []))],
      roleIds: demoUser.roleIds,
      teamIds: [],
      territoryIds: []
    };
  }

  async acceptInvite(token: string, password: string): Promise<LoginResult> {
    const { userId, organizationId, fingerprint } = parseActionToken(token, "invite");

    if (!this.postgresPool) {
      return this.acceptInviteInMemory(userId, organizationId, fingerprint, password);
    }

    try {
      const result = await this.postgresPool.query<{ status: string; password_hash: string | null }>(
        `select status, password_hash from users where id = $1 and organization_id = $2`,
        [userId, organizationId]
      );
      const user = result.rows[0];

      if (!user || user.status !== "invited") {
        throw new BadRequestException("Convite inválido ou já utilizado.");
      }
      if (computeCredentialFingerprint(userId, user.password_hash) !== fingerprint) {
        throw new BadRequestException("Convite inválido ou já utilizado.");
      }

      const passwordHash = await hashPassword(password);
      await this.postgresPool.query(`update users set status = 'active', password_hash = $1 where id = $2`, [
        passwordHash,
        userId
      ]);

      const refreshedActor = await this.buildActorFromDatabase(this.postgresPool, userId, organizationId);
      return { actor: refreshedActor, token: createSignedActorToken(refreshedActor) };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Falha técnica ao consultar o Postgres — mesmo fallback demo dos
      // outros serviços do projeto (ex.: CustomersService).
      return this.acceptInviteInMemory(userId, organizationId, fingerprint, password);
    }
  }

  private async acceptInviteInMemory(
    userId: string,
    organizationId: string,
    fingerprint: string,
    password: string
  ): Promise<LoginResult> {
    const user = findDemoUserById(userId);
    if (!user || user.organizationId !== organizationId || user.status !== "invited") {
      throw new BadRequestException("Convite inválido ou já utilizado.");
    }
    if (computeCredentialFingerprint(user.id, user.passwordHash) !== fingerprint) {
      throw new BadRequestException("Convite inválido ou já utilizado.");
    }

    user.passwordHash = await hashPassword(password);
    user.status = "active";

    const actor = await this.authenticateAgainstDemo(user.email, password);
    if (!actor) {
      throw new BadRequestException("Não foi possível concluir o convite.");
    }
    return { actor, token: createSignedActorToken(actor) };
  }

  async forgotPassword(email: string): Promise<{ resetToken?: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!this.postgresPool) {
      return forgotPasswordInMemory(normalizedEmail);
    }

    try {
      const result = await this.postgresPool.query<{ id: string; organization_id: string; password_hash: string | null }>(
        `select id, organization_id, password_hash
         from users
         where lower(email) = $1 and status = 'active'
         order by created_at asc
         limit 1`,
        [normalizedEmail]
      );
      const user = result.rows[0];

      if (!user) {
        return {};
      }

      return {
        resetToken: createActionToken("password-reset", {
          fingerprint: computeCredentialFingerprint(user.id, user.password_hash),
          organizationId: user.organization_id,
          userId: user.id
        })
      };
    } catch {
      // Falha técnica ao consultar o Postgres — cai no fallback demo, no mesmo
      // espírito do restante do projeto (ex.: CustomersService). Sem isso, um
      // usuário só existente no armazenamento demo (ex.: criado via convite
      // enquanto o Postgres estava technicamente indisponível) nunca
      // conseguiria gerar um link de redefinição.
      return forgotPasswordInMemory(normalizedEmail);
    }
  }

  async resetPassword(token: string, password: string): Promise<LoginResult> {
    const { userId, organizationId, fingerprint } = parseActionToken(token, "password-reset");

    if (!this.postgresPool) {
      return this.resetPasswordInMemory(userId, organizationId, fingerprint, password);
    }

    try {
      const result = await this.postgresPool.query<{ password_hash: string | null }>(
        `select password_hash from users where id = $1 and organization_id = $2 and status = 'active'`,
        [userId, organizationId]
      );
      const user = result.rows[0];

      if (!user || computeCredentialFingerprint(userId, user.password_hash) !== fingerprint) {
        throw new BadRequestException("Link de redefinição inválido ou expirado.");
      }

      const passwordHash = await hashPassword(password);
      await this.postgresPool.query(`update users set password_hash = $1 where id = $2`, [passwordHash, userId]);

      const refreshedActor = await this.buildActorFromDatabase(this.postgresPool, userId, organizationId);
      return { actor: refreshedActor, token: createSignedActorToken(refreshedActor) };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      return this.resetPasswordInMemory(userId, organizationId, fingerprint, password);
    }
  }

  private async resetPasswordInMemory(
    userId: string,
    organizationId: string,
    fingerprint: string,
    password: string
  ): Promise<LoginResult> {
    const user = findDemoUserById(userId);
    if (!user || user.organizationId !== organizationId || user.status !== "active") {
      throw new BadRequestException("Link de redefinição inválido ou expirado.");
    }
    if (computeCredentialFingerprint(user.id, user.passwordHash) !== fingerprint) {
      throw new BadRequestException("Link de redefinição inválido ou expirado.");
    }

    user.passwordHash = await hashPassword(password);
    const actor = await this.authenticateAgainstDemo(user.email, password);
    if (!actor) {
      throw new BadRequestException("Não foi possível redefinir a senha.");
    }
    return { actor, token: createSignedActorToken(actor) };
  }

  async changePassword(actor: AuthenticatedActor, currentPassword: string, newPassword: string): Promise<void> {
    if (!this.postgresPool) {
      await this.changePasswordInMemory(actor, currentPassword, newPassword);
      return;
    }

    try {
      const result = await this.postgresPool.query<{ password_hash: string | null }>(
        `select password_hash from users where id = $1 and organization_id = $2`,
        [actor.id, actor.organizationId]
      );
      const user = result.rows[0];

      if (!user?.password_hash || !(await verifyPassword(currentPassword, user.password_hash))) {
        throw new UnauthorizedException("Senha atual incorreta.");
      }

      const passwordHash = await hashPassword(newPassword);
      await this.postgresPool.query(`update users set password_hash = $1 where id = $2`, [passwordHash, actor.id]);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      await this.changePasswordInMemory(actor, currentPassword, newPassword);
    }
  }

  private async changePasswordInMemory(
    actor: AuthenticatedActor,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = findDemoUserById(actor.id);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Usuário não encontrado.");
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Senha atual incorreta.");
    }

    user.passwordHash = await hashPassword(newPassword);
  }

  private async buildActorFromDatabase(
    pool: pg.Pool,
    userId: string,
    organizationId: string
  ): Promise<AuthenticatedActor> {
    const [roleRows, teamRows, technicianRows] = await Promise.all([
      pool.query<RoleRow>(
        `select ur.role_id, r.permissions
         from user_roles ur
         join roles r on r.id = ur.role_id
         where ur.user_id = $1`,
        [userId]
      ),
      pool.query<TeamRow>(
        `select t.id as team_id, t.territory_id
         from team_members tm
         join teams t on t.id = tm.team_id
         where tm.user_id = $1`,
        [userId]
      ),
      pool.query<TeamRow>(
        `select team_id, territory_id
         from technician_profiles
         where user_id = $1`,
        [userId]
      )
    ]);

    const permissionSet = new Set<Permission>();
    for (const row of roleRows.rows) {
      for (const permission of row.permissions ?? []) {
        if (knownPermissionSet.has(permission as Permission)) {
          permissionSet.add(permission as Permission);
        }
      }
    }

    const teamIdSet = new Set<string>();
    const territoryIdSet = new Set<string>();
    for (const row of [...teamRows.rows, ...technicianRows.rows]) {
      if (row.team_id) {
        teamIdSet.add(row.team_id);
      }
      if (row.territory_id) {
        territoryIdSet.add(row.territory_id);
      }
    }

    return {
      id: userId,
      organizationId,
      permissions: [...permissionSet],
      roleIds: roleRows.rows.map((row) => row.role_id),
      teamIds: [...teamIdSet],
      territoryIds: [...territoryIdSet]
    };
  }

  private async authenticateAgainstDatabase(
    pool: pg.Pool,
    email: string,
    password: string
  ): Promise<AuthenticatedActor | undefined> {
    const userResult = await pool.query<UserRow>(
      `select id, organization_id, password_hash, status
       from users
       where lower(email) = $1
       order by created_at asc
       limit 1`,
      [email]
    );

    const user = userResult.rows[0];
    if (!user || user.status !== "active" || !user.password_hash) {
      return undefined;
    }

    const passwordMatches = await verifyPassword(password, user.password_hash);
    if (!passwordMatches) {
      return undefined;
    }

    return this.buildActorFromDatabase(pool, user.id, user.organization_id);
  }
}

function forgotPasswordInMemory(normalizedEmail: string): { resetToken?: string } {
  const user = findDemoUserByEmail(normalizedEmail);
  if (!user || user.status !== "active") {
    return {};
  }

  return {
    resetToken: createActionToken("password-reset", {
      fingerprint: computeCredentialFingerprint(user.id, user.passwordHash),
      organizationId: user.organizationId,
      userId: user.id
    })
  };
}
