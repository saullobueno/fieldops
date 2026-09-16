import { Module } from "@nestjs/common";

import { CalendarService } from "./calendar.service.js";

@Module({
  exports: [CalendarService],
  providers: [CalendarService]
})
export class CalendarModule {}
