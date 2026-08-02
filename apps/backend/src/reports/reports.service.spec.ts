import { ReportsService } from './reports.service';

function createService() {
  const prisma = {
    appUsageLog: {
      groupBy: jest.fn().mockResolvedValue([
        {
          packageName: 'com.example',
          appName: 'Example',
          _sum: { durationMillis: 60000 },
          _count: 2,
        },
      ]),
    },
    batteryLog: { count: jest.fn().mockResolvedValue(1) },
    locationLog: { count: jest.fn().mockResolvedValue(2) },
    callLog: { count: jest.fn().mockResolvedValue(3) },
    notificationLog: { count: jest.fn().mockResolvedValue(4) },
  };
  const audit = { record: jest.fn() };

  return {
    service: new ReportsService(prisma as never, audit as never),
    prisma,
    audit,
  };
}

describe('ReportsService', () => {
  it('scopes summaries by owner and optional device id', async () => {
    const { service, prisma, audit } = createService();

    const report = await service.summary('user-1', 'daily', 'device-1');

    expect(report.topApps[0]).toEqual({
      packageName: 'com.example',
      appName: 'Example',
      durationMillis: 60000,
      sessions: 2,
    });
    expect(prisma.appUsageLog.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deviceId: 'device-1',
          device: { ownerId: 'user-1', id: 'device-1' },
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith('user-1', 'report.view', 'report:daily', {
      deviceId: 'device-1',
    });
  });

  it('exports CSV and audits export', async () => {
    const { service, audit } = createService();

    const csv = await service.exportCsv('user-1', 'weekly');

    expect(csv).toContain('"app_usage","Example","com.example","60000","2",""');
    expect(audit.record).toHaveBeenCalledWith(
      'user-1',
      'report.export.csv',
      'report:weekly',
      { deviceId: undefined },
    );
  });
});
