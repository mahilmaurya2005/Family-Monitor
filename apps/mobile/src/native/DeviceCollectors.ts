import { NativeModules } from 'react-native';
import type {
  AppUsageRecord,
  BatteryRecord,
  CallLogRecord,
  LocationRecord,
  NotificationRecord,
} from '@family-monitor/types';

type DeviceCollectorsModule = {
  requestUsageAccess(): Promise<boolean>;
  requestNotificationAccess(): Promise<boolean>;
  getAppUsageSince(timestamp: number): Promise<AppUsageRecord[]>;
  getBatterySnapshot(): Promise<BatteryRecord>;
  getCurrentLocation(): Promise<LocationRecord>;
  getCallLogsSince(timestamp: number): Promise<CallLogRecord[]>;
  getNotificationsSince(timestamp: number): Promise<NotificationRecord[]>;
};

export const DeviceCollectors =
  NativeModules.DeviceCollectors as DeviceCollectorsModule;
