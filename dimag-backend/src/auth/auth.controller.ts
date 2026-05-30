import { Controller, Post, Body, HttpCode, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body('username') username: string, @Body('password') password: string) {
    if (!username || !password) throw new UnauthorizedException('Credenciales requeridas');
    return this.authService.login(username, password);
  }
}
