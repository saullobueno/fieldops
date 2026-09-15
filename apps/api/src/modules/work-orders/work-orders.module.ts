import { Module } from "@nestjs/common";

import { AttachmentsModule } from "../attachments/attachments.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { WorkOrdersController } from "./work-orders.controller.js";
import { WorkOrdersService } from "./work-orders.service.js";

@Module({
  controllers: [WorkOrdersController],
  exports: [WorkOrdersService],
  imports: [AttachmentsModule, InfrastructureModule, RealtimeModule],
  providers: [WorkOrdersService]
})
export class WorkOrdersModule {}
