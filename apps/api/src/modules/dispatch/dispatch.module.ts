import { Module } from "@nestjs/common";

import { CalendarModule } from "../calendar/calendar.module.js";
import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { MapsModule } from "../maps/maps.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { DispatchController } from "./dispatch.controller.js";
import { DispatchService } from "./dispatch.service.js";

@Module({
  imports: [CalendarModule, InfrastructureModule, MapsModule, RealtimeModule],
  controllers: [DispatchController],
  providers: [DispatchService],
  exports: [DispatchService]
})
export class DispatchModule {}
