import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { TechniciansController } from "./technicians.controller.js";
import { TechniciansService } from "./technicians.service.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [TechniciansController],
  providers: [TechniciansService]
})
export class TechniciansModule {}
