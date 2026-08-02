import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ApiClient } from '@family-monitor/api-client';
import type { PermissionType } from '@family-monitor/types';
import {
  readDeviceRegistration,
  saveDeviceRegistration,
} from './src/storage/deviceRegistration';
import { DeviceCollectors } from './src/native/DeviceCollectors';
import { useSyncScheduler } from './src/sync/useSyncScheduler';
import { API_BASE_URL } from './src/config';

const permissions = [
  {
    type: 'APP_USAGE',
    title: 'App usage',
    description: 'Track which apps are opened and total time spent.',
  },
  {
    type: 'LOCATION',
    title: 'Location timeline',
    description: 'Sync location points while permission remains enabled.',
  },
  {
    type: 'BATTERY',
    title: 'Battery status',
    description: 'Record battery level and charging state.',
  },
  {
    type: 'CALL_LOGS',
    title: 'Call log summary',
    description: 'Sync phone number, contact name, time, and duration.',
  },
  {
    type: 'NOTIFICATIONS',
    title: 'Notification access',
    description: 'Sync notification metadata only after manual Android approval.',
  },
];

export default function App() {
  const [pairingCode, setPairingCode] = useState('');
  const [deviceAccessToken, setDeviceAccessToken] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('My Android Device');
  const [grants, setGrants] = useState<Record<string, boolean>>({
    APP_USAGE: true,
    LOCATION: false,
    BATTERY: true,
    CALL_LOGS: false,
    NOTIFICATIONS: false,
  });
  const [status, setStatus] = useState('Not registered');
  const api = useMemo(
    () => new ApiClient(API_BASE_URL, () => deviceAccessToken),
    [deviceAccessToken],
  );
  const scheduler = useSyncScheduler(api);

  useEffect(() => {
    readDeviceRegistration().then((registration) => {
      if (registration) {
        setDeviceAccessToken(registration.deviceAccessToken);
        setDeviceName(registration.displayName);
        setStatus('Registered and ready to sync');
      }
    });
  }, []);

  async function registerDevice() {
    setStatus('Registering...');
    try {
      await requestSelectedAndroidAccess();
      const response = await api.pairDevice({
        pairingCode,
        displayName: deviceName,
        deviceIdentifier: `android-${deviceName.toLowerCase().replace(/\s+/g, '-')}`,
        appVersion: '0.1.0',
        permissions: Object.entries(grants).map(([type, granted]) => ({
          type,
          granted,
        })),
      });
      await saveDeviceRegistration({
        deviceId: response.id,
        deviceAccessToken: response.deviceAccessToken,
        displayName: response.displayName,
        permissions: grants as Partial<Record<PermissionType, boolean>>,
        pairedAt: new Date().toISOString(),
        lastSyncCursor: Date.now() - 1000 * 60 * 60,
      });
      setDeviceAccessToken(response.deviceAccessToken);
      await scheduler.setEnabled(true);
      setStatus('Registered and ready to sync');
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : 'Registration failed');
    }
  }

  async function syncNow() {
    await requestSelectedAndroidAccess();
    await scheduler.runSync();
  }

  async function requestSelectedAndroidAccess() {
    if (Platform.OS !== 'android') {
      return;
    }

    const runtimePermissions: Parameters<typeof PermissionsAndroid.requestMultiple>[0] = [];
    if (grants.LOCATION) {
      runtimePermissions.push(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      );
    }
    if (grants.CALL_LOGS) {
      runtimePermissions.push(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
    }
    if (Platform.Version >= 33) {
      runtimePermissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    if (runtimePermissions.length > 0) {
      await PermissionsAndroid.requestMultiple(runtimePermissions);
    }
    if (grants.APP_USAGE) {
      await DeviceCollectors.requestUsageAccess();
    }
    if (grants.NOTIFICATIONS) {
      await DeviceCollectors.requestNotificationAccess();
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Family Monitor</Text>
        <Text style={styles.subtitle}>
          This device will only sync data types approved on this screen and in Android settings.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Pairing code</Text>
          <TextInput
            autoCapitalize="characters"
            value={pairingCode}
            onChangeText={setPairingCode}
            placeholder="123-456"
            placeholderTextColor="#7b8a92"
            selectionColor="#12737a"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Device name</Text>
          <TextInput
            value={deviceName}
            onChangeText={setDeviceName}
            placeholderTextColor="#7b8a92"
            selectionColor="#12737a"
            style={styles.input}
          />
        </View>

        <Text style={styles.sectionTitle}>Permissions</Text>
        {permissions.map((permission) => (
          <View style={styles.permissionRow} key={permission.type}>
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>{permission.title}</Text>
              <Text style={styles.permissionDescription}>{permission.description}</Text>
            </View>
            <Switch
              value={grants[permission.type]}
              onValueChange={(value) =>
                setGrants((current) => ({ ...current, [permission.type]: value }))
              }
            />
          </View>
        ))}

        <TouchableOpacity style={styles.button} onPress={registerDevice}>
          <Text style={styles.buttonText}>Register device</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={syncNow}>
          <Text style={styles.secondaryButtonText}>Sync now</Text>
        </TouchableOpacity>

        <View style={styles.schedulerPanel}>
          <View style={styles.permissionRow}>
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>Scheduled sync</Text>
              <Text style={styles.permissionDescription}>
                Keeps a foreground sync service active for 1-minute background updates.
              </Text>
            </View>
            <Switch value={scheduler.state.enabled} onValueChange={scheduler.setEnabled} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Interval minutes</Text>
            <TextInput
              keyboardType="number-pad"
              value={`${scheduler.state.intervalMinutes}`}
              placeholderTextColor="#7b8a92"
              selectionColor="#12737a"
              onChangeText={(value) => {
                const parsed = Number.parseInt(value, 10);
                if (!Number.isNaN(parsed) && parsed >= 1) {
                  void scheduler.setIntervalMinutes(parsed);
                }
              }}
              style={styles.input}
            />
          </View>
          <Text style={styles.status}>{scheduler.state.lastResult}</Text>
        </View>

        <Text style={styles.status}>{status}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f7f5',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  title: {
    color: '#172026',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#52616b',
    fontSize: 15,
    lineHeight: 22,
  },
  field: {
    gap: 8,
  },
  label: {
    color: '#172026',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#cfd8dc',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    color: '#172026',
    fontSize: 16,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    color: '#172026',
    fontSize: 18,
    fontWeight: '700',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderWidth: 1,
    borderColor: '#dfe6e8',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 14,
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    color: '#172026',
    fontWeight: '700',
  },
  permissionDescription: {
    color: '#52616b',
    marginTop: 4,
    lineHeight: 20,
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#12737a',
    paddingVertical: 14,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#12737a',
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#12737a',
    fontWeight: '700',
  },
  status: {
    color: '#52616b',
    textAlign: 'center',
  },
  schedulerPanel: {
    gap: 12,
    borderWidth: 1,
    borderColor: '#dfe6e8',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 14,
  },
});
