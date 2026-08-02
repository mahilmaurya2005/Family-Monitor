import { ApiClient } from '@family-monitor/api-client';
import type { PermissionType } from '@family-monitor/types';
import { DeviceCollectors } from '../native/DeviceCollectors';
import {
  readDeviceRegistration,
  updateSyncCursor,
  type DeviceRegistration,
} from '../storage/deviceRegistration';
import { enqueue, flushQueue } from './syncQueue';

type SyncResult = {
  uploaded: number;
  queued: number;
  skipped: string[];
};

export async function syncRegisteredDevice(api: ApiClient): Promise<SyncResult> {
  const registration = await readDeviceRegistration();
  if (!registration) {
    throw new Error('Device is not paired yet');
  }

  const queueState = await flushQueue(api);
  const result: SyncResult = {
    uploaded: queueState.attempted - queueState.remaining,
    queued: queueState.remaining,
    skipped: [],
  };

  await collectAndSync(api, registration, result);
  await updateSyncCursor();

  return result;
}

async function collectAndSync(
  api: ApiClient,
  registration: DeviceRegistration,
  result: SyncResult,
) {
  const since = registration.lastSyncCursor;

  if (isGranted(registration, 'APP_USAGE')) {
    const records = await DeviceCollectors.getAppUsageSince(since);
    await sendOrQueue(api, '/sync/app-usage', registration.deviceId, records, result);
  } else {
    result.skipped.push('APP_USAGE');
  }

  if (isGranted(registration, 'BATTERY')) {
    const record = await DeviceCollectors.getBatterySnapshot();
    await sendOrQueue(api, '/sync/battery', registration.deviceId, [record], result);
  } else {
    result.skipped.push('BATTERY');
  }

  if (isGranted(registration, 'LOCATION')) {
    const record = await DeviceCollectors.getCurrentLocation();
    await sendOrQueue(api, '/sync/location', registration.deviceId, [record], result);
  } else {
    result.skipped.push('LOCATION');
  }

  if (isGranted(registration, 'CALL_LOGS')) {
    const records = await DeviceCollectors.getCallLogsSince(since);
    await sendOrQueue(api, '/sync/call-logs', registration.deviceId, records, result);
  } else {
    result.skipped.push('CALL_LOGS');
  }

  if (isGranted(registration, 'NOTIFICATIONS')) {
    const records = await DeviceCollectors.getNotificationsSince(since);
    await sendOrQueue(api, '/sync/notifications', registration.deviceId, records, result);
  } else {
    result.skipped.push('NOTIFICATIONS');
  }
}

async function sendOrQueue(
  api: ApiClient,
  path: string,
  deviceId: string,
  records: unknown[],
  result: SyncResult,
) {
  if (records.length === 0) {
    return;
  }

  const payload = { deviceId, records };
  try {
    await api.replay(path, payload);
    result.uploaded += records.length;
  } catch {
    await enqueue({ path, payload });
    result.queued += records.length;
  }
}

function isGranted(registration: DeviceRegistration, permission: PermissionType) {
  return registration.permissions[permission] === true;
}
