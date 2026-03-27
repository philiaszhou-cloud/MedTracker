package com.medtracker.app.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * 提醒时间配置实体
 */
@Entity(tableName = "reminders")
data class Reminder(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val hour: Int,          // 提醒小时（24小时制）
    val minute: Int,        // 提醒分钟
    val label: String,      // 提醒标签（如：早餐后、午餐后、睡前）
    val isEnabled: Boolean = true,  // 是否启用
    val days: String = "1111111"    // 7位字符串，每位代表周一到周日是否启用
)
