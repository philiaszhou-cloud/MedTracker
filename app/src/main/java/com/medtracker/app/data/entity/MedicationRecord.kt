package com.medtracker.app.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * 每日服药记录实体
 */
@Entity(tableName = "medication_records")
data class MedicationRecord(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val date: String,               // 日期，格式：yyyy-MM-dd
    val takenTime: String = "",     // 实际服药时间
    val photoPath: String = "",     // 当日所有药片合照路径
    val isTaken: Boolean = false,   // 是否已服药
    val notes: String = "",         // 备注
    val medicationIds: String = ""  // 已识别/确认的药物ID列表（逗号分隔）
)
