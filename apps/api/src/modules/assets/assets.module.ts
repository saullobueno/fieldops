import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { AssetsController } from "./assets.controller.js";
import { AssetsService } from "./assets.service.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [AssetsController],
  providers: [AssetsService]
})
export class AssetsModule {}
