# Android Gradle Integration Plan

The repository now includes a generated React Native Android project under:

```text
apps/mobile/android
```

Native files are integrated under:

```text
apps/mobile/android/app/src/main/java/com/familymonitor/
```

Integrated files:

- `DeviceCollectorsModule.kt`
- `DeviceCollectorsPackage.kt`
- `FamilyNotificationListenerService.kt`
- `BackgroundSyncSchedulerModule.kt`
- `BackgroundSyncWorker.kt`

## Package Registration

The package is registered in `MainApplication.kt`:

```kotlin
add(DeviceCollectorsPackage())
```

## Manifest Entries

Key permissions/access are integrated in `android/app/src/main/AndroidManifest.xml`:

- Usage access settings for app usage
- Runtime location permission
- Runtime call-log permission
- Notification listener service declaration
- WorkManager wake lock permission

## Gradle Dependencies

AndroidX core and WorkManager are integrated in `android/app/build.gradle`:

```gradle
implementation "androidx.core:core-ktx:1.13.1"
implementation "androidx.work:work-runtime-ktx:2.9.1"
```

## Device Token Flow

The mobile app pairs through:

```text
POST /api/v1/devices/pair
```

The response includes:

```text
deviceAccessToken
```

The JavaScript app stores this token with the paired device registration. Sync endpoints require this token as:

```text
Authorization: Bearer <deviceAccessToken>
```

## WorkManager Upload Implementation Notes

The current `BackgroundSyncWorker.kt` validates input and is ready for upload logic. To finish it:

1. Mirror paired device id, device access token, API base URL, permission settings, and sync cursor into native storage.
2. In `BackgroundSyncWorker`, read that native registration state.
3. Collect permitted records using the same Android APIs as `DeviceCollectorsModule`.
4. POST batches to:
   - `/api/v1/sync/app-usage`
   - `/api/v1/sync/battery`
   - `/api/v1/sync/location`
   - `/api/v1/sync/call-logs`
   - `/api/v1/sync/notifications`
5. Include the device token bearer header.
6. Update sync cursor only after successful upload.
7. Keep failed payloads in native storage for retry.

Do not collect data when the related permission toggle is disabled or the Android permission/access has been revoked.
