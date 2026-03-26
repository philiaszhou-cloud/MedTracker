package com.medtracker.app.data.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.medtracker.app.data.dao.MedicationDao
import com.medtracker.app.data.dao.MedicationRecordDao
import com.medtracker.app.data.dao.ReminderDao
import com.medtracker.app.data.entity.Medication
import com.medtracker.app.data.entity.MedicationRecord
import com.medtracker.app.data.entity.Reminder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [Medication::class, MedicationRecord::class, Reminder::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun medicationDao(): MedicationDao
    abstract fun medicationRecordDao(): MedicationRecordDao
    abstract fun reminderDao(): ReminderDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "med_tracker_database"
                )
                .addCallback(DatabaseCallback())
                .build()
                INSTANCE = instance
                instance
            }
        }

        private class DatabaseCallback : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                // 鎻掑叆榛樿鎻愰啋鏃堕棿锛堟棭8鐐癸級
                INSTANCE?.let { database ->
                    CoroutineScope(Dispatchers.IO).launch {
                        database.reminderDao().insertReminder(
                            Reminder(hour = 8, minute = 0, label = "鏃╂櫒鏈嶈嵂鎻愰啋")
                        )
                    }
                }
            }
        }
    }
}
