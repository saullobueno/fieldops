import { Injectable } from "@nestjs/common";
import { MockCalendarAdapter, type CalendarAdapter, type CalendarBusySlot } from "@fieldops/integrations";

export interface CalendarBusySlotQuery {
  readonly technicianId: string;
  readonly from: Date;
  readonly to: Date;
}

@Injectable()
export class CalendarService {
  private readonly adapter: CalendarAdapter | undefined;

  constructor(adapter?: CalendarAdapter) {
    this.adapter = adapter ?? createCalendarAdapter(process.env.CALENDAR_PROVIDER);
  }

  async listBusySlots(input: CalendarBusySlotQuery): Promise<readonly CalendarBusySlot[]> {
    if (!this.adapter) {
      return [];
    }

    try {
      return await this.adapter.listBusySlots(input);
    } catch {
      return [];
    }
  }
}

function createCalendarAdapter(provider: string | undefined): CalendarAdapter | undefined {
  return provider === "mock" ? new MockCalendarAdapter() : undefined;
}
