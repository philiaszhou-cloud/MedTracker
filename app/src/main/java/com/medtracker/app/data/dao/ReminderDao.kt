package com.medtracker.app.data.dao

import androidx.lifecycle.LiveData
import androidx.room.*
import com.medtracker.app.data.entity.Reminder

@Dao
interface ReminderDao {

    @Query("SELECT * FROM reminders ORDER BY hour ASC, minute ASC")
    fun getAllReminders(): LiveData<List<Reminder>>

    @Query("SELECT * FROM reminders ORDER BY hour ASC, minute ASC")
    suspend fun getAllRemindersSync(): List<Reminder>

    @Query("SELECT * FROM reminders WHERE isEnabled = 1 ORDER BY hour ASC, minute ASC")
    suspend fun getEnabledReminders(): List<Reminder>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReminder(reminder: Reminder): Long

    @Update
    suspend fun updateReminder(reminder: Reminder)

    @Delete
    suspend fun deleteReminder(reminder: Reminder)

    @Query("UPDATE reminders SET isEnabled = :enabled WHERE id = :id")
    suspend fun setReminderEnabled(id: Long, enabled: Boolean)
}
