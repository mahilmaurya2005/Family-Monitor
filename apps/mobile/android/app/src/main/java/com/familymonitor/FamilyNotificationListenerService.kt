package com.familymonitor

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.facebook.react.bridge.Arguments
import java.time.Instant
import org.json.JSONObject

class FamilyNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val extras = sbn.notification.extras
    val title = extras.getCharSequence("android.title")?.toString()
    val body = extras.getCharSequence("android.text")?.toString()
    val map = Arguments.createMap()

    map.putString("packageName", sbn.packageName)
    map.putString("appName", appName(sbn.packageName))
    map.putString("title", title)
    map.putString("body", body)
    map.putString("postedAt", Instant.ofEpochMilli(sbn.postTime).toString())

    FamilyNotificationStore.add(sbn.postTime, map)
    FamilyNotificationStore.addJson(
      applicationContext,
      sbn.postTime,
      JSONObject()
        .put("packageName", sbn.packageName)
        .put("appName", appName(sbn.packageName))
        .put("title", title)
        .put("body", body)
        .put("postedAt", Instant.ofEpochMilli(sbn.postTime).toString())
    )
  }

  private fun appName(packageName: String): String {
    return try {
      val info = packageManager.getApplicationInfo(packageName, 0)
      packageManager.getApplicationLabel(info).toString()
    } catch (_: Exception) {
      packageName
    }
  }
}
