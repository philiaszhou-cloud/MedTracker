package com.medtracker.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.viewModelScope
import com.medtracker.app.MedTrackerApplication
import com.medtracker.app.data.entity.Medication
import com.medtracker.app.data.entity.MedicationRecord
import com.medtracker.app.data.entity.Reminder
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val db = (application as MedTrackerApplication).database
    private val medicationDao = db.medicationDao()
    private val recordDao = db.medicationRecordDao()
    private val reminderDao = db.reminderDao()

    // 所有药物列表
    val medications: LiveData<List<Medication>> = medicationDao.getAllMedications()

    // 所有提醒
    val reminders: LiveData<List<Reminder>> = reminderDao.getAllReminders()

    // 今日记录
    fun getTodayRecord(): LiveData<MedicationRecord?> {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        return recordDao.getRecordByDateLive(today)
    }

    // 最近30条记录
    val recentRecords: LiveData<List<MedicationRecord>> = recordDao.getRecentRecords(30)

    // ---- 药物操作 ----
    fun insertMedication(medication: Medication) = viewModelScope.launch {
        medicationDao.insertMedication(medication)
    }

    fun updateMedication(medication: Medication) = viewModelScope.launch {
        medicationDao.updateMedication(medication)
    }

    fun deleteMedication(medication: Medication) = viewModelScope.launch {
        medicationDao.deleteMedication(medication)
    }

    // ---- 记录操作 ----
    fun saveRecord(record: MedicationRecord) = viewModelScope.launch {
        recordDao.insertRecord(record)
    }

    suspend fun getRecordByDate(date: String): MedicationRecord? {
        return recordDao.getRecordByDate(date)
    }

    // ---- 提醒操作 ----
    fun insertReminder(reminder: Reminder) = viewModelScope.launch {
        reminderDao.insertReminder(reminder)
    }

    fun updateReminder(reminder: Reminder) = viewModelScope.launch {
        reminderDao.updateReminder(reminder)
    }

    fun deleteReminder(reminder: Reminder) = viewModelScope.launch {
        reminderDao.deleteReminder(reminder)
    }

    fun setReminderEnabled(id: Long, enabled: Boolean) = viewModelScope.launch {
        reminderDao.setReminderEnabled(id, enabled)
    }

    suspend fun getAllMedicationsSync(): List<Medication> {
        return medicationDao.getAllMedicationsSync()
    }

    suspend fun getEnabledReminders(): List<Reminder> {
        return reminderDao.getEnabledReminders()
    }
}
