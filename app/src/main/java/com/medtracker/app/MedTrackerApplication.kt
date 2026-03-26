package com.medtracker.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.medtracker.app.data.database.AppDatabase

class MedTrackerApplication : Application() {

    val database: AppDatabase by lazy { AppDatabase.getDatabase(this) }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "鏈嶈嵂鎻愰啋",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "姣忔棩鏈嶈嵂鎻愰啋閫氱煡"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500)
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    companion object {
        const val CHANNEL_ID = "med_tracker_reminder"
        const val NOTIFICATION_ID = 1001
    }
}
