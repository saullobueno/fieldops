import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService]
})
export class DashboardModule {}
