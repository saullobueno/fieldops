import { Module } from "@nestjs/common";

import { DashboardModule } from "../dashboard/dashboard.module.js";
import { DispatchModule } from "../dispatch/dispatch.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { WorkOrdersModule } from "../work-orders/work-orders.module.js";
import { CopilotController } from "./copilot.controller.js";
import { CopilotService } from "./copilot.service.js";

@Module({
  controllers: [CopilotController],
  imports: [DashboardModule, DispatchModule, InfrastructureModule, WorkOrdersModule],
  providers: [CopilotService]
})
export class CopilotModule {}
