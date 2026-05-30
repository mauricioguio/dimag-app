import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();

    // Legacy X-Admin-Key support during transition
    const adminKey = this.config.get<string>('ADMIN_API_KEY');
    if (adminKey && req.headers['x-admin-key'] === adminKey) return true;

    const authHeader: string | undefined = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException();

    try {
      const token = authHeader.slice(7);
      const secret = this.config.get<string>('JWT_SECRET') ?? 'fallback-secret';
      const payload = this.jwt.verify(token, { secret }) as { role: string };
      if (payload.role !== 'admin') throw new ForbiddenException();
      req['user'] = payload;
      return true;
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new UnauthorizedException();
    }
  }
}
