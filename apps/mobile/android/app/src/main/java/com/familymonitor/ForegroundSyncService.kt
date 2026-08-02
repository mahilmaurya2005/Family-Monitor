package com.familymonitor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.content.pm.ServiceInfo
import androidx.core.app.NotificationCompat
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

class ForegroundSyncService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var intervalMillis = 60_000L

  private val syncLoop = object : Runnable {
    override fun run() {
      enqueueSync()
      handler.postDelayed(this, intervalMillis)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    intervalMillis = intent
      ?.getLongExtra(EXTRA_INTERVAL_MINUTES, 1L)
      ?.coerceAtLeast(1L)
      ?.times(60_000L) ?: 60_000L

    createChannel()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_ID, notification())
    }
    handler.removeCallbacks(syncLoop)
    handler.post(syncLoop)
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(syncLoop)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun enqueueSync() {
    val constraints = Constraints.Builder()
      .setRequiredNetworkType(NetworkType.CONNECTED)
      .build()
    val request = OneTimeWorkRequestBuilder<BackgroundSyncWorker>()
      .setConstraints(constraints)
      .build()

    WorkManager.getInstance(this).enqueueUniqueWork(
      ONE_TIME_WORK_NAME,
      ExistingWorkPolicy.REPLACE,
      request
    )
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Family Monitor Sync",
      NotificationManager.IMPORTANCE_LOW
    )
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun notification(): Notification =
    NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Family Monitor sync active")
      .setContentText("Syncing approved device data in the background.")
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setOngoing(true)
      .build()

  companion object {
    private const val CHANNEL_ID = "family-monitor-sync"
    private const val NOTIFICATION_ID = 4102
    private const val ONE_TIME_WORK_NAME = "family-monitor-background-sync-once"
    private const val EXTRA_INTERVAL_MINUTES = "intervalMinutes"

    fun start(context: Context, intervalMinutes: Long) {
      val intent = Intent(context, ForegroundSyncService::class.java)
        .putExtra(EXTRA_INTERVAL_MINUTES, intervalMinutes)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, ForegroundSyncService::class.java))
    }
  }
}
