import type {
  AppUsageRecord,
  BatteryRecord,
  CallLogRecord,
  LocationRecord,
  NotificationRecord,
} from '@family-monitor/types';

export class ApiClient {
  constructor(
    private readonly baseUrl = '/api/v1',
    private readonly getAccessToken?: () => string | null,
  ) {}

  async login(payload: { email: string; password: string }) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async refresh(refreshToken: string) {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(refreshToken: string) {
    return this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async getDevices() {
    return this.request('/devices');
  }

  async getDeviceActivity(deviceId: string) {
    return this.request(`/devices/${encodeURIComponent(deviceId)}/activity`);
  }

  async getDailyReport(deviceId?: string) {
    return this.getReport('daily', deviceId);
  }

  async getWeeklyReport(deviceId?: string) {
    return this.getReport('weekly', deviceId);
  }

  async getMonthlyReport(deviceId?: string) {
    return this.getReport('monthly', deviceId);
  }

  async getAuditLogs() {
    return this.request('/audit-logs');
  }

  async exportReportCsv(period: 'daily' | 'weekly' | 'monthly', deviceId?: string) {
    const query = new URLSearchParams({ period });
    if (deviceId) {
      query.set('deviceId', deviceId);
    }
    return this.requestText(`/reports/export.csv?${query.toString()}`);
  }

  async createPairingCode(payload: { label?: string }) {
    return this.request('/devices/pairing-codes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async registerDevice(payload: {
    displayName: string;
    deviceIdentifier: string;
    appVersion?: string;
    permissions: Array<{ type: string; granted: boolean }>;
  }) {
    return this.request('/devices/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async pairDevice(payload: {
    pairingCode: string;
    displayName: string;
    deviceIdentifier: string;
    appVersion?: string;
    permissions: Array<{ type: string; granted: boolean }>;
  }) {
    return this.request('/devices/pair', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async syncAppUsage(deviceId: string, records: AppUsageRecord[]) {
    return this.sync('/sync/app-usage', deviceId, records);
  }

  async syncBattery(deviceId: string, records: BatteryRecord[]) {
    return this.sync('/sync/battery', deviceId, records);
  }

  async syncLocation(deviceId: string, records: LocationRecord[]) {
    return this.sync('/sync/location', deviceId, records);
  }

  async syncCallLogs(deviceId: string, records: CallLogRecord[]) {
    return this.sync('/sync/call-logs', deviceId, records);
  }

  async syncNotifications(deviceId: string, records: NotificationRecord[]) {
    return this.sync('/sync/notifications', deviceId, records);
  }

  async replay(path: string, payload: unknown) {
    return this.request(path, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  private sync(path: string, deviceId: string, records: unknown[]) {
    return this.request(path, {
      method: 'POST',
      body: JSON.stringify({ deviceId, records }),
    });
  }

  private getReport(period: 'daily' | 'weekly' | 'monthly', deviceId?: string) {
    const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
    return this.request(`/reports/${period}${query}`);
  }

  private async request(path: string, init?: RequestInit) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.authHeader(),
      ...(init?.headers as Record<string, string> | undefined),
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      headers,
      ...init,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body ? `API request failed: ${response.status} ${body}` : `API request failed: ${response.status}`);
    }

    return response.json();
  }

  private async requestText(path: string, init?: RequestInit) {
    const headers: Record<string, string> = {
      ...this.authHeader(),
      ...(init?.headers as Record<string, string> | undefined),
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      headers,
      ...init,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body ? `API request failed: ${response.status} ${body}` : `API request failed: ${response.status}`);
    }

    return response.text();
  }

  private authHeader(): Record<string, string> {
    const token = this.getAccessToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
