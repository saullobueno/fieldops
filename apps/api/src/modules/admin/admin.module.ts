import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { UsersService } from "../users/users.service.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [AdminController],
  providers: [AdminService, UsersService]
})
export class AdminModule {}
