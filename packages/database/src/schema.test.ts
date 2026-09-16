import { describe, expect, it } from "vitest";

import { domainSchemaTables } from "./schema";

describe("domainSchemaTables", () => {
  it("expõe todas as tabelas planejadas para a Fase 1", () => {
    expect(Object.keys(domainSchemaTables).toSorted()).toEqual([
      "aiConversations",
      "aiRecommendations",
      "aiToolCalls",
      "assets",
      "attachments",
      "auditLogs",
      "checklistResponses",
      "checklistTemplates",
      "checklistVersions",
      "contacts",
      "contracts",
      "customers",
      "deviceSessions",
      "formFields",
      "inspections",
      "inventoryItems",
      "notifications",
      "organizations",
      "partUsages",
      "roles",
      "scheduleSlots",
      "serviceTypes",
      "signatures",
      "sites",
      "slaEvents",
      "slas",
      "syncOperations",
      "teamMembers",
      "teams",
      "technicianProfiles",
      "territories",
      "userRoles",
      "users",
      "workOrderAssignments",
      "workOrderEvents",
      "workOrders"
    ]);
  });
});
