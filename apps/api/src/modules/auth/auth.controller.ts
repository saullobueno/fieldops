import { BadRequestException, Body, Controller, Inject, Post } from "@nestjs/common";
import { z } from "zod";

import { AuthService, type LoginResult } from "./auth.service.js";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: unknown): Promise<LoginResult> {
    const parsedBody = loginSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Email e senha são obrigatórios.");
    }

    return this.authService.login(parsedBody.data.email, parsedBody.data.password);
  }
}
