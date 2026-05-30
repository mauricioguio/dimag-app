import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];

    // Also accept legacy X-Admin-Key during transition period
    const adminKey = this.config.get<string>('ADMIN_API_KEY');
    if (adminKey && req.headers['x-admin-key'] === adminKey) return true;

    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException();

    try {
      const token = authHeader.slice(7);
      const secret = this.config.get<string>('JWT_SECRET') ?? 'fallback-secret';
      const payload = this.jwt.verify(token, { secret });
      req['user'] = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
