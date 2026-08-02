import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_SETTINGS_KEY = 'family-monitor-sync-settings';

export type SyncSettings = {
  enabled: boolean;
  intervalMinutes: number;
  updatedAt: string;
};

const defaultSettings: SyncSettings = {
  enabled: false,
  intervalMinutes: 1,
  updatedAt: new Date(0).toISOString(),
};

export async function readSyncSettings(): Promise<SyncSettings> {
  const raw = await AsyncStorage.getItem(SYNC_SETTINGS_KEY);
  return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
}

export async function saveSyncSettings(settings: Partial<SyncSettings>) {
  const current = await readSyncSettings();
  const updated = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}
