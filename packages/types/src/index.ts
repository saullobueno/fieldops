export type HealthStatus = "ok" | "degraded";

export interface HealthCheck {
  service: string;
  status: HealthStatus;
  checkedAt: string;
}

export type DashboardWidgetKey =
  | "kpis"
  | "dispatch-preview"
  | "sla-risk"
  | "active-services-map"
  | "recent-work-orders"
  | "technician-utilization"
  | "ai-insights";

export interface DashboardKpi {
  readonly label: string;
  readonly value: string;
  readonly trend: string;
  readonly tone: "neutral" | "good" | "warning" | "danger";
}

export interface DispatchPreviewItem {
  readonly time: string;
  readonly technician: string;
  readonly workOrderNumber: string;
  readonly title: string;
  readonly status: string;
}

export interface SlaRiskItem {
  readonly workOrderNumber: string;
  readonly customer: string;
  readonly dueAt: string;
  readonly risk: "baixo" | "medio" | "alto";
}

export interface ActiveServiceMapItem {
  readonly workOrderNumber: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly status: string;
}

export interface RecentWorkOrderItem {
  readonly workOrderNumber: string;
  readonly customer: string;
  readonly priority: string;
  readonly status: string;
}

export interface TechnicianUtilizationItem {
  readonly technician: string;
  readonly utilizationPercent: number;
  readonly activeWorkOrders: number;
}

export interface AiInsightItem {
  readonly title: string;
  readonly evidence: string;
  readonly severity: "informativo" | "atenção" | "crítico";
}

export type DashboardWidgetPayload =
  | { readonly widget: "kpis"; readonly items: readonly DashboardKpi[] }
  | { readonly widget: "dispatch-preview"; readonly items: readonly DispatchPreviewItem[] }
  | { readonly widget: "sla-risk"; readonly items: readonly SlaRiskItem[] }
  | { readonly widget: "active-services-map"; readonly items: readonly ActiveServiceMapItem[] }
  | { readonly widget: "recent-work-orders"; readonly items: readonly RecentWorkOrderItem[] }
  | { readonly widget: "technician-utilization"; readonly items: readonly TechnicianUtilizationItem[] }
  | { readonly widget: "ai-insights"; readonly items: readonly AiInsightItem[] };

export interface WorkOrderSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly number: string;
  readonly customer: string;
  readonly site: string;
  readonly title: string;
  readonly priority: string;
  readonly status: string;
  readonly technician: string | null;
  readonly scheduledStartAt: string;
  readonly slaDueAt: string;
  readonly teamId: string | null;
  readonly territoryId: string | null;
  readonly assignedTechnicianUserId: string | null;
}

export interface WorkOrderTimelineItem {
  readonly id: string;
  readonly occurredAt: string;
  readonly title: string;
  readonly description: string;
}

export type ChecklistFieldType =
  | "text"
  | "number"
  | "select"
  | "checkbox"
  | "photo"
  | "signature"
  | "pass_fail";

export interface WorkOrderChecklistItem {
  readonly id: string;
  readonly label: string;
  readonly completed: boolean;
  readonly answerKey?: string;
  readonly type: ChecklistFieldType;
  readonly isRequired: boolean;
  readonly value: string | number | boolean | null;
  readonly options?: readonly string[];
}

export interface WorkOrderAttachment {
  readonly id: string;
  readonly fileName: string;
  readonly kind: string;
  readonly uploadedAt: string;
  readonly signedUrl?: string;
  readonly signedUrlExpiresAt?: string;
}

export interface WorkOrderNote {
  readonly id: string;
  readonly author: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface WorkOrderSignature {
  readonly id: string;
  readonly signerName: string;
  readonly signedAt: string;
  readonly attachmentId: string;
}

export interface WorkOrderDetail extends WorkOrderSummary {
  readonly description: string;
  readonly timeline: readonly WorkOrderTimelineItem[];
  readonly checklist: readonly WorkOrderChecklistItem[];
  readonly attachments: readonly WorkOrderAttachment[];
  readonly notes: readonly WorkOrderNote[];
  readonly signatures: readonly WorkOrderSignature[];
}

export interface WorkOrderListResponse {
  readonly items: readonly WorkOrderSummary[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface WorkOrderAuditItem {
  readonly id: string;
  readonly action: string;
  readonly actor: string | null;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
  readonly occurredAt: string;
}

export interface AdminCatalogMetric {
  readonly label: string;
  readonly value: number;
  readonly resource: "customers" | "sites" | "assets" | "technicians" | "serviceTypes" | "checklists" | "slas";
}

export interface AdminCatalogSummary {
  readonly organizationId: string;
  readonly generatedAt: string;
  readonly metrics: readonly AdminCatalogMetric[];
}

export type NotificationStatus = "unread" | "read" | "archived";
export type NotificationChannel = "in_app" | "email" | "sms";

export interface NotificationItem {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly status: NotificationStatus;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NotificationListResponse {
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface NotificationPreference {
  readonly type: string;
  readonly channels: readonly NotificationChannel[];
  readonly enabled: boolean;
}

export interface NotificationPreferencesResponse {
  readonly userId: string;
  readonly preferences: readonly NotificationPreference[];
}

export interface CustomerSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly externalRef: string | null;
  readonly sitesCount: number;
  readonly openWorkOrdersCount: number;
}

export interface CustomerListResponse {
  readonly items: readonly CustomerSummary[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface CustomerSite {
  readonly id: string;
  readonly name: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly territoryId: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accessInstructions: string | null;
}

export interface CustomerContact {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly title: string | null;
}

export interface CustomerContract {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
}

export interface CustomerAssetSummary {
  readonly id: string;
  readonly name: string;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly warrantyExpiresOn: string | null;
  readonly siteId: string;
  readonly siteName: string;
}

export interface CustomerDetail extends CustomerSummary {
  readonly notes: string | null;
  readonly sites: readonly CustomerSite[];
  readonly contacts: readonly CustomerContact[];
  readonly contracts: readonly CustomerContract[];
  readonly assets: readonly CustomerAssetSummary[];
}

export interface AssetMaintenanceEvent {
  readonly id: string;
  readonly occurredAt: string;
  readonly title: string;
  readonly description: string;
  readonly workOrderNumber: string;
}

export interface AssetDocument {
  readonly id: string;
  readonly fileName: string;
  readonly kind: string;
  readonly uploadedAt: string;
  readonly signedUrl?: string;
  readonly signedUrlExpiresAt?: string;
}

export type SyncOperationType = "status_change" | "checklist_update" | "note_add";

export interface SyncOperationRequest {
  readonly idempotencyKey: string;
  readonly workOrderId: string;
  readonly type: SyncOperationType;
  readonly payload: Record<string, unknown>;
}

export interface SyncBatchRequest {
  readonly deviceSessionId: string;
  readonly operations: readonly SyncOperationRequest[];
}

export type SyncOperationOutcome = "completed" | "conflict" | "failed" | "duplicate";

export interface SyncOperationResult {
  readonly idempotencyKey: string;
  readonly outcome: SyncOperationOutcome;
  readonly workOrder?: WorkOrderDetail;
  readonly reason?: string;
}

export interface SyncBatchResponse {
  readonly results: readonly SyncOperationResult[];
}

export interface DispatchAssignmentCard {
  readonly id: string;
  readonly workOrderId: string;
  readonly workOrderNumber: string;
  readonly title: string;
  readonly customer: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: string;
}

export interface DispatchTechnicianLane {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly skills: readonly string[];
  readonly territoryId: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly assignments: readonly DispatchAssignmentCard[];
}

export interface DispatchUnassignedWorkOrder {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly customer: string;
  readonly priority: string;
  readonly scheduledStartAt: string;
  readonly scheduledEndAt: string;
  readonly slaDueAt: string;
  readonly requiredSkills: readonly string[];
  readonly territoryId: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface DispatchBoard {
  readonly date: string;
  readonly technicians: readonly DispatchTechnicianLane[];
  readonly unassigned: readonly DispatchUnassignedWorkOrder[];
}

export interface DispatchCandidate {
  readonly technicianId: string;
  readonly technicianName: string;
  readonly score: number;
  readonly explanation: readonly string[];
  readonly hasConflict: boolean;
  readonly estimatedTravelMinutes: number | null;
}

export interface DispatchAssignmentResult {
  readonly assignmentId: string;
  readonly workOrderId: string;
  readonly technicianId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly score: number | null;
}

export interface AssetDetail {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly warrantyExpiresOn: string | null;
  readonly customerId: string;
  readonly customerName: string;
  readonly siteId: string;
  readonly siteName: string;
  readonly maintenanceTimeline: readonly AssetMaintenanceEvent[];
  readonly documents: readonly AssetDocument[];
}

export interface ChecklistFieldDefinition {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly type: ChecklistFieldType;
  readonly isRequired: boolean;
  readonly sortOrder: number;
  readonly validation: Record<string, unknown>;
}

export interface ChecklistVersionSummary {
  readonly id: string;
  readonly version: number;
  readonly publishedAt: string | null;
  readonly fields: readonly ChecklistFieldDefinition[];
}

export interface ChecklistTemplateSummary {
  readonly id: string;
  readonly name: string;
  readonly serviceTypeId: string | null;
  readonly isActive: boolean;
  readonly latestVersion: number | null;
}

export interface ChecklistTemplateListResponse {
  readonly items: readonly ChecklistTemplateSummary[];
}

export interface ChecklistTemplateDetail extends ChecklistTemplateSummary {
  readonly versions: readonly ChecklistVersionSummary[];
}

export interface ChecklistFieldInput {
  readonly key: string;
  readonly label: string;
  readonly type: ChecklistFieldType;
  readonly isRequired: boolean;
  readonly validation?: Record<string, unknown>;
}

export interface ReportKpis {
  readonly totalWorkOrders: number;
  readonly completedWorkOrders: number;
  readonly slaComplianceRate: number;
  readonly avgResolutionMinutes: number | null;
}

export interface ReportStatusBreakdownItem {
  readonly status: string;
  readonly count: number;
}

export interface ReportDailyVolumeItem {
  readonly date: string;
  readonly count: number;
}

export interface ReportTeamComplianceItem {
  readonly teamName: string;
  readonly compliant: number;
  readonly breached: number;
}

export interface ReportTechnicianUtilizationItem {
  readonly technician: string;
  readonly completedCount: number;
}

export interface ReportOverview {
  readonly from: string;
  readonly to: string;
  readonly kpis: ReportKpis;
  readonly statusBreakdown: readonly ReportStatusBreakdownItem[];
  readonly dailyVolume: readonly ReportDailyVolumeItem[];
  readonly teamCompliance: readonly ReportTeamComplianceItem[];
  readonly technicianUtilization: readonly ReportTechnicianUtilizationItem[];
}

export interface WorkOrderStatusChangedEvent {
  readonly workOrderId: string;
  readonly workOrderNumber: string;
  readonly fromStatus: string;
  readonly toStatus: string;
}

export interface AssignmentCreatedEvent {
  readonly workOrderId: string;
  readonly workOrderNumber: string;
  readonly technicianId: string;
  readonly technicianName: string;
}

export interface TechnicianLocationUpdatedEvent {
  readonly technicianId: string;
  readonly technicianName: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface NotificationCreatedEvent {
  readonly title: string;
  readonly body: string;
}

export type RealtimeEvent =
  | { readonly type: "work_order_status_changed"; readonly data: WorkOrderStatusChangedEvent }
  | { readonly type: "assignment_created"; readonly data: AssignmentCreatedEvent }
  | { readonly type: "technician_location_updated"; readonly data: TechnicianLocationUpdatedEvent }
  | { readonly type: "notification_created"; readonly data: NotificationCreatedEvent };

export interface RealtimeEnvelope {
  readonly id: string;
  readonly occurredAt: string;
  readonly organizationId: string;
  readonly event: RealtimeEvent;
}

export interface CopilotToolCallEvidence {
  readonly toolName: string;
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown>;
}

export interface CopilotSuggestedAction {
  readonly type: "reassign_technician";
  readonly workOrderId: string;
  readonly workOrderNumber: string;
  readonly technicianId: string;
  readonly technicianName: string;
  readonly reason: string;
}

export interface CopilotRecommendation {
  readonly id: string;
  readonly conversationId: string;
  readonly question: string;
  readonly title: string;
  readonly summary: string;
  readonly evidence: readonly CopilotToolCallEvidence[];
  readonly suggestedAction: CopilotSuggestedAction | null;
  readonly requiresApproval: boolean;
  readonly approvedAt: string | null;
  readonly source: "groq" | "heuristic";
  readonly createdAt: string;
}

export interface CopilotAskRequest {
  readonly question: string;
}

export interface CopilotApprovalResult {
  readonly recommendationId: string;
  readonly assignmentId: string;
  readonly workOrderId: string;
  readonly technicianId: string;
}
