import { Inject, Injectable, Optional, UnauthorizedException } from "@nestjs/common";
import { permissions as knownPermissions, verifyPassword } from "@fieldops/auth";
import type { AuthenticatedActor, Permission } from "@fieldops/auth";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";
import { createSignedActorToken } from "./auth.guard.js";

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

// Espelha os três usuários semeados por packages/database/src/seeds/demo.ts,
// incluindo o mesmo hash da senha "demo1234". Usado apenas quando não há
// Postgres configurado ou a consulta ao banco falha por motivo técnico —
// nunca como alternativa quando a senha informada está errada.
const DEMO_PASSWORD_HASH = "$2b$12$CMsrKOjJ7OgFN4h0sy7Pmu5UDuZbHXTsxRU3IC4Ak1Xj/m6pnCdLW";
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
        "asset:read",
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
    const actor = DEMO_ACTORS_BY_EMAIL.get(email);
    if (!actor) {
      return undefined;
    }

    const passwordMatches = await verifyPassword(password, DEMO_PASSWORD_HASH);
    return passwordMatches ? actor : undefined;
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

    const [roleRows, teamRows, technicianRows] = await Promise.all([
      pool.query<RoleRow>(
        `select ur.role_id, r.permissions
         from user_roles ur
         join roles r on r.id = ur.role_id
         where ur.user_id = $1`,
        [user.id]
      ),
      pool.query<TeamRow>(
        `select t.id as team_id, t.territory_id
         from team_members tm
         join teams t on t.id = tm.team_id
         where tm.user_id = $1`,
        [user.id]
      ),
      pool.query<TeamRow>(
        `select team_id, territory_id
         from technician_profiles
         where user_id = $1`,
        [user.id]
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
      id: user.id,
      organizationId: user.organization_id,
      permissions: [...permissionSet],
      roleIds: roleRows.rows.map((row) => row.role_id),
      teamIds: [...teamIdSet],
      territoryIds: [...territoryIdSet]
    };
  }
}
