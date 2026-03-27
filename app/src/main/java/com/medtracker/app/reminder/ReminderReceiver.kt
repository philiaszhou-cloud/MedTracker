package com.medtracker.app.reminder

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.medtracker.app.MedTrackerApplication
import com.medtracker.app.R
import com.medtracker.app.ui.main.MainActivity
import java.util.Calendar

class ReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED -> {
                // 开机后重新注册所有提醒
                ReminderScheduler.rescheduleAll(context)
            }
            "com.medtracker.app.MEDICATION_REMINDER" -> {
                showNotification(context, intent)
            }
        }
    }

    private fun showNotification(context: Context, intent: Intent) {
        val label = intent.getStringExtra("label") ?: "服药提醒"

        val mainIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("open_camera", true)
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, mainIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, MedTrackerApplication.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_pill)
            .setContentTitle("💊 $label")
            .setContentText("请记得服用您的5种药物，并拍照记录。")
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText("请记得服用您的5种药物，并拍照记录。点击打开APP进行拍照确认。"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setVibrate(longArrayOf(0, 500, 200, 500))
            .build()

        try {
            with(NotificationManagerCompat.from(context)) {
                notify(MedTrackerApplication.NOTIFICATION_ID, notification)
            }
        } catch (e: SecurityException) {
            e.printStackTrace()
        }
    }
}

object ReminderScheduler {

    fun scheduleReminder(context: Context, reminderId: Long, hour: Int, minute: Int, label: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = "com.medtracker.app.MEDICATION_REMINDER"
            putExtra("reminder_id", reminderId)
            putExtra("label", label)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            reminderId.toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            // 如果时间已过，设置为明天
            if (timeInMillis <= System.currentTimeMillis()) {
                add(Calendar.DAY_OF_YEAR, 1)
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setRepeating(
                        AlarmManager.RTC_WAKEUP,
                        calendar.timeInMillis,
                        AlarmManager.INTERVAL_DAY,
                        pendingIntent
                    )
                } else {
                    alarmManager.setInexactRepeating(
                        AlarmManager.RTC_WAKEUP,
                        calendar.timeInMillis,
                        AlarmManager.INTERVAL_DAY,
                        pendingIntent
                    )
                }
            } else {
                alarmManager.setRepeating(
                    AlarmManager.RTC_WAKEUP,
                    calendar.timeInMillis,
                    AlarmManager.INTERVAL_DAY,
                    pendingIntent
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun cancelReminder(context: Context, reminderId: Long) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = "com.medtracker.app.MEDICATION_REMINDER"
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            reminderId.toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
    }

    fun rescheduleAll(context: Context) {
        val db = (context.applicationContext as MedTrackerApplication).database
        kotlinx.coroutines.GlobalScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            val reminders = db.reminderDao().getEnabledReminders()
            reminders.forEach { reminder ->
                scheduleReminder(context, reminder.id, reminder.hour, reminder.minute, reminder.label)
            }
        }
    }
}
