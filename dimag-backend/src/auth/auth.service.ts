import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  login(username: string, password: string): { token: string; role: string; username: string } {
    const adminUser = this.config.get<string>('ADMIN_USERNAME') ?? 'admin';
    const adminPass = this.config.get<string>('ADMIN_PASSWORD');

    if (!adminPass) throw new UnauthorizedException('Server not configured');

    if (username === adminUser && password === adminPass) {
      const token = this.jwt.sign({ sub: username, role: 'admin' });
      return { token, role: 'admin', username };
    }

    // Vendor credentials stored as VENDOR_<USERNAME>=<password> in env vars
    const vendorPass = this.config.get<string>(`VENDOR_${username.toUpperCase()}`);
    if (vendorPass && password === vendorPass) {
      const token = this.jwt.sign({ sub: username, role: 'vendedor' });
      return { token, role: 'vendedor', username };
    }

    throw new UnauthorizedException('Credenciales incorrectas');
  }
}
