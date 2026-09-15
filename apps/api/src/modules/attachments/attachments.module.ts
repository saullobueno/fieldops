import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { AttachmentsController } from "./attachments.controller.js";
import { AttachmentsService } from "./attachments.service.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService]
})
export class AttachmentsModule {}
