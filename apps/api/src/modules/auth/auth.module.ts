import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";

import { InfrastructureModule } from "../infrastructure/infrastructure.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";

@Module({
  controllers: [AuthController],
  imports: [InfrastructureModule],
  providers: [
    AuthService,
    Reflector,
    {
      provide: APP_GUARD,
      inject: [Reflector],
      useFactory: (reflector: Reflector): AuthGuard => new AuthGuard(reflector)
    }
  ]
})
export class AuthModule {}
