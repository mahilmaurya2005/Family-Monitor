import { NativeModules } from 'react-native';
import type { DeviceRegistration } from '../storage/deviceRegistration';

type BackgroundSyncSchedulerModule = {
  schedule(
    deviceId: string,
    deviceAccessToken: string,
    apiBaseUrl: string,
    permissionsJson: string,
    lastSyncCursor: number,
    intervalMinutes: number,
  ): Promise<boolean>;
  runOnce(): Promise<boolean>;
  cancel(): Promise<boolean>;
};

const nativeModule = NativeModules.BackgroundSyncScheduler as
  | BackgroundSyncSchedulerModule
  | undefined;

export const BackgroundSyncScheduler = {
  async schedule(registration: DeviceRegistration, intervalMinutes: number, apiBaseUrl: string) {
    if (!nativeModule) {
      return false;
    }
    return nativeModule.schedule(
      registration.deviceId,
      registration.deviceAccessToken,
      apiBaseUrl,
      JSON.stringify(registration.permissions),
      registration.lastSyncCursor,
      intervalMinutes,
    );
  },

  async runOnce() {
    if (!nativeModule) {
      return false;
    }
    return nativeModule.runOnce();
  },

  async cancel() {
    if (!nativeModule) {
      return false;
    }
    return nativeModule.cancel();
  },
};
