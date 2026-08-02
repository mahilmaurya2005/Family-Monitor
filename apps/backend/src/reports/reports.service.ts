import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildReportCsv } from './report-csv';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async summary(ownerId: string, period: 'daily' | 'weekly' | 'monthly', deviceId?: string) {
    const now = new Date();
    const startsAt = this.getStartDate(period, now);
    const devices = await this.prisma.device.findMany({
      where: {
        ownerId,
        ...(deviceId ? { id: deviceId } : {}),
      },
      select: { id: true },
    });
    const deviceIds = devices.map((device) => device.id);

    if (deviceIds.length === 0) {
      return this.emptyReport(period, startsAt, now);
    }

    const where = {
      deviceId: { in: deviceIds },
      openedAt: { gte: startsAt, lte: now },
    };

    const usage = await this.prisma.appUsageLog.groupBy({
      by: ['packageName', 'appName'],
      where,
      _sum: { durationMillis: true },
      _count: true,
      orderBy: { _sum: { durationMillis: 'desc' } },
      take: 10,
    });
    const batteryCount = await this.prisma.batteryLog.count({
      where: {
        deviceId: { in: deviceIds },
        recordedAt: { gte: startsAt },
      },
    });
    const locationCount = await this.prisma.locationLog.count({
      where: {
        deviceId: { in: deviceIds },
        recordedAt: { gte: startsAt },
      },
    });
    const callCount = await this.prisma.callLog.count({
      where: {
        deviceId: { in: deviceIds },
        startedAt: { gte: startsAt },
      },
    });
    const notificationCount = await this.prisma.notificationLog.count({
      where: {
        deviceId: { in: deviceIds },
        postedAt: { gte: startsAt },
      },
    });

    void Promise.resolve(
      this.audit.record(ownerId, 'report.view', `report:${period}`, { deviceId }),
    ).catch(() => undefined);

    return {
      period,
      startsAt,
      endsAt: now,
      topApps: usage.map((app) => ({
        packageName: app.packageName,
        appName: app.appName,
        durationMillis: app._sum.durationMillis ?? 0,
        sessions: app._count,
      })),
      counts: {
        battery: batteryCount,
        locations: locationCount,
        calls: callCount,
        notifications: notificationCount,
      },
    };
  }

  async exportCsv(
    ownerId: string,
    period: 'daily' | 'weekly' | 'monthly',
    deviceId?: string,
  ) {
    const report = await this.summary(ownerId, period, deviceId);
    await this.audit.record(ownerId, 'report.export.csv', `report:${period}`, { deviceId });

    return buildReportCsv(report);
  }

  private getStartDate(period: 'daily' | 'weekly' | 'monthly', now: Date) {
    const startsAt = new Date(now);
    if (period === 'daily') {
      startsAt.setHours(0, 0, 0, 0);
    }
    if (period === 'weekly') {
      startsAt.setDate(startsAt.getDate() - 7);
    }
    if (period === 'monthly') {
      startsAt.setMonth(startsAt.getMonth() - 1);
    }
    return startsAt;
  }

  private emptyReport(period: 'daily' | 'weekly' | 'monthly', startsAt: Date, endsAt: Date) {
    return {
      period,
      startsAt,
      endsAt,
      topApps: [],
      counts: {
        battery: 0,
        locations: 0,
        calls: 0,
        notifications: 0,
      },
    };
  }
}
