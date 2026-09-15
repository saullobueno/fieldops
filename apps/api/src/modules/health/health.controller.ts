import { Controller, Get, Inject } from "@nestjs/common";
import type { HealthCheck } from "@fieldops/types";

import { HealthService, type ReadinessCheck } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  liveness(): HealthCheck {
    return this.healthService.liveness();
  }

  @Get("readiness")
  readiness(): Promise<ReadinessCheck> {
    return this.healthService.readiness();
  }
}
