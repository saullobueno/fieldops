import { parseServerEnv } from "@fieldops/config";
import pg from "pg";

const { Pool } = pg;

interface SqlStatement {
  readonly text: string;
  readonly values: readonly unknown[];
}

export const demoIds = {
  assetPumpA: "00000000-0000-4000-8000-000000000501",
  customerHospital: "00000000-0000-4000-8000-000000000301",
  customerRetail: "00000000-0000-4000-8000-000000000302",
  inspectionChecklistTemplate: "00000000-0000-4000-8000-000000000621",
  inspectionChecklistVersion: "00000000-0000-4000-8000-000000000622",
  organization: "00000000-0000-4000-8000-000000000001",
  roleAdmin: "00000000-0000-4000-8000-000000000101",
  roleDispatcher: "00000000-0000-4000-8000-000000000102",
  roleTechnician: "00000000-0000-4000-8000-000000000103",
  serviceInspection: "00000000-0000-4000-8000-000000000601",
  serviceMaintenance: "00000000-0000-4000-8000-000000000602",
  siteHospitalCentro: "00000000-0000-4000-8000-000000000401",
  siteRetailPinheiros: "00000000-0000-4000-8000-000000000402",
  teamCentro: "00000000-0000-4000-8000-000000000201",
  technicianAna: "00000000-0000-4000-8000-000000000701",
  technicianBruno: "00000000-0000-4000-8000-000000000702",
  territoryCentro: "00000000-0000-4000-8000-000000000801",
  territoryOeste: "00000000-0000-4000-8000-000000000802",
  workOrderInspectionAttachment: "00000000-0000-4000-8000-000000000961",
  workOrderInspectionChecklistResponse: "00000000-0000-4000-8000-000000000981",
  workOrderInspectionEvent: "00000000-0000-4000-8000-000000000971",
  userAdmin: "00000000-0000-4000-8000-000000000011",
  userAna: "00000000-0000-4000-8000-000000000012",
  userBruno: "00000000-0000-4000-8000-000000000013",
  workOrderInspection: "00000000-0000-4000-8000-000000000901",
  workOrderRepair: "00000000-0000-4000-8000-000000000902"
} as const;

export const demoSeedSummary = {
  organization: "Acme Field Services",
  technicians: ["Ana Ribeiro", "Bruno Almeida"],
  workOrders: ["WO-1001", "WO-1002"]
} as const;

// Hash bcrypt fixo (12 rounds) da senha demo "demo1234", usado pelos três usuários
// seed abaixo. Gerado uma única vez para manter `createDemoSeedStatements`
// determinístico entre chamadas (bcrypt usa salt aleatório a cada hash).
const DEMO_PASSWORD_HASH = "$2b$12$CMsrKOjJ7OgFN4h0sy7Pmu5UDuZbHXTsxRU3IC4Ak1Xj/m6pnCdLW";

export function createDemoSeedStatements(now = new Date("2026-01-15T12:00:00.000Z")): readonly SqlStatement[] {
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(now.getUTCDate() + 1);

  return [
    statement(
      `insert into organizations (id, name, slug, timezone)
       values ($1, $2, $3, $4)
       on conflict (slug) do update set name = excluded.name, timezone = excluded.timezone`,
      [demoIds.organization, "Acme Field Services", "acme-field-services", "America/Sao_Paulo"]
    ),
    statement(
      `insert into territories (id, organization_id, name, code)
       values ($1, $2, $3, $4), ($5, $2, $6, $7)
       on conflict (organization_id, code) do update set name = excluded.name`,
      [
        demoIds.territoryCentro,
        demoIds.organization,
        "Centro",
        "CENTRO",
        demoIds.territoryOeste,
        "Oeste",
        "OESTE"
      ]
    ),
    statement(
      `insert into roles (id, organization_id, name, description, permissions)
       values ($1, $2, $3, $4, $5::jsonb), ($6, $2, $7, $8, $9::jsonb), ($10, $2, $11, $12, $13::jsonb)
       on conflict (organization_id, name) do update set permissions = excluded.permissions`,
      [
        demoIds.roleAdmin,
        demoIds.organization,
        "Administrador",
        "Gerencia usuários, permissões e configurações.",
        JSON.stringify([
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
        ]),
        demoIds.roleDispatcher,
        "Despachante",
        "Opera ordens de serviço e agenda.",
        JSON.stringify(["work_order:read", "work_order:create", "work_order:update", "work_order:assign", "schedule:read", "schedule:update", "technician:read", "notification:read", "notification:update"]),
        demoIds.roleTechnician,
        "Técnico",
        "Executa ordens atribuídas em campo.",
        JSON.stringify(["work_order:read", "work_order:update", "schedule:read", "asset:read", "customer:read", "notification:read", "notification:update"])
      ]
    ),
    statement(
      `insert into users (id, organization_id, email, name, status, password_hash)
       values ($1, $2, $3, $4, 'active', $11), ($5, $2, $6, $7, 'active', $11), ($8, $2, $9, $10, 'active', $11)
       on conflict (organization_id, email) do update set name = excluded.name, status = excluded.status, password_hash = excluded.password_hash`,
      [
        demoIds.userAdmin,
        demoIds.organization,
        "admin@acmefield.example",
        "Marina Costa",
        demoIds.userAna,
        "ana@acmefield.example",
        "Ana Ribeiro",
        demoIds.userBruno,
        "bruno@acmefield.example",
        "Bruno Almeida",
        DEMO_PASSWORD_HASH
      ]
    ),
    statement(
      `insert into user_roles (user_id, role_id)
       values ($1, $2), ($3, $4), ($5, $6)
       on conflict do nothing`,
      [demoIds.userAdmin, demoIds.roleAdmin, demoIds.userAna, demoIds.roleTechnician, demoIds.userBruno, demoIds.roleTechnician]
    ),
    statement(
      `insert into teams (id, organization_id, territory_id, name)
       values ($1, $2, $3, $4)
       on conflict (organization_id, name) do update set territory_id = excluded.territory_id`,
      [demoIds.teamCentro, demoIds.organization, demoIds.territoryCentro, "Equipe Centro"]
    ),
    statement(
      `insert into team_members (team_id, user_id)
       values ($1, $2), ($1, $3)
       on conflict do nothing`,
      [demoIds.teamCentro, demoIds.userAna, demoIds.userBruno]
    ),
    statement(
      `insert into technician_profiles (id, organization_id, user_id, team_id, territory_id, status, skills, home_latitude, home_longitude)
       values ($1, $2, $3, $4, $5, 'available', $6::jsonb, $7, $8),
              ($9, $2, $10, $4, $11, 'assigned', $12::jsonb, $13, $14)
       on conflict (user_id) do update set status = excluded.status, skills = excluded.skills`,
      [
        demoIds.technicianAna,
        demoIds.organization,
        demoIds.userAna,
        demoIds.teamCentro,
        demoIds.territoryCentro,
        JSON.stringify(["elétrica", "inspeção", "bombas"]),
        "-23.550520",
        "-46.633308",
        demoIds.technicianBruno,
        demoIds.userBruno,
        demoIds.territoryOeste,
        JSON.stringify(["refrigeração", "manutenção", "hidráulica"]),
        "-23.561684",
        "-46.655981"
      ]
    ),
    statement(
      `insert into customers (id, organization_id, name, external_ref)
       values ($1, $2, $3, $4), ($5, $2, $6, $7)
       on conflict (organization_id, external_ref) do update set name = excluded.name`,
      [demoIds.customerHospital, demoIds.organization, "Hospital Santa Clara", "CRM-100", demoIds.customerRetail, "Rede Mercado Norte", "CRM-200"]
    ),
    statement(
      `insert into sites (id, organization_id, customer_id, territory_id, name, address_line_1, city, state, postal_code, country, latitude, longitude)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'BR', $10, $11),
              ($12, $2, $13, $14, $15, $16, $17, $8, $18, 'BR', $19, $20)
       on conflict (id) do update set name = excluded.name, territory_id = excluded.territory_id`,
      [
        demoIds.siteHospitalCentro,
        demoIds.organization,
        demoIds.customerHospital,
        demoIds.territoryCentro,
        "Unidade Centro",
        "Rua Boa Vista, 120",
        "São Paulo",
        "SP",
        "01014-000",
        "-23.545200",
        "-46.633900",
        demoIds.siteRetailPinheiros,
        demoIds.customerRetail,
        demoIds.territoryOeste,
        "Loja Pinheiros",
        "Rua dos Pinheiros, 950",
        "São Paulo",
        "05422-001",
        "-23.566600",
        "-46.693400"
      ]
    ),
    statement(
      `insert into service_types (id, organization_id, name, code, estimated_duration_minutes, required_skills)
       values ($1, $2, $3, $4, 90, $5::jsonb), ($6, $2, $7, $8, 120, $9::jsonb)
       on conflict (organization_id, code) do update set estimated_duration_minutes = excluded.estimated_duration_minutes`,
      [
        demoIds.serviceInspection,
        demoIds.organization,
        "Inspeção preventiva",
        "INSP-PREV",
        JSON.stringify(["inspeção"]),
        demoIds.serviceMaintenance,
        "Manutenção corretiva",
        "MAN-CORR",
        JSON.stringify(["manutenção"])
      ]
    ),
    statement(
      `insert into checklist_templates (id, organization_id, service_type_id, name, is_active)
       values ($1, $2, $3, 'Checklist de inspeção preventiva', true)
       on conflict (id) do update set name = excluded.name, is_active = excluded.is_active`,
      [demoIds.inspectionChecklistTemplate, demoIds.organization, demoIds.serviceInspection]
    ),
    statement(
      `insert into checklist_versions (id, organization_id, template_id, version, schema, published_at)
       values ($1, $2, $3, 1, $4::jsonb, $5)
       on conflict (template_id, version) do update set schema = excluded.schema, published_at = excluded.published_at`,
      [
        demoIds.inspectionChecklistVersion,
        demoIds.organization,
        demoIds.inspectionChecklistTemplate,
        JSON.stringify({ requiredFields: ["pressao_entrada", "leitura_eletrica", "foto_painel"] }),
        now.toISOString()
      ]
    ),
    statement(
      `insert into form_fields (id, organization_id, checklist_version_id, key, label, type, is_required, sort_order, validation)
       values
         ('00000000-0000-4000-8000-000000000631', $1, $2, 'pressao_entrada', 'Verificar pressão de entrada', 'pass_fail', true, 1, '{}'::jsonb),
         ('00000000-0000-4000-8000-000000000632', $1, $2, 'leitura_eletrica', 'Registrar leitura elétrica', 'number', true, 2, '{}'::jsonb),
         ('00000000-0000-4000-8000-000000000633', $1, $2, 'foto_painel', 'Anexar foto do painel', 'photo', false, 3, '{}'::jsonb)
       on conflict (checklist_version_id, key) do update set label = excluded.label, type = excluded.type, sort_order = excluded.sort_order`,
      [demoIds.organization, demoIds.inspectionChecklistVersion]
    ),
    statement(
      `insert into assets (id, organization_id, customer_id, site_id, name, serial_number, model)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (organization_id, serial_number) do update set name = excluded.name, model = excluded.model`,
      [demoIds.assetPumpA, demoIds.organization, demoIds.customerHospital, demoIds.siteHospitalCentro, "Bomba pressurizadora A", "BMB-ACME-001", "PX-900"]
    ),
    statement(
      `insert into work_orders (id, organization_id, customer_id, site_id, asset_id, service_type_id, checklist_version_id, number, title, priority, status, scheduled_start_at, scheduled_end_at, sla_due_at)
       values ($1, $2, $3, $4, $5, $6, $7, 'WO-1001', $8, 'high', 'scheduled', $9, $10, $11),
              ($12, $2, $13, $14, null, $15, null, 'WO-1002', $16, 'urgent', 'scheduled', $17, $18, $19)
       on conflict (organization_id, number) do update set status = excluded.status, scheduled_start_at = excluded.scheduled_start_at, checklist_version_id = excluded.checklist_version_id`,
      [
        demoIds.workOrderInspection,
        demoIds.organization,
        demoIds.customerHospital,
        demoIds.siteHospitalCentro,
        demoIds.assetPumpA,
        demoIds.serviceInspection,
        demoIds.inspectionChecklistVersion,
        "Inspeção preventiva da bomba pressurizadora",
        tomorrow.toISOString(),
        addMinutes(tomorrow, 90).toISOString(),
        addMinutes(tomorrow, 240).toISOString(),
        demoIds.workOrderRepair,
        demoIds.customerRetail,
        demoIds.siteRetailPinheiros,
        demoIds.serviceMaintenance,
        "Falha em câmara fria da loja",
        addMinutes(tomorrow, 120).toISOString(),
        addMinutes(tomorrow, 240).toISOString(),
        addMinutes(tomorrow, 300).toISOString()
      ]
    ),
    statement(
      `insert into work_order_assignments (id, organization_id, work_order_id, technician_id, status, assigned_by_user_id, starts_at, ends_at, score, score_explanation)
       values ($1, $2, $3, $4, 'assigned', $5, $6, $7, 86.5, $8::jsonb)
       on conflict do nothing`,
      [
        "00000000-0000-4000-8000-000000000951",
        demoIds.organization,
        demoIds.workOrderInspection,
        demoIds.technicianAna,
        demoIds.userAdmin,
        tomorrow.toISOString(),
        addMinutes(tomorrow, 90).toISOString(),
        JSON.stringify({ fatores: ["habilidade", "território", "disponibilidade"] })
      ]
    ),
    statement(
      `insert into checklist_responses (id, organization_id, work_order_id, checklist_version_id, technician_id, answers, submitted_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, null)
       on conflict (work_order_id, checklist_version_id) do update set answers = excluded.answers, technician_id = excluded.technician_id`,
      [
        demoIds.workOrderInspectionChecklistResponse,
        demoIds.organization,
        demoIds.workOrderInspection,
        demoIds.inspectionChecklistVersion,
        demoIds.technicianAna,
        JSON.stringify({ pressao_entrada: true })
      ]
    ),
    statement(
      `insert into attachments (id, organization_id, work_order_id, uploaded_by_user_id, kind, file_name, mime_type, storage_key, byte_size, checksum)
       values ($1, $2, $3, $4, 'photo', 'foto-bomba-a.jpg', 'image/jpeg', 'demo/work-orders/WO-1001/foto-bomba-a.jpg', 184320, 'sha256-demo-bomba-a')
       on conflict (storage_key) do update set file_name = excluded.file_name, byte_size = excluded.byte_size`,
      [
        demoIds.workOrderInspectionAttachment,
        demoIds.organization,
        demoIds.workOrderInspection,
        demoIds.userAna
      ]
    ),
    statement(
      `insert into work_order_events (id, organization_id, work_order_id, actor_user_id, type, payload, occurred_at)
       values ($1, $2, $3, $4, 'assignment_created', $5::jsonb, $6)
       on conflict (id) do nothing`,
      [
        demoIds.workOrderInspectionEvent,
        demoIds.organization,
        demoIds.workOrderInspection,
        demoIds.userAdmin,
        JSON.stringify({ technician: "Ana Ribeiro" }),
        addMinutes(tomorrow, -900).toISOString()
      ]
    ),
    statement(
      `insert into audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, before, after, metadata)
       values ($1, $2, 'assign', 'work_order', $3, $4::jsonb, $5::jsonb, $6::jsonb)
       on conflict do nothing`,
      [
        demoIds.organization,
        demoIds.userAdmin,
        demoIds.workOrderInspection,
        JSON.stringify({ technicianId: null }),
        JSON.stringify({ technicianId: demoIds.technicianAna }),
        JSON.stringify({ source: "demo-seed" })
      ]
    )
  ];
}

export async function seedDemoDatabase(pool: pg.Pool, now?: Date): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const item of createDemoSeedStatements(now)) {
      await client.query(item.text, [...item.values]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function statement(text: string, values: readonly unknown[]): SqlStatement {
  return { text, values };
}

function addMinutes(dateValue: Date, minutes: number): Date {
  return new Date(dateValue.getTime() + minutes * 60_000);
}

function currentDemoBaseDate(): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  date.setUTCHours(12, 0, 0, 0);
  return date;
}

async function runFromCli(): Promise<void> {
  const env = parseServerEnv(process.env);
  const pool = new Pool({ connectionString: env.DATABASE_URL });

  try {
    await seedDemoDatabase(pool, currentDemoBaseDate());
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("demo.ts")) {
  await runFromCli();
}
