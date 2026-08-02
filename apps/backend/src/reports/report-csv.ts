type CsvReport = {
  topApps: Array<{
    appName: string | null;
    packageName: string;
    durationMillis: number;
    sessions: number;
  }>;
  counts: {
    battery: number;
    locations: number;
    calls: number;
    notifications: number;
  };
};

export function buildReportCsv(report: CsvReport) {
  const rows = [
    ['section', 'name', 'packageName', 'durationMillis', 'sessions', 'count'],
    ...report.topApps.map((app) => [
      'app_usage',
      app.appName ?? '',
      app.packageName,
      `${app.durationMillis}`,
      `${app.sessions}`,
      '',
    ]),
    ['counter', 'battery', '', '', '', `${report.counts.battery}`],
    ['counter', 'locations', '', '', '', `${report.counts.locations}`],
    ['counter', 'calls', '', '', '', `${report.counts.calls}`],
    ['counter', 'notifications', '', '', '', `${report.counts.notifications}`],
  ];

  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
