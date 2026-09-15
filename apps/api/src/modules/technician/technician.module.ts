import { Module } from "@nestjs/common";

import { WorkOrdersModule } from "../work-orders/work-orders.module.js";
import { TechnicianController } from "./technician.controller.js";

@Module({
  controllers: [TechnicianController],
  imports: [WorkOrdersModule]
})
export class TechnicianModule {}
