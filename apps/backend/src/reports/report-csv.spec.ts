import { buildReportCsv } from './report-csv';

describe('buildReportCsv', () => {
  it('escapes quotes and includes counters', () => {
    const csv = buildReportCsv({
      topApps: [
        {
          appName: 'Chat "Safe"',
          packageName: 'com.example.chat',
          durationMillis: 120000,
          sessions: 2,
        },
      ],
      counts: {
        battery: 3,
        locations: 4,
        calls: 5,
        notifications: 6,
      },
    });

    expect(csv).toContain('"Chat ""Safe"""');
    expect(csv).toContain('"counter","notifications","","","","6"');
  });
});
