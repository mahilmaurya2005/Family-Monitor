import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePairingCodeDto, PairDeviceDto, RegisterDeviceDto } from './dto';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async createPairingCode(ownerId: string, dto: CreatePairingCodeDto) {
    const code = this.generatePairingCode();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15);

    await this.prisma.devicePairingCode.create({
      data: {
        ownerId,
        label: dto.label,
        codeHash: this.hashPairingCode(code),
        expiresAt,
      },
    });

    await this.audit.record(ownerId, 'device.pairing_code.create', 'device-pairing-code', {
      label: dto.label,
      expiresAt,
    });

    return { code, expiresAt };
  }

  async pair(dto: PairDeviceDto) {
    const codeHash = this.hashPairingCode(dto.pairingCode);
    const pairingCode = await this.prisma.devicePairingCode.findUnique({
      where: { codeHash },
    });

    if (!pairingCode || pairingCode.usedAt || pairingCode.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired pairing code');
    }

    const device = await this.register(pairingCode.ownerId, dto);
    await this.prisma.devicePairingCode.update({
      where: { id: pairingCode.id },
      data: { usedAt: new Date() },
    });
    await this.audit.record(pairingCode.ownerId, 'device.pair', `device:${device.id}`, {
      displayName: device.displayName,
    });

    return {
      ...device,
      deviceAccessToken: await this.issueDeviceToken(device.id, pairingCode.ownerId),
    };
  }

  async register(ownerId: string, dto: RegisterDeviceDto) {
    const now = new Date();

    const device = await this.prisma.device.upsert({
      where: { deviceIdentifier: dto.deviceIdentifier },
      update: {
        displayName: dto.displayName,
        appVersion: dto.appVersion,
        lastSyncAt: now,
      },
      create: {
        ownerId,
        displayName: dto.displayName,
        deviceIdentifier: dto.deviceIdentifier,
        appVersion: dto.appVersion,
        lastSyncAt: now,
      },
    });

    await this.prisma.$transaction(
      dto.permissions.map((permission) =>
        this.prisma.devicePermission.upsert({
          where: {
            deviceId_type: {
              deviceId: device.id,
              type: permission.type,
            },
          },
          update: {
            granted: permission.granted,
            grantedAt: permission.granted ? now : null,
            revokedAt: permission.granted ? null : now,
          },
          create: {
            deviceId: device.id,
            type: permission.type,
            granted: permission.granted,
            disclosedAt: now,
            grantedAt: permission.granted ? now : null,
          },
        }),
      ),
    );

    await this.audit.record(ownerId, 'device.register', `device:${device.id}`, {
      displayName: dto.displayName,
      permissionCount: dto.permissions.length,
    });

    return this.get(ownerId, device.id);
  }

  private generatePairingCode() {
    return `${randomInt(100, 999)}-${randomInt(100, 999)}`;
  }

  private hashPairingCode(code: string) {
    return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  }

  private issueDeviceToken(deviceId: string, ownerId: string) {
    return this.jwt.signAsync(
      {
        sub: deviceId,
        ownerId,
        typ: 'device',
      },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: '30d',
      },
    );
  }

  list(ownerId: string) {
    return this.prisma.device.findMany({
      where: { ownerId },
      orderBy: { registeredAt: 'desc' },
      include: { permissions: true },
    });
  }

  async get(ownerId: string, id: string) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!device || device.ownerId !== ownerId) {
      throw new NotFoundException('Device not found');
    }
    return device;
  }

  async activity(ownerId: string, id: string) {
    await this.get(ownerId, id);

    const battery = await this.prisma.batteryLog.findMany({
      where: { deviceId: id },
      orderBy: { recordedAt: 'desc' },
      take: 10,
    });
    const location = await this.prisma.locationLog.findMany({
      where: { deviceId: id },
      orderBy: { recordedAt: 'desc' },
      take: 10,
    });
    const appUsage = await this.prisma.appUsageLog.findMany({
      where: { deviceId: id },
      orderBy: { openedAt: 'desc' },
      take: 25,
    });
    const calls = await this.prisma.callLog.findMany({
      where: { deviceId: id },
      orderBy: { startedAt: 'desc' },
      take: 25,
    });
    const notifications = await this.prisma.notificationLog.findMany({
      where: { deviceId: id },
      orderBy: { postedAt: 'desc' },
      take: 25,
    });

    return {
      battery,
      location,
      appUsage,
      calls,
      notifications,
    };
  }
}
