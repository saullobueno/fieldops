import { BadRequestException, Body, Controller, Inject, Post, Res } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { Response } from "express";
import { z } from "zod";

import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export interface LoginResponseBody {
  readonly actor: AuthenticatedActor;
}

const isProduction = process.env.NODE_ENV === "production";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response
  ): Promise<LoginResponseBody> {
    const parsedBody = loginSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Email e senha são obrigatórios.");
    }

    const result = await this.authService.login(parsedBody.data.email, parsedBody.data.password);

    // Sessão fica só no cookie httpOnly — o token nunca é exposto ao JS do
    // navegador (nem no corpo desta resposta), reduzindo o impacto de um XSS.
    response.cookie(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      maxAge: SESSION_TTL_MS,
      path: "/",
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction
    });

    return { actor: result.actor };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response): { success: true } {
    // JS não consegue apagar um cookie httpOnly sozinho; precisa desse round-trip.
    response.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      path: "/",
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction
    });

    return { success: true };
  }
}
