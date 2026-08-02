package com.familymonitor

import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.TimeUnit

class BackgroundSyncSchedulerModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "BackgroundSyncScheduler"

  @ReactMethod
  fun schedule(
    deviceId: String,
    deviceAccessToken: String,
    apiBaseUrl: String,
    permissionsJson: String,
    lastSyncCursor: Double,
    intervalMinutes: Double,
    promise: Promise
  ) {
    reactContext.getSharedPreferences(BackgroundSyncWorker.PREFS_NAME, android.content.Context.MODE_PRIVATE)
      .edit()
      .putString(BackgroundSyncWorker.KEY_DEVICE_ID, deviceId)
      .putString(BackgroundSyncWorker.KEY_TOKEN, deviceAccessToken)
      .putString(BackgroundSyncWorker.KEY_API_BASE_URL, apiBaseUrl)
      .putString(BackgroundSyncWorker.KEY_PERMISSIONS, permissionsJson)
      .putLong(BackgroundSyncWorker.KEY_LAST_SYNC_CURSOR, lastSyncCursor.toLong())
      .apply()

    val safeInterval = intervalMinutes.toLong().coerceAtLeast(15)
    val constraints = Constraints.Builder()
      .setRequiredNetworkType(NetworkType.CONNECTED)
      .build()
    val request = PeriodicWorkRequestBuilder<BackgroundSyncWorker>(
      safeInterval,
      TimeUnit.MINUTES
    )
      .setConstraints(constraints)
      .setInputData(workDataOf("deviceId" to deviceId))
      .build()

    WorkManager.getInstance(reactContext).enqueueUniquePeriodicWork(
      WORK_NAME,
      ExistingPeriodicWorkPolicy.UPDATE,
      request
    )
    ForegroundSyncService.start(reactContext, intervalMinutes.toLong().coerceAtLeast(1))

    promise.resolve(true)
  }

  @ReactMethod
  fun runOnce(promise: Promise) {
    val constraints = Constraints.Builder()
      .setRequiredNetworkType(NetworkType.CONNECTED)
      .build()
    val request = OneTimeWorkRequestBuilder<BackgroundSyncWorker>()
      .setConstraints(constraints)
      .build()

    WorkManager.getInstance(reactContext).enqueueUniqueWork(
      ONE_TIME_WORK_NAME,
      ExistingWorkPolicy.REPLACE,
      request
    )

    promise.resolve(true)
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    WorkManager.getInstance(reactContext).cancelUniqueWork(WORK_NAME)
    WorkManager.getInstance(reactContext).cancelUniqueWork(ONE_TIME_WORK_NAME)
    ForegroundSyncService.stop(reactContext)
    promise.resolve(true)
  }

  companion object {
    private const val WORK_NAME = "family-monitor-background-sync"
    private const val ONE_TIME_WORK_NAME = "family-monitor-background-sync-once"
  }
}
