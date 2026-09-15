import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { CustomersController } from "./customers.controller.js";
import { CustomersService } from "./customers.service.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [CustomersController],
  providers: [CustomersService]
})
export class CustomersModule {}
