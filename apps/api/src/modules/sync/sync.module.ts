import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { WorkOrdersModule } from "../work-orders/work-orders.module.js";
import { SyncController } from "./sync.controller.js";
import { SyncService } from "./sync.service.js";

@Module({
  controllers: [SyncController],
  imports: [InfrastructureModule, WorkOrdersModule],
  providers: [SyncService]
})
export class SyncModule {}
