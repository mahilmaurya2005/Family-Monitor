export type PermissionType =
  | 'APP_USAGE'
  | 'LOCATION'
  | 'CALL_LOGS'
  | 'NOTIFICATIONS'
  | 'BATTERY'
  | 'INSTALLED_APPS';

export type DeviceSummary = {
  id: string;
  displayName: string;
  platform: 'ANDROID';
  lastSyncAt: string | null;
  permissions: PermissionState[];
};

export type PermissionState = {
  type: PermissionType;
  granted: boolean;
  disclosedAt: string;
  grantedAt?: string | null;
  revokedAt?: string | null;
};

export type AppUsageRecord = {
  packageName: string;
  appName?: string;
  openedAt: string;
  closedAt?: string;
  durationMillis: number;
};

export type BatteryRecord = {
  level: number;
  charging: boolean;
  ringerMode?: 'silent' | 'vibrate' | 'normal' | 'unknown';
  recordedAt: string;
};

export type LocationRecord = {
  latitude: number;
  longitude: number;
  accuracyM?: number;
  recordedAt: string;
};

export type CallLogRecord = {
  phoneNumber: string;
  contactName?: string;
  direction: string;
  startedAt: string;
  durationMillis: number;
};

export type NotificationRecord = {
  packageName: string;
  appName?: string;
  title?: string;
  body?: string;
  postedAt: string;
};
