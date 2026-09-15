import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { RealtimeController } from "./realtime.controller.js";
import { RealtimeService } from "./realtime.service.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [RealtimeController],
  exports: [RealtimeService],
  providers: [RealtimeService]
})
export class RealtimeModule {}
