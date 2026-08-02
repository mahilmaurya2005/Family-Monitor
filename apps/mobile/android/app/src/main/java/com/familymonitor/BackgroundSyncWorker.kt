package com.familymonitor

import android.Manifest
import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.LocationManager
import android.media.AudioManager
import android.os.BatteryManager
import android.provider.CallLog
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject

class BackgroundSyncWorker(
  context: Context,
  workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {
  override suspend fun doWork(): Result {
    val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val deviceId = prefs.getString(KEY_DEVICE_ID, null)
    val token = prefs.getString(KEY_TOKEN, null)
    val apiBaseUrl = prefs.getString(KEY_API_BASE_URL, null)
    val permissions = JSONObject(prefs.getString(KEY_PERMISSIONS, "{}") ?: "{}")
    val since = prefs.getLong(KEY_LAST_SYNC_CURSOR, System.currentTimeMillis() - 60 * 60 * 1000)

    if (deviceId.isNullOrBlank() || token.isNullOrBlank() || apiBaseUrl.isNullOrBlank()) {
      return Result.failure(workDataOf("reason" to "Missing background sync registration"))
    }

    var uploaded = 0
    try {
      if (permissions.optBoolean("BATTERY", false)) {
        uploaded += post(apiBaseUrl, token, "/sync/battery", deviceId, JSONArray().put(batterySnapshot()))
      }
      if (permissions.optBoolean("LOCATION", false)) {
        currentLocation()?.let {
          uploaded += post(apiBaseUrl, token, "/sync/location", deviceId, JSONArray().put(it))
        }
      }
      if (permissions.optBoolean("APP_USAGE", false)) {
        uploaded += post(apiBaseUrl, token, "/sync/app-usage", deviceId, appUsageSince(since))
      }
      if (permissions.optBoolean("CALL_LOGS", false)) {
        uploaded += post(apiBaseUrl, token, "/sync/call-logs", deviceId, callLogsSince(since))
      }
      if (permissions.optBoolean("NOTIFICATIONS", false)) {
        uploaded += post(apiBaseUrl, token, "/sync/notifications", deviceId, FamilyNotificationStore.readJsonSince(applicationContext, since))
      }

      prefs.edit()
        .putLong(KEY_LAST_SYNC_CURSOR, System.currentTimeMillis())
        .putLong(KEY_LAST_BACKGROUND_SYNC_AT, System.currentTimeMillis())
        .apply()

      return Result.success(workDataOf("uploaded" to uploaded))
    } catch (error: Exception) {
      return Result.retry()
    }
  }

  private fun post(
    apiBaseUrl: String,
    token: String,
    path: String,
    deviceId: String,
    records: JSONArray
  ): Int {
    if (records.length() == 0) {
      return 0
    }

    val body = JSONObject()
      .put("deviceId", deviceId)
      .put("records", records)
      .toString()
    val connection = URL("$apiBaseUrl$path").openConnection() as HttpURLConnection
    connection.requestMethod = "POST"
    connection.setRequestProperty("Authorization", "Bearer $token")
    connection.setRequestProperty("Content-Type", "application/json")
    connection.doOutput = true
    connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

    val status = connection.responseCode
    connection.disconnect()
    if (status !in 200..299) {
      throw IllegalStateException("Sync failed with HTTP $status")
    }
    return records.length()
  }

  private fun batterySnapshot(): JSONObject {
    val batteryIntent = applicationContext.registerReceiver(
      null,
      IntentFilter(Intent.ACTION_BATTERY_CHANGED)
    )
    val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
    val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
    val percent = if (level >= 0 && scale > 0) ((level * 100f) / scale).toInt() else 0

    return JSONObject()
      .put("level", percent.coerceIn(0, 100))
      .put("charging", status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL)
      .put("ringerMode", ringerMode())
      .put("recordedAt", Instant.now().toString())
  }

  private fun currentLocation(): JSONObject? {
    if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION) &&
      !hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
    ) {
      return null
    }

    return try {
      val locationManager =
        applicationContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
      val location = locationManager.getProviders(true)
        .asSequence()
        .mapNotNull { provider -> locationManager.getLastKnownLocation(provider) }
        .maxByOrNull { it.time }

      location?.let {
        JSONObject()
          .put("latitude", it.latitude)
          .put("longitude", it.longitude)
          .put("accuracyM", it.accuracy.toDouble())
          .put("recordedAt", Instant.ofEpochMilli(it.time).toString())
      }
    } catch (_: SecurityException) {
      null
    }
  }

  private fun appUsageSince(timestamp: Long): JSONArray {
    if (!hasUsageAccess()) {
      return JSONArray()
    }

    val usageStatsManager =
      applicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = usageStatsManager.queryEvents(timestamp, System.currentTimeMillis())
    val appStarts = mutableMapOf<String, Long>()
    val usageRecords = JSONArray()
    val event = UsageEvents.Event()

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      when (event.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> appStarts[event.packageName] = event.timeStamp
        UsageEvents.Event.ACTIVITY_PAUSED -> {
          val openedAt = appStarts.remove(event.packageName) ?: continue
          val durationMillis = (event.timeStamp - openedAt).coerceAtLeast(0)
          if (durationMillis > 0) {
            usageRecords.put(
              JSONObject()
                .put("packageName", event.packageName)
                .put("appName", appName(event.packageName))
                .put("openedAt", Instant.ofEpochMilli(openedAt).toString())
                .put("closedAt", Instant.ofEpochMilli(event.timeStamp).toString())
                .put("durationMillis", durationMillis.coerceAtMost(Int.MAX_VALUE.toLong()).toInt())
            )
          }
        }
      }
    }

    return usageRecords
  }

  private fun callLogsSince(timestamp: Long): JSONArray {
    if (!hasPermission(Manifest.permission.READ_CALL_LOG)) {
      return JSONArray()
    }

    val records = JSONArray()
    val projection = arrayOf(
      CallLog.Calls.NUMBER,
      CallLog.Calls.CACHED_NAME,
      CallLog.Calls.TYPE,
      CallLog.Calls.DATE,
      CallLog.Calls.DURATION
    )

    applicationContext.contentResolver.query(
      CallLog.Calls.CONTENT_URI,
      projection,
      "${CallLog.Calls.DATE} >= ?",
      arrayOf(timestamp.toString()),
      "${CallLog.Calls.DATE} DESC"
    )?.use { cursor ->
      val numberIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
      val nameIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME)
      val typeIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)
      val dateIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)
      val durationIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)

      while (cursor.moveToNext()) {
        val startedAt = cursor.getLong(dateIndex)
        records.put(
          JSONObject()
            .put("phoneNumber", cursor.getString(numberIndex) ?: "")
            .put("contactName", cursor.getString(nameIndex))
            .put("direction", callDirection(cursor.getInt(typeIndex)))
            .put("startedAt", Instant.ofEpochMilli(startedAt).toString())
            .put("durationMillis", cursor.getInt(durationIndex) * 1000)
        )
      }
    }

    return records
  }

  private fun hasPermission(permission: String): Boolean =
    ContextCompat.checkSelfPermission(applicationContext, permission) == PackageManager.PERMISSION_GRANTED

  private fun hasUsageAccess(): Boolean {
    val appOps = applicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      android.os.Process.myUid(),
      applicationContext.packageName
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun appName(packageName: String): String = try {
    val info = applicationContext.packageManager.getApplicationInfo(packageName, 0)
    applicationContext.packageManager.getApplicationLabel(info).toString()
  } catch (_: Exception) {
    packageName
  }

  private fun callDirection(type: Int): String = when (type) {
    CallLog.Calls.INCOMING_TYPE -> "INCOMING"
    CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
    CallLog.Calls.MISSED_TYPE -> "MISSED"
    CallLog.Calls.REJECTED_TYPE -> "REJECTED"
    else -> "UNKNOWN"
  }

  private fun ringerMode(): String {
    val audioManager = applicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    return when (audioManager.ringerMode) {
      AudioManager.RINGER_MODE_SILENT -> "silent"
      AudioManager.RINGER_MODE_VIBRATE -> "vibrate"
      AudioManager.RINGER_MODE_NORMAL -> "normal"
      else -> "unknown"
    }
  }

  companion object {
    const val PREFS_NAME = "family-monitor-background-sync"
    const val KEY_DEVICE_ID = "deviceId"
    const val KEY_TOKEN = "deviceAccessToken"
    const val KEY_API_BASE_URL = "apiBaseUrl"
    const val KEY_PERMISSIONS = "permissions"
    const val KEY_LAST_SYNC_CURSOR = "lastSyncCursor"
    const val KEY_LAST_BACKGROUND_SYNC_AT = "lastBackgroundSyncAt"
  }
}
