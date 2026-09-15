import { describe, expect, it } from "vitest";

import { NotificationsService } from "./notifications.service.js";

describe("NotificationsService", () => {
  it("lista notificações demo com contagem de não lidas", async () => {
    const service = new NotificationsService();

    const result = await service.list({
      limit: 20,
      offset: 0,
      organizationId: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000011"
    });

    expect(result.items).toHaveLength(2);
    expect(result.unreadCount).toBe(1);
  });

  it("mantém preferências de notificação por usuário", async () => {
    const service = new NotificationsService();

    const updated = await service.updatePreferences({
      preferences: [{ channels: ["in_app"], enabled: false, type: "sla_risk" }],
      userId: "user-1"
    });

    expect(updated.preferences[0]).toMatchObject({ enabled: false, type: "sla_risk" });
  });
});
