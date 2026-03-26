package com.medtracker.app.data.dao

import androidx.lifecycle.LiveData
import androidx.room.*
import com.medtracker.app.data.entity.Medication

@Dao
interface MedicationDao {

    @Query("SELECT * FROM medications ORDER BY `order` ASC, id ASC")
    fun getAllMedications(): LiveData<List<Medication>>

    @Query("SELECT * FROM medications ORDER BY `order` ASC, id ASC")
    suspend fun getAllMedicationsSync(): List<Medication>

    @Query("SELECT * FROM medications WHERE id = :id")
    suspend fun getMedicationById(id: Long): Medication?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMedication(medication: Medication): Long

    @Update
    suspend fun updateMedication(medication: Medication)

    @Delete
    suspend fun deleteMedication(medication: Medication)

    @Query("SELECT COUNT(*) FROM medications")
    suspend fun getMedicationCount(): Int
}
