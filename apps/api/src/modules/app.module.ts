import { Module } from "@nestjs/common";

import { AdminModule } from "./admin/admin.module.js";
import { AssetsModule } from "./assets/assets.module.js";
import { AttachmentsModule } from "./attachments/attachments.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ChecklistTemplatesModule } from "./checklist-templates/checklist-templates.module.js";
import { CopilotModule } from "./copilot/copilot.module.js";
import { CustomersModule } from "./customers/customers.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { DispatchModule } from "./dispatch/dispatch.module.js";
import { HealthController } from "./health/health.controller.js";
import { HealthService } from "./health/health.service.js";
import { InfrastructureModule } from "./infrastructure/infrastructure.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { SyncModule } from "./sync/sync.module.js";
import { TechnicianModule } from "./technician/technician.module.js";
import { WorkOrdersModule } from "./work-orders/work-orders.module.js";

@Module({
  imports: [
    AdminModule,
    AssetsModule,
    AttachmentsModule,
    AuthModule,
    ChecklistTemplatesModule,
    CopilotModule,
    CustomersModule,
    DashboardModule,
    DispatchModule,
    InfrastructureModule,
    NotificationsModule,
    RealtimeModule,
    ReportsModule,
    SyncModule,
    TechnicianModule,
    WorkOrdersModule
  ],
  controllers: [HealthController],
  providers: [HealthService]
})
export class AppModule {}
