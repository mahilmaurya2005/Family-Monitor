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
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject

class DeviceCollectorsModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "DeviceCollectors"

  @ReactMethod
  fun requestUsageAccess(promise: Promise) {
    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactContext.startActivity(intent)
    promise.resolve(hasUsageAccess())
  }

  @ReactMethod
  fun requestNotificationAccess(promise: Promise) {
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactContext.startActivity(intent)
    promise.resolve(true)
  }

  @ReactMethod
  fun getAppUsageSince(timestamp: Double, promise: Promise) {
    if (!hasUsageAccess()) {
      promise.resolve(Arguments.createArray())
      return
    }

    try {
      val usageStatsManager =
        reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val events = usageStatsManager.queryEvents(timestamp.toLong(), System.currentTimeMillis())
      val appStarts = mutableMapOf<String, Long>()
      val usageRecords = Arguments.createArray()
      val event = UsageEvents.Event()

      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        when (event.eventType) {
          UsageEvents.Event.ACTIVITY_RESUMED -> {
            appStarts[event.packageName] = event.timeStamp
          }
          UsageEvents.Event.ACTIVITY_PAUSED -> {
            val openedAt = appStarts.remove(event.packageName) ?: continue
            val durationMillis = (event.timeStamp - openedAt).coerceAtLeast(0)
            if (durationMillis > 0) {
              usageRecords.pushMap(
                appUsageMap(event.packageName, openedAt, event.timeStamp, durationMillis)
              )
            }
          }
        }
      }

      promise.resolve(usageRecords)
    } catch (error: Exception) {
      promise.reject("APP_USAGE_FAILED", error)
    }
  }

  @ReactMethod
  fun getBatterySnapshot(promise: Promise) {
    try {
      val batteryIntent = reactContext.registerReceiver(
        null,
        IntentFilter(Intent.ACTION_BATTERY_CHANGED)
      )
      val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
      val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
      val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
      val percent = if (level >= 0 && scale > 0) {
        ((level * 100f) / scale).toInt()
      } else {
        val batteryManager = reactContext.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
      }
      val map = Arguments.createMap()
      map.putInt("level", percent.coerceIn(0, 100))
      map.putBoolean(
        "charging",
        status == BatteryManager.BATTERY_STATUS_CHARGING ||
          status == BatteryManager.BATTERY_STATUS_FULL
      )
      map.putString("ringerMode", ringerMode())
      map.putString("recordedAt", Instant.now().toString())
      promise.resolve(map)
    } catch (error: Exception) {
      promise.reject("BATTERY_FAILED", error)
    }
  }

  @ReactMethod
  fun getCurrentLocation(promise: Promise) {
    if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION) &&
      !hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
    ) {
      promise.resolve(null)
      return
    }

    try {
      val locationManager =
        reactContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
      val providers = locationManager.getProviders(true)
      val location = providers
        .asSequence()
        .mapNotNull { provider -> locationManager.getLastKnownLocation(provider) }
        .maxByOrNull { it.time }

      if (location == null) {
        promise.resolve(null)
        return
      }

      val map = Arguments.createMap()
      map.putDouble("latitude", location.latitude)
      map.putDouble("longitude", location.longitude)
      map.putDouble("accuracyM", location.accuracy.toDouble())
      map.putString("recordedAt", Instant.ofEpochMilli(location.time).toString())
      promise.resolve(map)
    } catch (error: SecurityException) {
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("LOCATION_FAILED", error)
    }
  }

  @ReactMethod
  fun getCallLogsSince(timestamp: Double, promise: Promise) {
    if (!hasPermission(Manifest.permission.READ_CALL_LOG)) {
      promise.resolve(Arguments.createArray())
      return
    }

    val records = Arguments.createArray()
    val projection = arrayOf(
      CallLog.Calls.NUMBER,
      CallLog.Calls.CACHED_NAME,
      CallLog.Calls.TYPE,
      CallLog.Calls.DATE,
      CallLog.Calls.DURATION
    )
    val selection = "${CallLog.Calls.DATE} >= ?"
    val args = arrayOf(timestamp.toLong().toString())
    val sort = "${CallLog.Calls.DATE} DESC"

    try {
      reactContext.contentResolver.query(
        CallLog.Calls.CONTENT_URI,
        projection,
        selection,
        args,
        sort
      )?.use { cursor ->
        val numberIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
        val nameIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME)
        val typeIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)
        val dateIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)
        val durationIndex = cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)

        while (cursor.moveToNext()) {
          val startedAt = cursor.getLong(dateIndex)
          val map = Arguments.createMap()
          map.putString("phoneNumber", cursor.getString(numberIndex) ?: "")
          map.putString("contactName", cursor.getString(nameIndex))
          map.putString("direction", callDirection(cursor.getInt(typeIndex)))
          map.putString("startedAt", Instant.ofEpochMilli(startedAt).toString())
          map.putInt("durationMillis", cursor.getInt(durationIndex) * 1000)
          records.pushMap(map)
        }
      }
      promise.resolve(records)
    } catch (error: SecurityException) {
      promise.resolve(Arguments.createArray())
    } catch (error: Exception) {
      promise.reject("CALL_LOGS_FAILED", error)
    }
  }

  @ReactMethod
  fun getNotificationsSince(timestamp: Double, promise: Promise) {
    promise.resolve(FamilyNotificationStore.readSince(timestamp.toLong()))
  }

  private fun appUsageMap(
    packageName: String,
    openedAt: Long,
    closedAt: Long,
    durationMillis: Long
  ): WritableMap {
    val map = Arguments.createMap()
    map.putString("packageName", packageName)
    map.putString("appName", appName(packageName))
    map.putString("openedAt", Instant.ofEpochMilli(openedAt).toString())
    map.putString("closedAt", Instant.ofEpochMilli(closedAt).toString())
    map.putInt("durationMillis", durationMillis.coerceAtMost(Int.MAX_VALUE.toLong()).toInt())
    return map
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      android.os.Process.myUid(),
      reactContext.packageName
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun hasPermission(permission: String): Boolean {
    return ContextCompat.checkSelfPermission(
      reactContext,
      permission
    ) == PackageManager.PERMISSION_GRANTED
  }

  private fun appName(packageName: String): String {
    return try {
      val packageManager = reactContext.packageManager
      val info = packageManager.getApplicationInfo(packageName, 0)
      packageManager.getApplicationLabel(info).toString()
    } catch (_: Exception) {
      packageName
    }
  }

  private fun callDirection(type: Int): String {
    return when (type) {
      CallLog.Calls.INCOMING_TYPE -> "INCOMING"
      CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
      CallLog.Calls.MISSED_TYPE -> "MISSED"
      CallLog.Calls.REJECTED_TYPE -> "REJECTED"
      else -> "UNKNOWN"
    }
  }

  private fun ringerMode(): String {
    val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    return when (audioManager.ringerMode) {
      AudioManager.RINGER_MODE_SILENT -> "silent"
      AudioManager.RINGER_MODE_VIBRATE -> "vibrate"
      AudioManager.RINGER_MODE_NORMAL -> "normal"
      else -> "unknown"
    }
  }
}

object FamilyNotificationStore {
  private const val MAX_RECORDS = 500
  private const val PREFS_NAME = "family-monitor-notifications"
  private const val RECORDS_KEY = "records"
  private val records = ArrayDeque<Pair<Long, WritableMap>>()

  @Synchronized
  fun add(recordedAt: Long, record: WritableMap) {
    records.addLast(recordedAt to record)
    while (records.size > MAX_RECORDS) {
      records.removeFirst()
    }
  }

  @Synchronized
  fun readSince(timestamp: Long): WritableArray {
    val array = Arguments.createArray()
    records
      .asSequence()
      .filter { it.first >= timestamp }
      .forEach { array.pushMap(it.second) }
    return array
  }

  @Synchronized
  fun addJson(context: Context, recordedAt: Long, record: JSONObject) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val existing = JSONArray(prefs.getString(RECORDS_KEY, "[]") ?: "[]")
    val next = JSONArray()
    val start = (existing.length() - MAX_RECORDS + 1).coerceAtLeast(0)

    for (index in start until existing.length()) {
      next.put(existing.getJSONObject(index))
    }
    next.put(JSONObject().put("recordedAtMillis", recordedAt).put("record", record))
    prefs.edit().putString(RECORDS_KEY, next.toString()).apply()
  }

  @Synchronized
  fun readJsonSince(context: Context, timestamp: Long): JSONArray {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val existing = JSONArray(prefs.getString(RECORDS_KEY, "[]") ?: "[]")
    val result = JSONArray()

    for (index in 0 until existing.length()) {
      val item = existing.getJSONObject(index)
      if (item.optLong("recordedAtMillis") >= timestamp) {
        result.put(item.getJSONObject("record"))
      }
    }

    return result
  }
}
