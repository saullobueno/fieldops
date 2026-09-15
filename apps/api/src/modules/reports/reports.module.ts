import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";

@Module({
  controllers: [ReportsController],
  imports: [InfrastructureModule],
  providers: [ReportsService]
})
export class ReportsModule {}
