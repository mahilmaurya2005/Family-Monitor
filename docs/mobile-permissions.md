# Mobile Permissions

The mobile app must show an in-app disclosure before opening Android permission screens. Data collection starts only after the device user approves the feature in the app and grants the Android permission/access.

## Data Sources

| Feature | Android access | Implementation file | Notes |
|---|---|---|---|
| App usage | `PACKAGE_USAGE_STATS` via Usage Access settings | `DeviceCollectorsModule.kt` | User must manually enable usage access. |
| Battery | `BatteryManager` | `DeviceCollectorsModule.kt` | No dangerous runtime permission. |
| Location | `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | `DeviceCollectorsModule.kt` | Current implementation reads last known location. |
| Call logs | `READ_CALL_LOG` | `DeviceCollectorsModule.kt` | Only collect summary fields: number, contact name, direction, time, duration. |
| Notifications | Notification listener access | `FamilyNotificationListenerService.kt` | User must manually enable Notification Access. |

## Required UX

- Explain every data type before asking for access.
- Keep toggles visible in the app for each data source.
- Allow the device user to disable sync.
- Do not hide the app, service, notification access, or permission state.
- Do not collect message history from inside encrypted chat apps.

## Android Project Integration

The React Native Android project has been generated. Native files live in:

```text
apps/mobile/android/app/src/main/java/com/familymonitor/
```

`DeviceCollectorsPackage` is registered in the React Native application package list.

The Kotlin module uses `androidx.core.content.ContextCompat`; AndroidX core is included in Android Gradle dependencies.
