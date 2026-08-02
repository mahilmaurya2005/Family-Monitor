import {
  Activity,
  BatteryCharging,
  Bell,
  CheckCircle2,
  FileDown,
  Gauge,
  MapPin,
  MonitorSmartphone,
  Phone,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiClient } from '@family-monitor/api-client';
import { formatDuration, formatLastSync } from '@family-monitor/utils';

type ViewName =
  | 'Overview'
  | 'Devices'
  | 'Activity'
  | 'Location'
  | 'Reports'
  | 'Settings'
  | 'Audit Logs';

type DeviceFromApi = {
  id: string;
  displayName: string;
  lastSyncAt: string | null;
  permissions: Array<{ type: string; granted: boolean }>;
};

type ReportFromApi = {
  topApps: Array<{
    appName: string | null;
    packageName: string;
    durationMillis: number;
    sessions?: number;
  }>;
  counts: {
    battery: number;
    locations: number;
    calls: number;
    notifications: number;
  };
};

type AuditLogFromApi = {
  id: string;
  action: string;
  target: string;
  metadata?: unknown;
  createdAt: string;
};

type ReportPeriodName = 'daily' | 'weekly' | 'monthly';
type DetailType = 'APP_USAGE' | 'LOCATION' | 'BATTERY' | 'CALL_LOGS' | 'NOTIFICATIONS';

type DeviceActivity = {
  battery: Array<{ level: number; charging: boolean; ringerMode?: string | null; recordedAt: string }>;
  location: Array<{ latitude: number; longitude: number; accuracyM: number | null; recordedAt: string }>;
  appUsage: Array<{
    appName: string | null;
    packageName: string;
    openedAt: string;
    closedAt: string | null;
    durationMillis: number;
  }>;
  calls: Array<{
    phoneNumber: string;
    contactName: string | null;
    direction: string;
    startedAt: string;
    durationMillis: number;
  }>;
  notifications: Array<{
    appName: string | null;
    packageName: string;
    title: string | null;
    body: string | null;
    postedAt: string;
  }>;
};

type LatestLocation = {
  deviceId: string;
  deviceName: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  recordedAt: string;
};

const emptyDevices: DeviceFromApi[] = [];

const emptyReport: ReportFromApi = {
  topApps: [],
  counts: {
    battery: 0,
    locations: 0,
    calls: 0,
    notifications: 0,
  },
};

const emptyAuditLogs: AuditLogFromApi[] = [];

const navItems: Array<{ label: ViewName; icon: typeof Gauge }> = [
  { label: 'Overview', icon: Gauge },
  { label: 'Devices', icon: MonitorSmartphone },
  { label: 'Activity', icon: Activity },
  { label: 'Location', icon: MapPin },
  { label: 'Reports', icon: FileDown },
  { label: 'Settings', icon: Settings },
  { label: 'Audit Logs', icon: Users },
];

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export function App() {
  const [activeView, setActiveView] = useState<ViewName>('Overview');
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('ChangeMe123!');
  const [token, setToken] = useState(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [refreshToken, setRefreshToken] = useState(() =>
    localStorage.getItem(REFRESH_TOKEN_KEY),
  );
  const [devices, setDevices] = useState<DeviceFromApi[]>(emptyDevices);
  const [report, setReport] = useState<ReportFromApi>(emptyReport);
  const [weeklyReport, setWeeklyReport] = useState<ReportFromApi>(emptyReport);
  const [monthlyReport, setMonthlyReport] = useState<ReportFromApi>(emptyReport);
  const [auditLogs, setAuditLogs] = useState<AuditLogFromApi[]>(emptyAuditLogs);
  const [latestLocations, setLatestLocations] = useState<LatestLocation[]>([]);
  const [status, setStatus] = useState('Sign in to load live data');
  const [exportPeriod, setExportPeriod] = useState<ReportPeriodName>('daily');
  const [pairingLabel, setPairingLabel] = useState('New family device');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<{
    deviceId: string;
    deviceName: string;
    type: DetailType;
  } | null>(null);
  const [deviceActivity, setDeviceActivity] = useState<DeviceActivity | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const api = useMemo(() => new ApiClient('/api/v1', () => token), [token]);

  useEffect(() => {
    if (!token && refreshToken) {
      void refreshSession(refreshToken);
    }
  }, [refreshToken, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    void loadLiveData(active);
    const interval = window.setInterval(() => {
      void loadLiveData(active, false);
    }, 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [api, token]);

  useEffect(() => {
    if (!token || !selectedDetail) {
      return;
    }

    const interval = window.setInterval(() => {
      const device = devices.find((item) => item.id === selectedDetail.deviceId);
      if (device) {
        void openDeviceDetail(device, selectedDetail.type, false);
      }
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [devices, selectedDetail, token]);

  useEffect(() => {
    if (!refreshToken) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshSession(refreshToken);
    }, 1000 * 60 * 12);

    return () => window.clearInterval(interval);
  }, [refreshToken]);

  useEffect(() => {
    if (!token || activeView !== 'Reports') {
      return;
    }

    void loadExtendedReports();
  }, [activeView, token]);

  async function login() {
    setStatus('Signing in...');
    try {
      const response = await api.login({ email, password });
      saveSession(response.accessToken, response.refreshToken);
      setStatus('Signed in');
    } catch {
      setStatus('Login failed');
    }
  }

  async function logout() {
    const tokenToRevoke = refreshToken;
    clearSession();
    if (tokenToRevoke) {
      try {
        await api.logout(tokenToRevoke);
      } catch {
        // Local logout still succeeds if the backend is unavailable.
      }
    }
    setStatus('Signed out');
  }

  async function refreshSession(tokenToRefresh: string) {
    try {
      const response = await api.refresh(tokenToRefresh);
      saveSession(response.accessToken, response.refreshToken);
      setStatus('Session refreshed');
    } catch {
      clearSession();
      setStatus('Session expired');
    }
  }

  function saveSession(accessToken: string, nextRefreshToken: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken);
    setToken(accessToken);
    setRefreshToken(nextRefreshToken);
  }

  function clearSession() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setToken(null);
    setRefreshToken(null);
  }

  async function createPairingCode() {
    if (!token) {
      setStatus('Sign in before creating a pairing code');
      return;
    }

    setStatus('Creating pairing code...');
    try {
      const response = await api.createPairingCode({ label: pairingLabel });
      setPairingCode(response.code);
      setPairingExpiresAt(response.expiresAt);
      setStatus('Pairing code ready');
    } catch {
      setStatus('Could not create pairing code');
    }
  }

  async function exportCsv() {
    if (!token) {
      setStatus('Sign in before exporting reports');
      return;
    }

    try {
      const csv = await api.exportReportCsv(exportPeriod);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `family-monitor-${exportPeriod}-report.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('CSV export downloaded');
    } catch {
      setStatus('CSV export failed');
    }
  }

  async function loadLiveData(active = true, showLoading = true) {
    if (!token) {
      setStatus('Sign in to load live data');
      return;
    }

    if (showLoading) {
      setStatus('Loading live data...');
    }
    const failures: string[] = [];
    const safeLoad = async <T,>(label: string, request: () => Promise<T>, fallback: T) => {
      try {
        return await request();
      } catch {
        failures.push(label);
        return fallback;
      }
    };

    try {
      const deviceResponse = await safeLoad('devices', () => api.getDevices(), devices);
      const typedDevices = deviceResponse as DeviceFromApi[];
      const dailyResponse = await safeLoad('daily report', () => api.getDailyReport(), report);
      const auditResponse = await safeLoad('audit logs', () => api.getAuditLogs(), auditLogs);
      const locationResponse: Array<LatestLocation | null> = [];
      for (const device of typedDevices) {
        try {
          const activity = await api.getDeviceActivity(device.id);
          const latest = activity.location[0];
          locationResponse.push(
            latest
              ? {
                  deviceId: device.id,
                  deviceName: device.displayName,
                  latitude: latest.latitude,
                  longitude: latest.longitude,
                  accuracyM: latest.accuracyM,
                  recordedAt: latest.recordedAt,
                }
              : null,
          );
        } catch {
          failures.push(`${device.displayName} activity`);
        }
      }
      if (!active) {
        return;
      }
      setDevices(typedDevices);
      setReport(dailyResponse);
      setAuditLogs(auditResponse);
      setLatestLocations(locationResponse.filter(isLatestLocation));
      setStatus(failures.length ? `Partial data loaded: ${failures.join(', ')}` : 'Live backend data');
    } catch {
      if (!active) {
        return;
      }
      setDevices(emptyDevices);
      setReport(emptyReport);
      setWeeklyReport(emptyReport);
      setMonthlyReport(emptyReport);
      setAuditLogs(emptyAuditLogs);
      setLatestLocations([]);
      setStatus('Backend unavailable');
    }
  }

  async function loadExtendedReports() {
    const failures: string[] = [];
    try {
      setWeeklyReport(await api.getWeeklyReport());
    } catch {
      failures.push('weekly report');
    }
    try {
      setMonthlyReport(await api.getMonthlyReport());
    } catch {
      failures.push('monthly report');
    }
    setStatus(failures.length ? `Partial reports loaded: ${failures.join(', ')}` : 'Reports loaded');
  }

  async function openDeviceDetail(device: DeviceFromApi, type: DetailType, showLoading = true) {
    if (!token) {
      setStatus('Sign in before opening device details');
      return;
    }

    setSelectedDetail({ deviceId: device.id, deviceName: device.displayName, type });
    if (showLoading) {
      setDetailLoading(true);
    }
    try {
      const activity = await api.getDeviceActivity(device.id);
      setDeviceActivity(activity);
      setStatus(`${type.replace('_', ' ')} details loaded`);
    } catch {
      setDeviceActivity(null);
      setStatus('Could not load device details');
    } finally {
      if (showLoading) {
        setDetailLoading(false);
      }
    }
  }

  const totalScreenTime = report.topApps.reduce(
    (total, app) => total + app.durationMillis,
    0,
  );

  if (!token) {
    return (
      <LoginPage
        email={email}
        password={password}
        status={status}
        onEmailChange={setEmail}
        onLogin={login}
        onPasswordChange={setPassword}
      />
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-zinc-200 bg-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center gap-3 px-5">
          <ShieldCheck className="h-6 w-6 text-teal" aria-hidden="true" />
          <div>
            <h1 className="text-base font-semibold">Family Monitor</h1>
            <p className="text-xs text-zinc-500">Consent admin</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:pb-0">
          {navItems.map((item) => (
            <button
              className={`flex min-h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium lg:w-full ${
                activeView === item.label
                  ? 'bg-mist text-teal'
                  : 'text-zinc-700 hover:bg-mist'
              }`}
              key={item.label}
              onClick={() => setActiveView(item.label)}
              title={item.label}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 sm:px-6">
          <div>
            <h2 className="text-xl font-semibold">{activeView}</h2>
            <p className="text-sm text-zinc-500">Multi-device activity and permission status</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                className="h-9 w-48 rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal"
                placeholder="Search devices"
              />
            </div>
            <select
              className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm outline-none focus:border-teal"
              onChange={(event) => setExportPeriod(event.target.value as ReportPeriodName)}
              value={exportPeriod}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <button
              className="flex h-9 items-center gap-2 rounded-md bg-teal px-3 text-sm font-semibold text-white"
              onClick={exportCsv}
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
            <button
              className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-semibold"
              onClick={() => void loadLiveData()}
              type="button"
            >
              Refresh
            </button>
            <button
              className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-semibold"
              onClick={logout}
              type="button"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="border-b border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500 sm:px-6">
          {status}
        </section>

        <section className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
          <Metric icon={MonitorSmartphone} label="Registered devices" value={`${devices.length}`} />
          <Metric icon={Activity} label="Screen time today" value={formatDuration(totalScreenTime)} />
          <Metric icon={MapPin} label="Location points" value={`${report.counts.locations}`} />
          <Metric icon={Bell} label="Notification events" value={`${report.counts.notifications}`} />
        </section>

        {activeView === 'Overview' ? (
          <OverviewView report={report} devices={devices} onOpenDetail={openDeviceDetail} />
        ) : null}
        {activeView === 'Devices' ? (
          <DevicesView
            createPairingCode={createPairingCode}
            devices={devices}
            onOpenDetail={openDeviceDetail}
            pairingCode={pairingCode}
            pairingExpiresAt={pairingExpiresAt}
            pairingLabel={pairingLabel}
            setPairingLabel={setPairingLabel}
          />
        ) : null}
        {activeView === 'Activity' ? <ActivityView report={report} /> : null}
        {activeView === 'Location' ? (
          <LocationView
            count={report.counts.locations}
            devices={devices}
            latestLocations={latestLocations}
          />
        ) : null}
        {activeView === 'Reports' ? (
          <ReportsView daily={report} weekly={weeklyReport} monthly={monthlyReport} />
        ) : null}
        {activeView === 'Settings' ? <SettingsView token={token} /> : null}
        {activeView === 'Audit Logs' ? <AuditView auditLogs={auditLogs} /> : null}
        {selectedDetail ? (
          <ActivityBreakdown
            activity={deviceActivity}
            loading={detailLoading}
            onRefresh={() => {
              const device = devices.find((item) => item.id === selectedDetail.deviceId);
              if (device) {
                void openDeviceDetail(device, selectedDetail.type);
              }
            }}
            selection={selectedDetail}
          />
        ) : null}
      </main>
    </div>
  );
}

function LoginPage({
  email,
  password,
  status,
  onEmailChange,
  onLogin,
  onPasswordChange,
}: {
  email: string;
  password: string;
  status: string;
  onEmailChange: (value: string) => void;
  onLogin: () => void;
  onPasswordChange: (value: string) => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-mist px-4 py-8">
      <section className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-teal text-white">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Family Monitor</h1>
            <p className="text-sm text-zinc-500">Admin login</p>
          </div>
        </div>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void onLogin();
          }}
        >
          <label className="grid gap-1 text-sm font-semibold">
            Email
            <input
              className="h-10 rounded-md border border-zinc-300 px-3 text-sm font-normal outline-none focus:border-teal"
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="admin@example.com"
              type="email"
              value={email}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Password
            <input
              className="h-10 rounded-md border border-zinc-300 px-3 text-sm font-normal outline-none focus:border-teal"
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Password"
              type="password"
              value={password}
            />
          </label>
          <button
            className="mt-2 h-10 rounded-md bg-teal px-4 text-sm font-semibold text-white"
            type="submit"
          >
            Sign in
          </button>
          <p className="min-h-5 text-sm text-zinc-500">{status}</p>
        </form>
      </section>
    </main>
  );
}

function OverviewView({
  devices,
  onOpenDetail,
  report,
}: {
  devices: DeviceFromApi[];
  onOpenDetail: (device: DeviceFromApi, type: DetailType) => void;
  report: ReportFromApi;
}) {
  return (
    <>
      <section className="grid gap-5 px-4 pb-6 sm:px-6 xl:grid-cols-[1.1fr_0.9fr]">
        <DevicesPanel devices={devices} onOpenDetail={onOpenDetail} />
        <AppUsagePanel report={report} />
      </section>
      <section className="grid gap-5 px-4 pb-8 sm:px-6 xl:grid-cols-3">
        <StatusPanel
          icon={Phone}
          title="Call Logs"
          text="Enabled only on devices where the Android call-log permission is granted."
        />
        <StatusPanel
          icon={Bell}
          title="Notifications"
          text="Requires manual Notification Access approval on each device."
        />
        <StatusPanel
          icon={Users}
          title="Audit Logs"
          text="Admin access and report exports will be recorded for accountability."
        />
      </section>
    </>
  );
}

function DevicesView({
  createPairingCode,
  devices,
  onOpenDetail,
  pairingCode,
  pairingExpiresAt,
  pairingLabel,
  setPairingLabel,
}: {
  createPairingCode: () => void;
  devices: DeviceFromApi[];
  onOpenDetail: (device: DeviceFromApi, type: DetailType) => void;
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  pairingLabel: string;
  setPairingLabel: (value: string) => void;
}) {
  return (
    <section className="grid gap-5 px-4 pb-8 sm:px-6 xl:grid-cols-[0.8fr_1.2fr]">
      <CollapsibleCard title="Pair New Device" bodyClassName="grid gap-3 p-4">
        <input
          className="h-9 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-teal"
          onChange={(event) => setPairingLabel(event.target.value)}
          placeholder="Device label"
          value={pairingLabel}
        />
        <button
          className="h-9 rounded-md bg-teal px-3 text-sm font-semibold text-white"
          onClick={createPairingCode}
        >
          Generate pairing code
        </button>
        <div className="min-h-16 rounded-md border border-zinc-200 bg-mist p-3 text-sm">
          {pairingCode ? (
            <>
              <p className="text-2xl font-semibold text-teal">{pairingCode}</p>
              <p className="mt-1 text-zinc-500">
                Expires {pairingExpiresAt ? formatLastSync(pairingExpiresAt) : 'soon'}
              </p>
            </>
          ) : (
            <p className="text-zinc-500">Generate code, then enter it on the mobile app.</p>
          )}
        </div>
      </CollapsibleCard>
      <DevicesPanel devices={devices} onOpenDetail={onOpenDetail} />
    </section>
  );
}

function ActivityView({ report }: { report: ReportFromApi }) {
  return (
    <section className="grid gap-5 px-4 pb-8 sm:px-6 xl:grid-cols-[1fr_1fr]">
      <AppUsagePanel report={report} />
      <CollapsibleCard title="Activity Counters" bodyClassName="grid gap-3 p-4">
        <CounterRow label="Battery samples" value={report.counts.battery} />
        <CounterRow label="Location points" value={report.counts.locations} />
        <CounterRow label="Call log entries" value={report.counts.calls} />
        <CounterRow label="Notification events" value={report.counts.notifications} />
      </CollapsibleCard>
    </section>
  );
}

function LocationView({
  count,
  devices,
  latestLocations,
}: {
  count: number;
  devices: DeviceFromApi[];
  latestLocations: LatestLocation[];
}) {
  const locationByDevice = new Map(
    latestLocations.map((location) => [location.deviceId, location]),
  );
  const latestPoint = [...latestLocations].sort(
    (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
  )[0] ?? null;
  const mapsUrl = latestPoint
    ? `https://www.google.com/maps?q=${latestPoint.latitude},${latestPoint.longitude}`
    : null;
  const embedUrl = latestPoint
    ? `https://maps.google.com/maps?q=${latestPoint.latitude},${latestPoint.longitude}&z=15&output=embed`
    : null;

  return (
    <section className="grid gap-5 px-4 pb-8 sm:px-6 xl:grid-cols-[1fr_1fr]">
      <CollapsibleCard title="Location Timeline" bodyClassName="grid gap-3 p-4">
        {devices.map((device) => {
          const point = locationByDevice.get(device.id);
          return (
            <div className="rounded-md border border-zinc-200 p-3" key={device.id}>
              <p className="font-medium">{device.displayName}</p>
              <p className="text-sm text-zinc-500">
                {point
                  ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)} - ${formatLastSync(point.recordedAt)}`
                  : `No recent point - ${formatLastSync(device.lastSyncAt)}`}
              </p>
            </div>
          );
        })}
      </CollapsibleCard>
      <CollapsibleCard title="Map Ready">
        {latestPoint && embedUrl && mapsUrl ? (
          <div className="grid gap-3">
            <div className="overflow-hidden rounded-md border border-zinc-200">
              <iframe
                className="h-64 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={embedUrl}
                title={`Google Maps location for ${latestPoint.deviceName}`}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-zinc-500">
                <p className="font-medium text-zinc-900">{latestPoint.deviceName}</p>
                <p>
                  {latestPoint.latitude.toFixed(6)}, {latestPoint.longitude.toFixed(6)} -{' '}
                  {formatLastSync(latestPoint.recordedAt)}
                </p>
                <p>
                  Accuracy {latestPoint.accuracyM ? `${Math.round(latestPoint.accuracyM)}m` : 'Unknown'}
                </p>
                <p>{count} location points tracked</p>
              </div>
              <a
                className="rounded-md bg-teal px-3 py-2 text-sm font-semibold text-white"
                href={mapsUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open in Google Maps
              </a>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 text-sm leading-6 text-zinc-500">
            <MapPin className="mt-0.5 h-5 w-5 text-teal" aria-hidden="true" />
            <p>No location point available yet.</p>
          </div>
        )}
      </CollapsibleCard>
    </section>
  );
}

function ReportsView({
  daily,
  weekly,
  monthly,
}: {
  daily: ReportFromApi;
  weekly: ReportFromApi;
  monthly: ReportFromApi;
}) {
  return (
    <section className="grid gap-5 px-4 pb-8 sm:px-6 xl:grid-cols-3">
      <ReportPeriod title="Daily" report={daily} />
      <ReportPeriod title="Weekly" report={weekly} />
      <ReportPeriod title="Monthly" report={monthly} />
    </section>
  );
}

function SettingsView({ token }: { token: string | null }) {
  return (
    <section className="grid gap-5 px-4 pb-8 sm:px-6 xl:grid-cols-2">
      <CollapsibleCard title="Account">
        <Settings className="h-5 w-5 text-teal" aria-hidden="true" />
        <p className="mt-1 text-sm text-zinc-500">
          {token ? 'Admin session is active.' : 'Sign in to connect live backend data.'}
        </p>
      </CollapsibleCard>
      <CollapsibleCard title="Consent Controls">
        <ShieldCheck className="h-5 w-5 text-teal" aria-hidden="true" />
        <p className="mt-1 text-sm leading-6 text-zinc-500">
          Device permissions are managed on each mobile app. Admin actions should be audited before
          production release.
        </p>
      </CollapsibleCard>
    </section>
  );
}

function AuditView({ auditLogs }: { auditLogs: AuditLogFromApi[] }) {
  return (
    <section className="px-4 pb-8 sm:px-6">
      <CollapsibleCard title="Audit Trail" bodyClassName="divide-y divide-zinc-200 p-0">
        {auditLogs.map((event) => (
          <div className="flex items-center gap-3 p-4" key={event.id}>
            <CheckCircle2 className="h-4 w-4 text-lime" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">{event.action}</p>
              <p className="text-xs text-zinc-500">
                {event.target} - {formatLastSync(event.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </CollapsibleCard>
    </section>
  );
}

function DevicesPanel({
  devices,
  onOpenDetail,
}: {
  devices: DeviceFromApi[];
  onOpenDetail: (device: DeviceFromApi, type: DetailType) => void;
}) {
  return (
    <CollapsibleCard title="Devices" bodyClassName="divide-y divide-zinc-200 p-0">
      {devices.map((device) => (
        <article className="p-4" key={device.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold">{device.displayName}</h4>
              <p className="text-sm text-zinc-500">
                Family Member - {formatLastSync(device.lastSyncAt)}
              </p>
            </div>
            <span className="rounded-md bg-mist px-2.5 py-1 text-xs font-semibold text-teal">
              {device.lastSyncAt ? 'Online' : 'Pending sync'}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr]">
            <div className="flex items-center gap-2 text-sm">
              <BatteryCharging className="h-4 w-4 text-lime" aria-hidden="true" />
              Sync tracked
            </div>
            <div className="flex flex-wrap gap-2">
              {device.permissions
                .filter((permission) => permission.granted)
                .map((permission) => (
                  <button
                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-teal hover:text-teal"
                    key={permission.type}
                    onClick={() => onOpenDetail(device, permission.type as DetailType)}
                    type="button"
                  >
                    {permission.type.replace('_', ' ')}
                  </button>
                ))}
            </div>
          </div>
        </article>
      ))}
    </CollapsibleCard>
  );
}

function ActivityBreakdown({
  activity,
  loading,
  onRefresh,
  selection,
}: {
  activity: DeviceActivity | null;
  loading: boolean;
  onRefresh: () => void;
  selection: { deviceName: string; type: DetailType };
}) {
  const title = selection.type.replace('_', ' ');
  const [open, setOpen] = useState(true);

  return (
    <section className="px-4 pb-8 sm:px-6">
      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-zinc-500">{selection.deviceName}</p>
          </div>
          <div className="flex items-center gap-2">
            {loading ? <span className="text-sm text-zinc-500">Loading...</span> : null}
            <button
              className="h-8 rounded-md border border-zinc-300 px-3 text-xs font-semibold"
              onClick={onRefresh}
              type="button"
            >
              Refresh
            </button>
            <button
              className="h-8 rounded-md border border-zinc-300 px-3 text-xs font-semibold"
              onClick={() => setOpen((current) => !current)}
              type="button"
            >
              {open ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
        {open ? <div className="p-4">{renderDetail(selection.type, activity)}</div> : null}
      </div>
    </section>
  );
}

function renderDetail(type: DetailType, activity: DeviceActivity | null) {
  if (!activity) {
    return <p className="text-sm text-zinc-500">No detail loaded yet.</p>;
  }

  if (type === 'BATTERY') {
    const latest = activity.battery[0];
    if (!latest) {
      return <p className="text-sm text-zinc-500">No battery samples synced yet.</p>;
    }

    return (
      <div className="grid gap-3 sm:grid-cols-4">
        <CounterRow label="Battery" value={`${latest.level}%`} />
        <CounterRow label="Charging" value={latest.charging ? 'Yes' : 'No'} />
        <CounterRow label="Sound mode" value={formatRingerMode(latest.ringerMode)} />
        <CounterRow label="Recorded" value={formatLastSync(latest.recordedAt)} />
      </div>
    );
  }

  if (type === 'LOCATION') {
    const latest = activity.location[0];
    if (!latest) {
      return <p className="text-sm text-zinc-500">No location points synced yet.</p>;
    }

    const mapsUrl = `https://www.google.com/maps?q=${latest.latitude},${latest.longitude}`;
    return (
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <CounterRow label="Latitude" value={latest.latitude.toFixed(6)} />
          <CounterRow label="Longitude" value={latest.longitude.toFixed(6)} />
          <CounterRow label="Accuracy" value={latest.accuracyM ? `${Math.round(latest.accuracyM)}m` : 'Unknown'} />
        </div>
        <a className="text-sm font-semibold text-teal" href={mapsUrl} rel="noreferrer" target="_blank">
          Open live location
        </a>
        <DetailList
          rows={activity.location.map((point) => ({
            title: `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`,
            meta: `${formatLastSync(point.recordedAt)}${point.accuracyM ? ` - ${Math.round(point.accuracyM)}m` : ''}`,
          }))}
        />
      </div>
    );
  }

  if (type === 'APP_USAGE') {
    return (
      <DetailList
        empty="No app usage synced yet. Android Usage Access must be granted on the phone."
        rows={activity.appUsage.map((app) => ({
          title: app.appName ?? app.packageName,
          meta: `${app.packageName} - ${formatDuration(app.durationMillis)} - ${formatLastSync(app.openedAt)}`,
        }))}
      />
    );
  }

  if (type === 'CALL_LOGS') {
    return (
      <DetailList
        empty="No call logs synced yet. Android Call Logs permission must be granted on the phone."
        rows={activity.calls.map((call) => ({
          title: call.contactName ?? call.phoneNumber,
          meta: `${call.direction} - ${formatDuration(call.durationMillis)} - ${formatLastSync(call.startedAt)}`,
        }))}
      />
    );
  }

  return (
    <DetailList
      empty="No notifications synced yet. Notification Access must be enabled on the phone."
      rows={activity.notifications.map((notification) => ({
        title: notification.title ?? notification.appName ?? notification.packageName,
        meta: `${notification.packageName} - ${formatLastSync(notification.postedAt)}`,
        text: notification.body ?? undefined,
      }))}
    />
  );
}

function DetailList({
  empty = 'No records synced yet.',
  rows,
}: {
  empty?: string;
  rows: Array<{ title: string; meta: string; text?: string }>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }

  const visibleRows = expanded ? rows : rows.slice(0, 5);

  return (
    <div>
      <div className="divide-y divide-zinc-200">
      {visibleRows.map((row, index) => (
        <div className="py-3" key={`${row.title}-${index}`}>
          <p className="text-sm font-semibold">{row.title}</p>
          <p className="mt-1 text-xs text-zinc-500">{row.meta}</p>
          {row.text ? <p className="mt-2 text-sm text-zinc-700">{row.text}</p> : null}
        </div>
      ))}
      </div>
      {rows.length > 5 ? (
        <button
          className="mt-3 h-8 rounded-md border border-zinc-300 px-3 text-xs font-semibold"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? 'Show less' : `Show ${rows.length - 5} more`}
        </button>
      ) : null}
    </div>
  );
}

function AppUsagePanel({ report }: { report: ReportFromApi }) {
  const [expanded, setExpanded] = useState(false);
  const visibleApps = expanded ? report.topApps : report.topApps.slice(0, 5);

  return (
    <CollapsibleCard
      actions={
        report.topApps.length > 5 ? (
          <button
            className="h-8 rounded-md border border-zinc-300 px-3 text-xs font-semibold"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? 'Show less' : `Show ${report.topApps.length}`}
          </button>
        ) : null
      }
      title="App Usage"
    >
      <div className="space-y-4">
        {visibleApps.map((app) => (
          <div key={app.packageName}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{app.appName ?? app.packageName}</span>
              <span className="text-zinc-500">{formatDuration(app.durationMillis)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-sm bg-mist">
              <div
                className="h-full rounded-sm bg-coral"
                style={{ width: `${Math.min(100, Math.max(16, app.durationMillis / 90000))}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {app.packageName}
              {app.sessions ? ` - ${app.sessions} sessions` : ''}
            </p>
          </div>
        ))}
        {report.topApps.length === 0 ? (
          <p className="text-sm text-zinc-500">No app usage synced yet.</p>
        ) : null}
      </div>
    </CollapsibleCard>
  );
}

function ReportPeriod({ report, title }: { report: ReportFromApi; title: string }) {
  const duration = report.topApps.reduce((total, app) => total + app.durationMillis, 0);
  return (
    <CollapsibleCard title={title}>
      <FileDown className="h-5 w-5 text-teal" aria-hidden="true" />
      <p className="mt-1 text-2xl font-semibold">{formatDuration(duration)}</p>
      <div className="mt-4 space-y-2 text-sm text-zinc-600">
        <CounterRow label="Locations" value={report.counts.locations} />
        <CounterRow label="Calls" value={report.counts.calls} />
        <CounterRow label="Notifications" value={report.counts.notifications} />
      </div>
    </CollapsibleCard>
  );
}

function CounterRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-mist px-3 py-2">
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MonitorSmartphone;
  label: string;
  value: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <Icon className="h-5 w-5 text-teal" aria-hidden="true" />
        <button
          className="h-7 rounded-md border border-zinc-300 px-2 text-xs font-semibold"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>
      {open ? (
        <>
          <p className="mt-4 text-sm text-zinc-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </>
      ) : null}
    </div>
  );
}

function StatusPanel({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Phone;
  title: string;
  text: string;
}) {
  return (
    <CollapsibleCard title={title}>
      <Icon className="h-5 w-5 text-coral" aria-hidden="true" />
      <p className="mt-1 text-sm leading-6 text-zinc-500">{text}</p>
    </CollapsibleCard>
  );
}

function CollapsibleCard({
  actions,
  bodyClassName = 'p-4',
  children,
  className = 'rounded-lg border border-zinc-200 bg-white',
  defaultOpen = true,
  title,
}: {
  actions?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <button
            className="h-8 rounded-md border border-zinc-300 px-3 text-xs font-semibold"
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            {open ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      {open ? <div className={bodyClassName}>{children}</div> : null}
    </div>
  );
}

function formatRingerMode(mode?: string | null) {
  if (!mode) {
    return 'Unknown';
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function isLatestLocation(location: LatestLocation | null): location is LatestLocation {
  return location !== null;
}
