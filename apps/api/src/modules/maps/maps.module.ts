import { Module } from "@nestjs/common";

import { MapsService } from "./maps.service.js";

@Module({
  exports: [MapsService],
  providers: [MapsService]
})
export class MapsModule {}
