# Mobile Background Sync

The mobile app now has two scheduler layers:

1. React Native foreground scheduler
   - File: `apps/mobile/src/sync/useSyncScheduler.ts`
   - Runs periodic sync while the app is active.
   - Uses saved settings from `syncSettings.ts`.
   - Calls `syncRegisteredDevice`, which flushes the queue and uploads permitted records.

2. Android WorkManager integration
   - Files:
     - `BackgroundSyncWorker.kt`
     - `BackgroundSyncSchedulerModule.kt`
   - Schedules periodic work with network connectivity required.
   - Android enforces a minimum periodic interval of 15 minutes.

## Android Gradle Dependency

When the full Android project is generated, add WorkManager:

```gradle
implementation "androidx.work:work-runtime-ktx:2.9.1"
```

The native worker currently validates input and returns success. The next step is to hydrate stored registration/settings in native code or invoke a shared sync bridge.

The backend now authenticates sync endpoints with the paired device access token returned by `/api/v1/devices/pair`. Native WorkManager upload must include:

```text
Authorization: Bearer <deviceAccessToken>
```

## Current Sync Behavior

- Manual `Sync now` uses the JavaScript sync path.
- Scheduled foreground sync also uses JavaScript.
- Native WorkManager scheduling is wired through `BackgroundSyncScheduler`, but the worker still needs final upload implementation after native storage strategy is chosen.
