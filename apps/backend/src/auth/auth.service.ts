import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, name: true, role: true, passwordHash: true },
    });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.audit.record(user.id, 'auth.login', `user:${user.id}`);

    return this.issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
      const session = await this.prisma.userSession.findUnique({
        where: { id: payload.sid },
        include: { user: true },
      });

      if (
        !session ||
        session.revokedAt ||
        session.expiresAt < new Date() ||
        session.refreshTokenHash !== this.hashToken(refreshToken)
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(session.userId, 'auth.refresh', `session:${session.id}`);

      return this.issueTokens({
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
      await this.prisma.userSession.updateMany({
        where: {
          id: payload.sid,
          refreshTokenHash: this.hashToken(refreshToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(payload.sub, 'auth.logout', `session:${payload.sid}`);
    } catch {
      return { ok: true };
    }

    return { ok: true };
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    name: string;
    role: string;
  }) {
    const sessionId = randomUUID();
    const refreshExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const refreshToken = await this.jwt.signAsync(
      { ...payload, sid: sessionId },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: '30d',
      },
    );

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      user,
      accessToken: await this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      }),
      refreshToken,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
