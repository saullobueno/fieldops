import type { Permission } from "@fieldops/auth";
import type { NamedOption, UserAccountStatus } from "@fieldops/types";

export interface DemoUserRecord {
  id: string;
  readonly organizationId: string;
  readonly email: string;
  name: string;
  status: UserAccountStatus;
  passwordHash: string | null;
  roleIds: string[];
}

// Espelha os três usuários semeados por packages/database/src/seeds/demo.ts,
// incluindo o mesmo hash da senha "demo1234". Mutável (ao contrário do resto
// do dataset demo, só de leitura) porque convite/ativação/troca de senha
// precisam de um estado que sobrevive entre chamadas dentro do mesmo processo
// da API quando não há Postgres configurado.
const DEMO_PASSWORD_HASH = "$2b$12$CMsrKOjJ7OgFN4h0sy7Pmu5UDuZbHXTsxRU3IC4Ak1Xj/m6pnCdLW";
const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

export const demoRoleOptions: readonly NamedOption[] = [
  { id: "00000000-0000-4000-8000-000000000101", name: "Administrador" },
  { id: "00000000-0000-4000-8000-000000000102", name: "Despachante" },
  { id: "00000000-0000-4000-8000-000000000103", name: "Técnico" }
];

export const demoRolePermissionsById: Readonly<Record<string, readonly Permission[]>> = {
  "00000000-0000-4000-8000-000000000101": [
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
  "00000000-0000-4000-8000-000000000102": [
    "work_order:read",
    "work_order:create",
    "work_order:update",
    "work_order:assign",
    "schedule:read",
    "schedule:update",
    "technician:read",
    "notification:read",
    "notification:update"
  ],
  "00000000-0000-4000-8000-000000000103": [
    "work_order:read",
    "work_order:update",
    "schedule:read",
    "asset:read",
    "customer:read",
    "notification:read",
    "notification:update"
  ]
};

export const demoUsers: DemoUserRecord[] = [
  {
    email: "admin@acmefield.example",
    id: "00000000-0000-4000-8000-000000000011",
    name: "Marina Costa",
    organizationId: DEMO_ORGANIZATION_ID,
    passwordHash: DEMO_PASSWORD_HASH,
    roleIds: ["00000000-0000-4000-8000-000000000101"],
    status: "active"
  },
  {
    email: "ana@acmefield.example",
    id: "00000000-0000-4000-8000-000000000012",
    name: "Ana Ribeiro",
    organizationId: DEMO_ORGANIZATION_ID,
    passwordHash: DEMO_PASSWORD_HASH,
    roleIds: ["00000000-0000-4000-8000-000000000103"],
    status: "active"
  },
  {
    email: "bruno@acmefield.example",
    id: "00000000-0000-4000-8000-000000000013",
    name: "Bruno Almeida",
    organizationId: DEMO_ORGANIZATION_ID,
    passwordHash: DEMO_PASSWORD_HASH,
    roleIds: ["00000000-0000-4000-8000-000000000103"],
    status: "active"
  }
];

export function findDemoUserByEmail(email: string): DemoUserRecord | undefined {
  const normalized = email.trim().toLowerCase();
  return demoUsers.find((user) => user.email.toLowerCase() === normalized);
}

export function findDemoUserById(id: string): DemoUserRecord | undefined {
  return demoUsers.find((user) => user.id === id);
}
