import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { MapOverviewService } from "./map-overview.service.js";
import { MapsController } from "./maps.controller.js";
import { MapsService } from "./maps.service.js";

@Module({
  controllers: [MapsController],
  exports: [MapsService],
  imports: [InfrastructureModule],
  providers: [MapsService, MapOverviewService]
})
export class MapsModule {}
