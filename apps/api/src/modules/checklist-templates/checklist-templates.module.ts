import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { ChecklistTemplatesController } from "./checklist-templates.controller.js";
import { ChecklistTemplatesService } from "./checklist-templates.service.js";

@Module({
  controllers: [ChecklistTemplatesController],
  imports: [InfrastructureModule],
  providers: [ChecklistTemplatesService]
})
export class ChecklistTemplatesModule {}
