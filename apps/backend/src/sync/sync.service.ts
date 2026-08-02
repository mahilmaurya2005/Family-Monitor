import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedDevice } from '../auth/current-device.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  AppUsageBatchDto,
  BatteryBatchDto,
  CallLogBatchDto,
  LocationBatchDto,
  NotificationBatchDto,
} from './dto';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async appUsage(device: AuthenticatedDevice, dto: AppUsageBatchDto) {
    await this.ensureDevice(device, dto.deviceId);
    await this.prisma.appUsageLog.createMany({
      data: dto.records.map((record) => ({
        deviceId: dto.deviceId,
        packageName: record.packageName,
        appName: record.appName,
        openedAt: new Date(record.openedAt),
        closedAt: record.closedAt ? new Date(record.closedAt) : null,
        durationMillis: record.durationMillis,
      })),
    });
    return this.markSynced(dto.deviceId, dto.records.length);
  }

  async battery(device: AuthenticatedDevice, dto: BatteryBatchDto) {
    await this.ensureDevice(device, dto.deviceId);
    await this.prisma.batteryLog.createMany({
      data: dto.records.map((record) => ({
        deviceId: dto.deviceId,
        level: record.level,
        charging: record.charging,
        ringerMode: record.ringerMode,
        recordedAt: new Date(record.recordedAt),
      })),
    });
    return this.markSynced(dto.deviceId, dto.records.length);
  }

  async location(device: AuthenticatedDevice, dto: LocationBatchDto) {
    await this.ensureDevice(device, dto.deviceId);
    await this.prisma.locationLog.createMany({
      data: dto.records.map((record) => ({
        deviceId: dto.deviceId,
        latitude: record.latitude,
        longitude: record.longitude,
        accuracyM: record.accuracyM,
        recordedAt: new Date(record.recordedAt),
      })),
    });
    return this.markSynced(dto.deviceId, dto.records.length);
  }

  async callLogs(device: AuthenticatedDevice, dto: CallLogBatchDto) {
    await this.ensureDevice(device, dto.deviceId);
    await this.prisma.callLog.createMany({
      data: dto.records.map((record) => ({
        deviceId: dto.deviceId,
        phoneNumber: record.phoneNumber,
        contactName: record.contactName,
        direction: record.direction,
        startedAt: new Date(record.startedAt),
        durationMillis: record.durationMillis,
      })),
    });
    return this.markSynced(dto.deviceId, dto.records.length);
  }

  async notifications(device: AuthenticatedDevice, dto: NotificationBatchDto) {
    await this.ensureDevice(device, dto.deviceId);
    await this.prisma.notificationLog.createMany({
      data: dto.records.map((record) => ({
        deviceId: dto.deviceId,
        packageName: record.packageName,
        appName: record.appName,
        title: record.title,
        body: record.body,
        postedAt: new Date(record.postedAt),
      })),
    });
    return this.markSynced(dto.deviceId, dto.records.length);
  }

  private async ensureDevice(authenticatedDevice: AuthenticatedDevice, deviceId: string) {
    if (authenticatedDevice.id !== deviceId) {
      throw new NotFoundException('Device not found');
    }

    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.ownerId !== authenticatedDevice.ownerId) {
      throw new NotFoundException('Device not found');
    }
  }

  private async markSynced(deviceId: string, accepted: number) {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date() },
    });
    return { accepted };
  }
}
