import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PermissionType } from '@family-monitor/types';

const REGISTRATION_KEY = 'family-monitor-device-registration';

export type DeviceRegistration = {
  deviceId: string;
  deviceAccessToken: string;
  displayName: string;
  permissions: Partial<Record<PermissionType, boolean>>;
  pairedAt: string;
  lastSyncCursor: number;
};

export async function saveDeviceRegistration(registration: DeviceRegistration) {
  await AsyncStorage.setItem(REGISTRATION_KEY, JSON.stringify(registration));
}

export async function readDeviceRegistration(): Promise<DeviceRegistration | null> {
  const raw = await AsyncStorage.getItem(REGISTRATION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function updateSyncCursor(timestamp = Date.now()) {
  const registration = await readDeviceRegistration();
  if (!registration) {
    return null;
  }

  const updated = { ...registration, lastSyncCursor: timestamp };
  await saveDeviceRegistration(updated);
  return updated;
}

export async function clearDeviceRegistration() {
  await AsyncStorage.removeItem(REGISTRATION_KEY);
}
