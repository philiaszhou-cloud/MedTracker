package com.medtracker.app.data.dao

import androidx.lifecycle.LiveData
import androidx.room.*
import com.medtracker.app.data.entity.MedicationRecord

@Dao
interface MedicationRecordDao {

    @Query("SELECT * FROM medication_records ORDER BY date DESC")
    fun getAllRecords(): LiveData<List<MedicationRecord>>

    @Query("SELECT * FROM medication_records WHERE date = :date LIMIT 1")
    suspend fun getRecordByDate(date: String): MedicationRecord?

    @Query("SELECT * FROM medication_records WHERE date = :date LIMIT 1")
    fun getRecordByDateLive(date: String): LiveData<MedicationRecord?>

    @Query("SELECT * FROM medication_records ORDER BY date DESC LIMIT :limit")
    fun getRecentRecords(limit: Int): LiveData<List<MedicationRecord>>

    @Query("SELECT * FROM medication_records WHERE date BETWEEN :startDate AND :endDate ORDER BY date DESC")
    fun getRecordsBetweenDates(startDate: String, endDate: String): LiveData<List<MedicationRecord>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecord(record: MedicationRecord): Long

    @Update
    suspend fun updateRecord(record: MedicationRecord)

    @Delete
    suspend fun deleteRecord(record: MedicationRecord)

    @Query("SELECT COUNT(*) FROM medication_records WHERE isTaken = 1 AND date BETWEEN :startDate AND :endDate")
    suspend fun getCompletedCount(startDate: String, endDate: String): Int
}
