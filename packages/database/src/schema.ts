import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export type JsonObject = Record<string, unknown>;

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const userStatusEnum = pgEnum("user_status", ["active", "invited", "disabled"]);
export const technicianStatusEnum = pgEnum("technician_status", [
  "available",
  "assigned",
  "en_route",
  "on_site",
  "offline",
  "unavailable"
]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "urgent"]);
export const workOrderStatusEnum = pgEnum("work_order_status", [
  "draft",
  "scheduled",
  "en_route",
  "on_site",
  "paused",
  "completed",
  "cancelled",
  "requires_review"
]);
export const assignmentStatusEnum = pgEnum("assignment_status", [
  "proposed",
  "assigned",
  "accepted",
  "declined",
  "cancelled"
]);
export const scheduleSlotStatusEnum = pgEnum("schedule_slot_status", [
  "available",
  "busy",
  "reserved",
  "time_off"
]);
export const checklistFieldTypeEnum = pgEnum("checklist_field_type", [
  "text",
  "number",
  "select",
  "checkbox",
  "photo",
  "signature",
  "pass_fail"
]);
export const attachmentKindEnum = pgEnum("attachment_kind", [
  "photo",
  "document",
  "signature",
  "other"
]);
export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "assign",
  "reschedule",
  "status_change",
  "permission_change",
  "export"
]);
export const syncOperationStatusEnum = pgEnum("sync_operation_status", [
  "queued",
  "processing",
  "completed",
  "failed",
  "conflict"
]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "unread",
  "read",
  "archived"
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  timezone: text("timezone").default("America/Sao_Paulo").notNull(),
  ...timestamps
}, (table) => [
  uniqueIndex("organizations_slug_idx").on(table.slug)
]);

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").$type<string[]>().default([]).notNull(),
  ...timestamps
}, (table) => [
  uniqueIndex("roles_org_name_idx").on(table.organizationId, table.name)
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  status: userStatusEnum("status").default("invited").notNull(),
  passwordHash: text("password_hash"),
  ...timestamps
}, (table) => [
  uniqueIndex("users_org_email_idx").on(table.organizationId, table.email),
  index("users_org_status_idx").on(table.organizationId, table.status)
]);

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId] }),
  index("user_roles_role_idx").on(table.roleId)
]);

export const territories = pgTable("territories", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  boundary: jsonb("boundary").$type<JsonObject>(),
  ...timestamps
}, (table) => [
  uniqueIndex("territories_org_code_idx").on(table.organizationId, table.code)
]);

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  territoryId: uuid("territory_id").references(() => territories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  ...timestamps
}, (table) => [
  uniqueIndex("teams_org_name_idx").on(table.organizationId, table.name),
  index("teams_territory_idx").on(table.territoryId)
]);

export const teamMembers = pgTable("team_members", {
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  primaryKey({ columns: [table.teamId, table.userId] }),
  index("team_members_user_idx").on(table.userId)
]);

export const technicianProfiles = pgTable("technician_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  territoryId: uuid("territory_id").references(() => territories.id, { onDelete: "set null" }),
  status: technicianStatusEnum("status").default("offline").notNull(),
  skills: jsonb("skills").$type<string[]>().default([]).notNull(),
  homeLatitude: numeric("home_latitude", { precision: 9, scale: 6 }),
  homeLongitude: numeric("home_longitude", { precision: 9, scale: 6 }),
  currentLatitude: numeric("current_latitude", { precision: 9, scale: 6 }),
  currentLongitude: numeric("current_longitude", { precision: 9, scale: 6 }),
  locationUpdatedAt: timestamp("location_updated_at", { withTimezone: true }),
  ...timestamps
}, (table) => [
  uniqueIndex("technician_profiles_user_idx").on(table.userId),
  index("technician_profiles_org_status_idx").on(table.organizationId, table.status),
  index("technician_profiles_team_idx").on(table.teamId)
]);

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  externalRef: text("external_ref"),
  notes: text("notes"),
  ...timestamps
}, (table) => [
  index("customers_org_name_idx").on(table.organizationId, table.name),
  uniqueIndex("customers_org_external_ref_idx").on(table.organizationId, table.externalRef)
]);

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  ...timestamps
}, (table) => [
  index("contacts_customer_idx").on(table.customerId),
  index("contacts_org_email_idx").on(table.organizationId, table.email)
]);

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  territoryId: uuid("territory_id").references(() => territories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").default("BR").notNull(),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  accessInstructions: text("access_instructions"),
  operatingHours: jsonb("operating_hours").$type<JsonObject>(),
  ...timestamps
}, (table) => [
  index("sites_customer_idx").on(table.customerId),
  index("sites_org_city_idx").on(table.organizationId, table.city),
  index("sites_territory_idx").on(table.territoryId)
]);

export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  terms: jsonb("terms").$type<JsonObject>().default({}).notNull(),
  ...timestamps
}, (table) => [
  index("contracts_customer_idx").on(table.customerId),
  index("contracts_org_dates_idx").on(table.organizationId, table.startsOn, table.endsOn)
]);

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  serialNumber: text("serial_number"),
  model: text("model"),
  warrantyExpiresOn: date("warranty_expires_on"),
  maintenancePlan: jsonb("maintenance_plan").$type<JsonObject>(),
  ...timestamps
}, (table) => [
  index("assets_site_idx").on(table.siteId),
  index("assets_customer_idx").on(table.customerId),
  uniqueIndex("assets_org_serial_idx").on(table.organizationId, table.serialNumber)
]);

export const serviceTypes = pgTable("service_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  estimatedDurationMinutes: integer("estimated_duration_minutes").notNull(),
  requiredSkills: jsonb("required_skills").$type<string[]>().default([]).notNull(),
  ...timestamps
}, (table) => [
  uniqueIndex("service_types_org_code_idx").on(table.organizationId, table.code)
]);

export const slas = pgTable("slas", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  serviceTypeId: uuid("service_type_id").references(() => serviceTypes.id, { onDelete: "cascade" }).notNull(),
  priority: priorityEnum("priority").notNull(),
  responseMinutes: integer("response_minutes").notNull(),
  resolutionMinutes: integer("resolution_minutes").notNull(),
  ...timestamps
}, (table) => [
  uniqueIndex("slas_org_service_priority_idx").on(table.organizationId, table.serviceTypeId, table.priority)
]);

export const checklistTemplates = pgTable("checklist_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  serviceTypeId: uuid("service_type_id").references(() => serviceTypes.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps
}, (table) => [
  index("checklist_templates_org_active_idx").on(table.organizationId, table.isActive)
]);

export const checklistVersions = pgTable("checklist_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  templateId: uuid("template_id").references(() => checklistTemplates.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  schema: jsonb("schema").$type<JsonObject>().notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps
}, (table) => [
  uniqueIndex("checklist_versions_template_version_idx").on(table.templateId, table.version)
]);

export const formFields = pgTable("form_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  checklistVersionId: uuid("checklist_version_id").references(() => checklistVersions.id, { onDelete: "cascade" }).notNull(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  type: checklistFieldTypeEnum("type").notNull(),
  isRequired: boolean("is_required").default(false).notNull(),
  sortOrder: integer("sort_order").notNull(),
  validation: jsonb("validation").$type<JsonObject>().default({}).notNull(),
  ...timestamps
}, (table) => [
  uniqueIndex("form_fields_version_key_idx").on(table.checklistVersionId, table.key),
  index("form_fields_version_order_idx").on(table.checklistVersionId, table.sortOrder)
]);

export const workOrders = pgTable("work_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }).notNull(),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "restrict" }).notNull(),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
  serviceTypeId: uuid("service_type_id").references(() => serviceTypes.id, { onDelete: "restrict" }).notNull(),
  checklistVersionId: uuid("checklist_version_id").references(() => checklistVersions.id, { onDelete: "set null" }),
  number: text("number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: priorityEnum("priority").default("medium").notNull(),
  status: workOrderStatusEnum("status").default("draft").notNull(),
  scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),
  scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true }),
  slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps
}, (table) => [
  uniqueIndex("work_orders_org_number_idx").on(table.organizationId, table.number),
  index("work_orders_org_status_idx").on(table.organizationId, table.status),
  index("work_orders_schedule_idx").on(table.organizationId, table.scheduledStartAt),
  index("work_orders_sla_idx").on(table.organizationId, table.slaDueAt)
]);

export const workOrderAssignments = pgTable("work_order_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }).notNull(),
  technicianId: uuid("technician_id").references(() => technicianProfiles.id, { onDelete: "restrict" }).notNull(),
  status: assignmentStatusEnum("status").default("assigned").notNull(),
  assignedByUserId: uuid("assigned_by_user_id").references(() => users.id, { onDelete: "set null" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  score: numeric("score", { precision: 5, scale: 2 }),
  scoreExplanation: jsonb("score_explanation").$type<JsonObject>(),
  ...timestamps
}, (table) => [
  index("work_order_assignments_work_order_idx").on(table.workOrderId),
  index("work_order_assignments_technician_time_idx").on(table.technicianId, table.startsAt, table.endsAt),
  index("work_order_assignments_org_status_idx").on(table.organizationId, table.status)
]);

export const scheduleSlots = pgTable("schedule_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  technicianId: uuid("technician_id").references(() => technicianProfiles.id, { onDelete: "cascade" }).notNull(),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
  status: scheduleSlotStatusEnum("status").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  ...timestamps
}, (table) => [
  index("schedule_slots_technician_time_idx").on(table.technicianId, table.startsAt, table.endsAt),
  index("schedule_slots_org_time_idx").on(table.organizationId, table.startsAt, table.endsAt)
]);

export const workOrderEvents = pgTable("work_order_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }).notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<JsonObject>().default({}).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index("work_order_events_work_order_time_idx").on(table.workOrderId, table.occurredAt)
]);

export const slaEvents = pgTable("sla_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  riskScore: numeric("risk_score", { precision: 5, scale: 2 }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index("sla_events_work_order_time_idx").on(table.workOrderId, table.occurredAt)
]);

export const checklistResponses = pgTable("checklist_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }).notNull(),
  checklistVersionId: uuid("checklist_version_id").references(() => checklistVersions.id, { onDelete: "restrict" }).notNull(),
  technicianId: uuid("technician_id").references(() => technicianProfiles.id, { onDelete: "set null" }),
  answers: jsonb("answers").$type<JsonObject>().default({}).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  ...timestamps
}, (table) => [
  uniqueIndex("checklist_responses_work_order_version_idx").on(table.workOrderId, table.checklistVersionId)
]);

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
  kind: attachmentKindEnum("kind").default("document").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  storageKey: text("storage_key").notNull(),
  byteSize: integer("byte_size").notNull(),
  checksum: text("checksum"),
  ...timestamps
}, (table) => [
  uniqueIndex("attachments_storage_key_idx").on(table.storageKey),
  index("attachments_work_order_idx").on(table.workOrderId),
  index("attachments_asset_idx").on(table.assetId)
]);

export const signatures = pgTable("signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }).notNull(),
  attachmentId: uuid("attachment_id").references(() => attachments.id, { onDelete: "restrict" }).notNull(),
  signerName: text("signer_name").notNull(),
  signedAt: timestamp("signed_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index("signatures_work_order_idx").on(table.workOrderId)
]);

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  quantityOnHand: integer("quantity_on_hand").default(0).notNull(),
  reorderPoint: integer("reorder_point").default(0).notNull(),
  ...timestamps
}, (table) => [
  uniqueIndex("inventory_items_org_sku_idx").on(table.organizationId, table.sku)
]);

export const partUsages = pgTable("part_usages", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }).notNull(),
  inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id, { onDelete: "restrict" }).notNull(),
  quantity: integer("quantity").notNull(),
  usedByTechnicianId: uuid("used_by_technician_id").references(() => technicianProfiles.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index("part_usages_work_order_idx").on(table.workOrderId),
  index("part_usages_inventory_item_idx").on(table.inventoryItemId)
]);

export const inspections = pgTable("inspections", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }).notNull(),
  checklistResponseId: uuid("checklist_response_id").references(() => checklistResponses.id, { onDelete: "restrict" }),
  result: text("result").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps
}, (table) => [
  index("inspections_work_order_idx").on(table.workOrderId)
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: notificationStatusEnum("status").default("unread").notNull(),
  metadata: jsonb("metadata").$type<JsonObject>().default({}).notNull(),
  ...timestamps
}, (table) => [
  index("notifications_user_status_idx").on(table.userId, table.status),
  index("notifications_org_created_idx").on(table.organizationId, table.createdAt)
]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: auditActionEnum("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  before: jsonb("before").$type<JsonObject>(),
  after: jsonb("after").$type<JsonObject>(),
  metadata: jsonb("metadata").$type<JsonObject>().default({}).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index("audit_logs_resource_idx").on(table.organizationId, table.resourceType, table.resourceId),
  index("audit_logs_actor_time_idx").on(table.actorUserId, table.occurredAt)
]);

export const aiConversations = pgTable("ai_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  ...timestamps
}, (table) => [
  index("ai_conversations_user_idx").on(table.userId)
]);

export const aiToolCalls = pgTable("ai_tool_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  conversationId: uuid("conversation_id").references(() => aiConversations.id, { onDelete: "cascade" }).notNull(),
  toolName: text("tool_name").notNull(),
  input: jsonb("input").$type<JsonObject>().default({}).notNull(),
  output: jsonb("output").$type<JsonObject>(),
  evidence: jsonb("evidence").$type<JsonObject>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index("ai_tool_calls_conversation_idx").on(table.conversationId)
]);

export const syncOperations = pgTable("sync_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  deviceSessionId: uuid("device_session_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  resourceType: text("resource_type").notNull(),
  operation: text("operation").notNull(),
  payload: jsonb("payload").$type<JsonObject>().default({}).notNull(),
  status: syncOperationStatusEnum("status").default("queued").notNull(),
  conflict: jsonb("conflict").$type<JsonObject>(),
  ...timestamps
}, (table) => [
  uniqueIndex("sync_operations_org_idempotency_idx").on(table.organizationId, table.idempotencyKey),
  index("sync_operations_device_status_idx").on(table.deviceSessionId, table.status)
]);

export const deviceSessions = pgTable("device_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  deviceName: text("device_name").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  index("device_sessions_user_idx").on(table.userId),
  index("device_sessions_org_last_seen_idx").on(table.organizationId, table.lastSeenAt)
]);

export const domainSchemaTables = {
  aiConversations,
  aiToolCalls,
  assets,
  attachments,
  auditLogs,
  checklistResponses,
  checklistTemplates,
  checklistVersions,
  contacts,
  contracts,
  customers,
  deviceSessions,
  formFields,
  inspections,
  inventoryItems,
  notifications,
  organizations,
  partUsages,
  roles,
  scheduleSlots,
  serviceTypes,
  signatures,
  sites,
  slaEvents,
  slas,
  syncOperations,
  teamMembers,
  teams,
  technicianProfiles,
  territories,
  userRoles,
  users,
  workOrderAssignments,
  workOrderEvents,
  workOrders
};

export const tableCountCheck = sql<number>`35`;
