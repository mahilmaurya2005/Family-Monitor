import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedDevice } from './current-device.decorator';

type DeviceRequest = {
  headers: {
    authorization?: string;
  };
  device?: AuthenticatedDevice;
};

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DeviceRequest>();
    const token = this.getBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing device token');
    }

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
      if (payload.typ !== 'device') {
        throw new UnauthorizedException('Invalid device token');
      }
      request.device = {
        id: payload.sub,
        ownerId: payload.ownerId,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid device token');
    }
  }

  private getBearerToken(request: DeviceRequest) {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    return header.slice('Bearer '.length);
  }
}
