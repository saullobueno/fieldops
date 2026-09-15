import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsService } from "./notifications.service.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService]
})
export class NotificationsModule {}
