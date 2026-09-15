import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { hasScheduleConflict, scoreAssignmentCandidate } from "@fieldops/domain";
import type {
  DispatchAssignmentCard,
  DispatchAssignmentResult,
  DispatchBoard,
  DispatchCandidate,
  DispatchTechnicianLane,
  DispatchUnassignedWorkOrder
} from "@fieldops/types";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";
import { MapsService } from "../maps/maps.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";

export interface CreateAssignmentInput {
  readonly organizationId: string;
  readonly workOrderId: string;
  readonly technicianId: string;
  readonly actorUserId: string;
}

interface TechnicianRow {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly skills: readonly string[];
  readonly territory_id: string | null;
  readonly home_latitude: string | null;
  readonly home_longitude: string | null;
}

interface AssignmentRow {
  readonly id: string;
  readonly work_order_id: string;
  readonly technician_id: string;
  readonly work_order_number: string;
  readonly title: string;
  readonly customer: string;
  readonly starts_at: Date | string;
  readonly ends_at: Date | string;
  readonly status: string;
}

interface UnassignedRow {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly customer: string;
  readonly priority: string;
  readonly scheduled_start_at: Date | string | null;
  readonly scheduled_end_at: Date | string | null;
  readonly sla_due_at: Date | string | null;
  readonly required_skills: readonly string[];
  readonly territory_id: string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
}

interface WorkOrderScopeRow {
  readonly id: string;
  readonly organization_id: string;
  readonly number: string;
  readonly title: string;
  readonly customer: string;
  readonly service_type_id: string;
  readonly required_skills: readonly string[];
  readonly territory_id: string | null;
  readonly scheduled_start_at: Date | string | null;
  readonly scheduled_end_at: Date | string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
}

@Injectable()
export class DispatchService {
  constructor(
    @Inject(RealtimeService) private readonly realtimeService: RealtimeService,
    @Inject(MapsService) private readonly mapsService: MapsService,
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {}

  async getBoard(organizationId: string, date: string): Promise<DispatchBoard> {
    if (!this.postgresPool) {
      return getDemoBoard(date);
    }

    try {
      return await this.getBoardFromDatabase(organizationId, date);
    } catch {
      return getDemoBoard(date);
    }
  }

  async getCandidates(workOrderId: string, organizationId: string): Promise<readonly DispatchCandidate[]> {
    if (!this.postgresPool) {
      return getDemoCandidates(workOrderId, this.mapsService);
    }

    try {
      return await this.getCandidatesFromDatabase(workOrderId, organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      return getDemoCandidates(workOrderId, this.mapsService);
    }
  }

  async createAssignment(input: CreateAssignmentInput): Promise<DispatchAssignmentResult> {
    if (!this.postgresPool) {
      return createDemoAssignment(input, this.realtimeService);
    }

    try {
      return await this.createAssignmentInDatabase(input);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      return createDemoAssignment(input, this.realtimeService);
    }
  }

  private async getBoardFromDatabase(organizationId: string, date: string): Promise<DispatchBoard> {
    const [technicians, assignments, unassigned] = await Promise.all([
      this.postgresPool!.query<TechnicianRow>(
        `select tp.id, u.name, tp.status, tp.skills, tp.territory_id, tp.home_latitude, tp.home_longitude
         from technician_profiles tp
         join users u on u.id = tp.user_id
         where tp.organization_id = $1
         order by u.name asc`,
        [organizationId]
      ),
      this.postgresPool!.query<AssignmentRow>(
        `select woa.id, woa.work_order_id, woa.technician_id, wo.number as work_order_number, wo.title, c.name as customer, woa.starts_at, woa.ends_at, woa.status
         from work_order_assignments woa
         join work_orders wo on wo.id = woa.work_order_id
         join customers c on c.id = wo.customer_id
         where woa.organization_id = $1 and woa.status in ('assigned', 'accepted') and woa.starts_at::date = $2::date
         order by woa.starts_at asc`,
        [organizationId, date]
      ),
      this.postgresPool!.query<UnassignedRow>(
        `select
           wo.id, wo.number, wo.title, c.name as customer, wo.priority,
           wo.scheduled_start_at, wo.scheduled_end_at, wo.sla_due_at,
           st.required_skills, s.territory_id, s.latitude, s.longitude
         from work_orders wo
         join customers c on c.id = wo.customer_id
         join sites s on s.id = wo.site_id
         join service_types st on st.id = wo.service_type_id
         left join lateral (
           select technician_id
           from work_order_assignments
           where work_order_id = wo.id and status in ('assigned', 'accepted')
           limit 1
         ) active_assignment on true
         where wo.organization_id = $1
           and wo.status not in ('completed', 'cancelled')
           and wo.scheduled_start_at::date = $2::date
           and active_assignment.technician_id is null
         order by wo.scheduled_start_at asc nulls last`,
        [organizationId, date]
      )
    ]);

    const assignmentsByTechnician = new Map<string, DispatchAssignmentCard[]>();
    for (const row of assignments.rows) {
      const card = toAssignmentCard(row);
      const list = assignmentsByTechnician.get(row.technician_id) ?? [];
      list.push(card);
      assignmentsByTechnician.set(row.technician_id, list);
    }

    return {
      date,
      technicians: technicians.rows.map((row) => toTechnicianLane(row, assignmentsByTechnician.get(row.id) ?? [])),
      unassigned: unassigned.rows.map(toUnassignedWorkOrder)
    };
  }

  private async getCandidatesFromDatabase(workOrderId: string, organizationId: string): Promise<readonly DispatchCandidate[]> {
    const scope = await this.loadWorkOrderScope(workOrderId, organizationId);
    const technicians = await this.postgresPool!.query<TechnicianRow>(
      `select tp.id, u.name, tp.status, tp.skills, tp.territory_id, tp.home_latitude, tp.home_longitude
       from technician_profiles tp
       join users u on u.id = tp.user_id
       where tp.organization_id = $1
       order by u.name asc`,
      [organizationId]
    );

    const candidates = await Promise.all(
      technicians.rows.map((row) => this.buildCandidate(row, scope))
    );

    return candidates.sort((a, b) => b.score - a.score);
  }

  private async buildCandidate(technician: TechnicianRow, scope: WorkOrderScopeRow): Promise<DispatchCandidate> {
    const [activeCount, overlapping] = await Promise.all([
      this.postgresPool!.query<{ count: string }>(
        `select count(*)::text as count
         from work_order_assignments
         where technician_id = $1 and status in ('assigned', 'accepted')`,
        [technician.id]
      ),
      this.postgresPool!.query<{ starts_at: Date | string; ends_at: Date | string }>(
        `select starts_at, ends_at
         from work_order_assignments
         where technician_id = $1 and status in ('assigned', 'accepted') and work_order_id != $2`,
        [technician.id, scope.id]
      )
    ]);

    const estimatedTravelMinutes = await this.mapsService.estimateTravelMinutes(
      toCoordinates(technician.home_latitude, technician.home_longitude),
      toCoordinates(scope.latitude, scope.longitude)
    );

    const { explanation, score } = scoreAssignmentCandidate({
      activeAssignmentCount: Number(activeCount.rows[0]?.count ?? 0),
      requiredSkills: scope.required_skills,
      technicianSkills: technician.skills,
      technicianTerritoryId: technician.territory_id,
      travelMinutes: estimatedTravelMinutes,
      workOrderTerritoryId: scope.territory_id
    });

    const hasConflict =
      scope.scheduled_start_at && scope.scheduled_end_at
        ? hasScheduleConflict(
            overlapping.rows.map((row) => ({ endsAt: toDate(row.ends_at), startsAt: toDate(row.starts_at) })),
            { endsAt: toDate(scope.scheduled_end_at), startsAt: toDate(scope.scheduled_start_at) }
          )
        : false;

    return {
      estimatedTravelMinutes,
      explanation,
      hasConflict,
      score,
      technicianId: technician.id,
      technicianName: technician.name
    };
  }

  private async loadWorkOrderScope(workOrderId: string, organizationId: string): Promise<WorkOrderScopeRow> {
    const result = await this.postgresPool!.query<WorkOrderScopeRow>(
      `select
         wo.id, wo.organization_id, wo.number, wo.title, c.name as customer, wo.service_type_id,
         st.required_skills, s.territory_id, wo.scheduled_start_at, wo.scheduled_end_at, s.latitude, s.longitude
       from work_orders wo
       join customers c on c.id = wo.customer_id
       join sites s on s.id = wo.site_id
       join service_types st on st.id = wo.service_type_id
       where wo.id = $1 and wo.organization_id = $2
       limit 1`,
      [workOrderId, organizationId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException("Ordem de serviço não encontrada.");
    }

    return row;
  }

  private async createAssignmentInDatabase(input: CreateAssignmentInput): Promise<DispatchAssignmentResult> {
    const client = await this.postgresPool!.connect();

    try {
      await client.query("begin");

      const workOrder = await client.query<{
        id: string;
        number: string;
        scheduled_start_at: Date | string | null;
        scheduled_end_at: Date | string | null;
        service_type_id: string;
        territory_id: string | null;
        required_skills: readonly string[];
      }>(
        `select wo.id, wo.number, wo.scheduled_start_at, wo.scheduled_end_at, wo.service_type_id, s.territory_id, st.required_skills
         from work_orders wo
         join sites s on s.id = wo.site_id
         join service_types st on st.id = wo.service_type_id
         where wo.id = $1 and wo.organization_id = $2
         for update`,
        [input.workOrderId, input.organizationId]
      );

      const workOrderRow = workOrder.rows[0];
      if (!workOrderRow) {
        throw new NotFoundException("Ordem de serviço não encontrada.");
      }

      if (!workOrderRow.scheduled_start_at || !workOrderRow.scheduled_end_at) {
        throw new BadRequestException("Ordem de serviço sem janela agendada para despacho.");
      }

      const technician = await client.query<{ id: string; name: string; skills: readonly string[]; territory_id: string | null }>(
        `select tp.id, u.name, tp.skills, tp.territory_id
         from technician_profiles tp
         join users u on u.id = tp.user_id
         where tp.id = $1 and tp.organization_id = $2
         for update`,
        [input.technicianId, input.organizationId]
      );

      const technicianRow = technician.rows[0];
      if (!technicianRow) {
        throw new NotFoundException("Técnico não encontrado.");
      }

      const candidateWindow = {
        endsAt: toDate(workOrderRow.scheduled_end_at),
        startsAt: toDate(workOrderRow.scheduled_start_at)
      };

      const overlapping = await client.query<{ starts_at: Date | string; ends_at: Date | string }>(
        `select starts_at, ends_at
         from work_order_assignments
         where technician_id = $1 and status in ('assigned', 'accepted') and work_order_id != $2`,
        [input.technicianId, input.workOrderId]
      );

      if (hasScheduleConflict(overlapping.rows.map((row) => ({ endsAt: toDate(row.ends_at), startsAt: toDate(row.starts_at) })), candidateWindow)) {
        throw new ConflictException("Técnico já possui atribuição conflitante nesse horário.");
      }

      const activeCount = await client.query<{ count: string }>(
        `select count(*)::text as count
         from work_order_assignments
         where technician_id = $1 and status in ('assigned', 'accepted')`,
        [input.technicianId]
      );

      const { explanation, score } = scoreAssignmentCandidate({
        activeAssignmentCount: Number(activeCount.rows[0]?.count ?? 0),
        requiredSkills: workOrderRow.required_skills,
        technicianSkills: technicianRow.skills,
        technicianTerritoryId: technicianRow.territory_id,
        workOrderTerritoryId: workOrderRow.territory_id
      });

      const previousAssignment = await client.query<{ technician_id: string }>(
        `update work_order_assignments
         set status = 'cancelled', updated_at = now()
         where work_order_id = $1 and status in ('assigned', 'accepted')
         returning technician_id`,
        [input.workOrderId]
      );

      const created = await client.query<{ id: string }>(
        `insert into work_order_assignments (organization_id, work_order_id, technician_id, status, assigned_by_user_id, starts_at, ends_at, score, score_explanation)
         values ($1, $2, $3, 'assigned', $4, $5, $6, $7, $8::jsonb)
         returning id`,
        [
          input.organizationId,
          input.workOrderId,
          input.technicianId,
          input.actorUserId,
          candidateWindow.startsAt.toISOString(),
          candidateWindow.endsAt.toISOString(),
          score,
          JSON.stringify(explanation)
        ]
      );

      await client.query(
        `insert into schedule_slots (organization_id, technician_id, work_order_id, status, starts_at, ends_at)
         values ($1, $2, $3, 'reserved', $4, $5)`,
        [input.organizationId, input.technicianId, input.workOrderId, candidateWindow.startsAt.toISOString(), candidateWindow.endsAt.toISOString()]
      );

      await client.query(
        `insert into work_order_events (organization_id, work_order_id, actor_user_id, type, payload)
         values ($1, $2, $3, 'assignment_created', $4::jsonb)`,
        [
          input.organizationId,
          input.workOrderId,
          input.actorUserId,
          JSON.stringify({ previousTechnicianId: previousAssignment.rows[0]?.technician_id ?? null, technicianId: input.technicianId })
        ]
      );

      await client.query(
        `insert into audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, before, after, metadata)
         values ($1, $2, 'assign', 'work_order', $3, $4::jsonb, $5::jsonb, $6::jsonb)`,
        [
          input.organizationId,
          input.actorUserId,
          input.workOrderId,
          JSON.stringify({ technicianId: previousAssignment.rows[0]?.technician_id ?? null }),
          JSON.stringify({ technicianId: input.technicianId }),
          JSON.stringify({ source: "dispatch-api" })
        ]
      );

      await client.query("commit");

      this.realtimeService.publish(input.organizationId, {
        data: {
          technicianId: input.technicianId,
          technicianName: technicianRow.name,
          workOrderId: input.workOrderId,
          workOrderNumber: workOrderRow.number
        },
        type: "assignment_created"
      });

      return {
        assignmentId: created.rows[0]!.id,
        endsAt: candidateWindow.endsAt.toISOString(),
        score,
        startsAt: candidateWindow.startsAt.toISOString(),
        technicianId: input.technicianId,
        workOrderId: input.workOrderId
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

function toAssignmentCard(row: AssignmentRow): DispatchAssignmentCard {
  return {
    customer: row.customer,
    endsAt: toIso(row.ends_at),
    id: row.id,
    startsAt: toIso(row.starts_at),
    status: row.status,
    title: row.title,
    workOrderId: row.work_order_id,
    workOrderNumber: row.work_order_number
  };
}

function toTechnicianLane(row: TechnicianRow, assignments: readonly DispatchAssignmentCard[]): DispatchTechnicianLane {
  return {
    assignments,
    id: row.id,
    name: row.name,
    skills: row.skills,
    status: row.status,
    territoryId: row.territory_id
  };
}

function toUnassignedWorkOrder(row: UnassignedRow): DispatchUnassignedWorkOrder {
  return {
    customer: row.customer,
    id: row.id,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    number: row.number,
    priority: row.priority,
    requiredSkills: row.required_skills,
    scheduledEndAt: toIso(row.scheduled_end_at),
    scheduledStartAt: toIso(row.scheduled_start_at),
    slaDueAt: toIso(row.sla_due_at),
    territoryId: row.territory_id,
    title: row.title
  };
}

function toIso(value: Date | string | null): string {
  if (!value) {
    return "";
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toCoordinates(
  latitude: string | number | null,
  longitude: string | number | null
): { latitude: number; longitude: number } | null {
  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude: Number(latitude), longitude: Number(longitude) };
}

const territoryCentro = "00000000-0000-4000-8000-000000000801";
const territoryOeste = "00000000-0000-4000-8000-000000000802";
const demoDate = "2026-01-16";

interface DemoTechnician {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly skills: readonly string[];
  readonly territoryId: string | null;
  readonly homeLatitude: number;
  readonly homeLongitude: number;
}

const demoTechnicians: readonly DemoTechnician[] = [
  { homeLatitude: -23.550520, homeLongitude: -46.633308, id: "00000000-0000-4000-8000-000000000701", name: "Ana Ribeiro", skills: ["elétrica", "inspeção", "bombas"], status: "assigned", territoryId: territoryCentro },
  { homeLatitude: -23.561684, homeLongitude: -46.655981, id: "00000000-0000-4000-8000-000000000702", name: "Bruno Almeida", skills: ["refrigeração", "manutenção", "hidráulica"], status: "en_route", territoryId: territoryOeste },
  { homeLatitude: -23.56, homeLongitude: -46.66, id: "demo-technician-carla", name: "Carla Nunes", skills: ["hidráulica", "instrumentação"], status: "available", territoryId: territoryOeste }
];

const demoAssignments: Record<string, DispatchAssignmentCard[]> = {
  "00000000-0000-4000-8000-000000000701": [
    {
      customer: "Hospital Santa Clara",
      endsAt: "2026-01-16T10:00:00.000Z",
      id: "demo-assignment-1",
      startsAt: "2026-01-16T08:30:00.000Z",
      status: "assigned",
      title: "Inspeção preventiva da bomba",
      workOrderId: "00000000-0000-4000-8000-000000000901",
      workOrderNumber: "WO-1001"
    }
  ],
  "00000000-0000-4000-8000-000000000702": [
    {
      customer: "Rede Mercado Norte",
      endsAt: "2026-01-16T11:30:00.000Z",
      id: "demo-assignment-2",
      startsAt: "2026-01-16T09:45:00.000Z",
      status: "assigned",
      title: "Falha em câmara fria",
      workOrderId: "00000000-0000-4000-8000-000000000902",
      workOrderNumber: "WO-1002"
    }
  ],
  "demo-technician-carla": []
};

let demoUnassigned: DispatchUnassignedWorkOrder[] = [
  {
    customer: "Condomínio Jardim Sul",
    id: "demo-work-order-1003",
    latitude: -23.5617,
    longitude: -46.656,
    number: "WO-1003",
    priority: "Média",
    requiredSkills: ["hidráulica"],
    scheduledEndAt: "2026-01-16T14:00:00.000Z",
    scheduledStartAt: "2026-01-16T13:00:00.000Z",
    slaDueAt: "2026-01-16T16:00:00.000Z",
    territoryId: territoryOeste,
    title: "Vazamento em tubulação"
  }
];

function getDemoBoard(date: string): DispatchBoard {
  return {
    date,
    technicians: demoTechnicians.map((technician) => ({
      assignments: demoAssignments[technician.id] ?? [],
      id: technician.id,
      name: technician.name,
      skills: technician.skills,
      status: technician.status,
      territoryId: technician.territoryId
    })),
    unassigned: date === demoDate ? demoUnassigned : []
  };
}

async function getDemoCandidates(workOrderId: string, mapsService: MapsService): Promise<readonly DispatchCandidate[]> {
  const workOrder = demoUnassigned.find((item) => item.id === workOrderId);
  if (!workOrder) {
    throw new NotFoundException("Ordem de serviço não encontrada.");
  }

  const candidates = await Promise.all(
    demoTechnicians.map(async (technician) => {
      const assignments = demoAssignments[technician.id] ?? [];
      const estimatedTravelMinutes = await mapsService.estimateTravelMinutes(
        { latitude: technician.homeLatitude, longitude: technician.homeLongitude },
        toCoordinates(workOrder.latitude, workOrder.longitude)
      );

      const { explanation, score } = scoreAssignmentCandidate({
        activeAssignmentCount: assignments.length,
        requiredSkills: workOrder.requiredSkills,
        technicianSkills: technician.skills,
        technicianTerritoryId: technician.territoryId,
        travelMinutes: estimatedTravelMinutes,
        workOrderTerritoryId: workOrder.territoryId
      });

      const hasConflict = hasScheduleConflict(
        assignments.map((item) => ({ endsAt: new Date(item.endsAt), startsAt: new Date(item.startsAt) })),
        { endsAt: new Date(workOrder.scheduledEndAt), startsAt: new Date(workOrder.scheduledStartAt) }
      );

      return {
        estimatedTravelMinutes,
        explanation,
        hasConflict,
        score,
        technicianId: technician.id,
        technicianName: technician.name
      };
    })
  );

  return candidates.sort((a, b) => b.score - a.score);
}

function createDemoAssignment(input: CreateAssignmentInput, realtimeService: RealtimeService): DispatchAssignmentResult {
  const workOrderIndex = demoUnassigned.findIndex((item) => item.id === input.workOrderId);
  if (workOrderIndex < 0) {
    throw new NotFoundException("Ordem de serviço não encontrada.");
  }

  const technician = demoTechnicians.find((item) => item.id === input.technicianId);
  if (!technician) {
    throw new NotFoundException("Técnico não encontrado.");
  }

  const workOrder = demoUnassigned[workOrderIndex]!;
  const candidateWindow = { endsAt: new Date(workOrder.scheduledEndAt), startsAt: new Date(workOrder.scheduledStartAt) };
  const existingAssignments = demoAssignments[technician.id] ?? [];

  if (hasScheduleConflict(existingAssignments.map((item) => ({ endsAt: new Date(item.endsAt), startsAt: new Date(item.startsAt) })), candidateWindow)) {
    throw new ConflictException("Técnico já possui atribuição conflitante nesse horário.");
  }

  const { score } = scoreAssignmentCandidate({
    activeAssignmentCount: existingAssignments.length,
    requiredSkills: workOrder.requiredSkills,
    technicianSkills: technician.skills,
    technicianTerritoryId: technician.territoryId,
    workOrderTerritoryId: workOrder.territoryId
  });

  demoUnassigned = demoUnassigned.filter((item) => item.id !== input.workOrderId);
  demoAssignments[technician.id] = [
    ...existingAssignments,
    {
      customer: workOrder.customer,
      endsAt: workOrder.scheduledEndAt,
      id: `demo-assignment-${Date.now()}`,
      startsAt: workOrder.scheduledStartAt,
      status: "assigned",
      title: workOrder.title,
      workOrderId: workOrder.id,
      workOrderNumber: workOrder.number
    }
  ];

  realtimeService.publish(input.organizationId, {
    data: {
      technicianId: technician.id,
      technicianName: technician.name,
      workOrderId: workOrder.id,
      workOrderNumber: workOrder.number
    },
    type: "assignment_created"
  });

  return {
    assignmentId: `demo-assignment-${Date.now()}`,
    endsAt: workOrder.scheduledEndAt,
    score,
    startsAt: workOrder.scheduledStartAt,
    technicianId: technician.id,
    workOrderId: workOrder.id
  };
}
