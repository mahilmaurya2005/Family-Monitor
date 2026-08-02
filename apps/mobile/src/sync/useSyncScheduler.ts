import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { ApiClient } from '@family-monitor/api-client';
import { BackgroundSyncScheduler } from '../native/BackgroundSyncScheduler';
import { API_BASE_URL } from '../config';
import { readDeviceRegistration } from '../storage/deviceRegistration';
import { readSyncSettings, saveSyncSettings, type SyncSettings } from '../storage/syncSettings';
import { syncRegisteredDevice } from './syncDevice';

type SchedulerState = SyncSettings & {
  running: boolean;
  lastRunAt: string | null;
  lastResult: string;
};

export function useSyncScheduler(api: ApiClient) {
  const [state, setState] = useState<SchedulerState>({
    enabled: false,
    intervalMinutes: 1,
    updatedAt: new Date(0).toISOString(),
    running: false,
    lastRunAt: null,
    lastResult: 'Scheduler stopped',
  });
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const runSync = useCallback(async () => {
    setState((current) => ({ ...current, running: true, lastResult: 'Syncing...' }));
    try {
      const result = await syncRegisteredDevice(api);
      setState((current) => ({
        ...current,
        running: false,
        lastRunAt: new Date().toISOString(),
        lastResult: `Synced ${result.uploaded}, queued ${result.queued}`,
      }));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Sync failed';
      setState((current) => ({
        ...current,
        running: false,
        lastResult: message,
      }));
    }
  }, [api]);

  const apiBaseUrl = API_BASE_URL;

  const setEnabled = useCallback(async (enabled: boolean) => {
    const settings = await saveSyncSettings({ enabled, intervalMinutes: 1 });
    setState((current) => ({ ...current, ...settings }));
    const registration = await readDeviceRegistration();
    if (enabled && registration) {
      await BackgroundSyncScheduler.schedule(registration, 1, apiBaseUrl);
      await BackgroundSyncScheduler.runOnce();
    }
    if (!enabled) {
      await BackgroundSyncScheduler.cancel();
    }
  }, []);

  const setIntervalMinutes = useCallback(async (intervalMinutes: number) => {
    const settings = await saveSyncSettings({ intervalMinutes });
    setState((current) => ({ ...current, ...settings }));
    const registration = await readDeviceRegistration();
    if (settings.enabled && registration) {
      await BackgroundSyncScheduler.schedule(registration, intervalMinutes, apiBaseUrl);
    }
  }, []);

  useEffect(() => {
    readSyncSettings().then(async (settings) => {
      const registration = await readDeviceRegistration();
      const effectiveSettings = registration
        ? await saveSyncSettings({ enabled: true, intervalMinutes: 1 })
        : settings;
      setState((current) => ({ ...current, ...effectiveSettings }));
      if (registration && effectiveSettings.enabled) {
        await BackgroundSyncScheduler.schedule(
          registration,
          1,
          apiBaseUrl,
        );
        await BackgroundSyncScheduler.runOnce();
      }
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!state.enabled) {
      return;
    }

    const interval = setInterval(() => {
      if (appState.current === 'active') {
        void runSync();
      }
    }, state.intervalMinutes * 60 * 1000);

    return () => clearInterval(interval);
  }, [runSync, state.enabled, state.intervalMinutes]);

  return {
    state,
    runSync,
    setEnabled,
    setIntervalMinutes,
  };
}
