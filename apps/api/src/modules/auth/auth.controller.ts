import { BadRequestException, Body, Controller, Inject, Post, Res, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { Response } from "express";
import { z } from "zod";

import { CurrentActor, RequirePermissions } from "./auth.decorators.js";
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

const acceptInviteSchema = z.object({
  password: z.string().min(8).max(200),
  token: z.string().min(1)
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email()
});

const resetPasswordSchema = z.object({
  password: z.string().min(8).max(200),
  token: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200)
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
    setSessionCookie(response, result.token);

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

  @Post("accept-invite")
  async acceptInvite(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response
  ): Promise<LoginResponseBody> {
    const parsedBody = acceptInviteSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Token e senha (mínimo 8 caracteres) são obrigatórios.");
    }

    const result = await this.authService.acceptInvite(parsedBody.data.token, parsedBody.data.password);
    setSessionCookie(response, result.token);

    return { actor: result.actor };
  }

  @Post("forgot-password")
  async forgotPassword(@Body() body: unknown): Promise<{ resetLink?: string }> {
    const parsedBody = forgotPasswordSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Email é obrigatório.");
    }

    // Não há integração de envio de email neste projeto (ver limitações da
    // Fase 40): em vez de um link chegar por email, o link de redefinição é
    // devolvido diretamente na resposta para permitir testar o fluxo
    // completo. Isso deliberadamente expõe se um email existe na base —
    // aceitável para um projeto de portfólio/demo, não para produção real.
    const { resetToken } = await this.authService.forgotPassword(parsedBody.data.email);

    return resetToken ? { resetLink: `${webBaseUrl()}/redefinir-senha?token=${resetToken}` } : {};
  }

  @Post("reset-password")
  async resetPassword(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response
  ): Promise<LoginResponseBody> {
    const parsedBody = resetPasswordSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Token e senha (mínimo 8 caracteres) são obrigatórios.");
    }

    const result = await this.authService.resetPassword(parsedBody.data.token, parsedBody.data.password);
    setSessionCookie(response, result.token);

    return { actor: result.actor };
  }

  @Post("change-password")
  @RequirePermissions()
  async changePassword(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Body() body: unknown
  ): Promise<{ success: true }> {
    if (!actor) {
      throw new UnauthorizedException("Ator autenticado não informado.");
    }

    const parsedBody = changePasswordSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BadRequestException("Senha atual e nova senha (mínimo 8 caracteres) são obrigatórias.");
    }

    await this.authService.changePassword(actor, parsedBody.data.currentPassword, parsedBody.data.newPassword);
    return { success: true };
  }
}

function setSessionCookie(response: Response, token: string): void {
  // Sessão fica só no cookie httpOnly — o token nunca é exposto ao JS do
  // navegador (nem no corpo da resposta), reduzindo o impacto de um XSS.
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: SESSION_TTL_MS,
    path: "/",
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction
  });
}

function webBaseUrl(): string {
  return process.env.FIELDOPS_WEB_BASE_URL ?? "http://localhost:3000";
}
