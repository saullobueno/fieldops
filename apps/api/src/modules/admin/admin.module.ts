import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
