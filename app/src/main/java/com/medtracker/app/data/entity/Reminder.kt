package com.medtracker.app.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * 鎻愰啋鏃堕棿閰嶇疆瀹炰綋
 */
@Entity(tableName = "reminders")
data class Reminder(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val hour: Int,          // 鎻愰啋灏忔椂锛?4灏忔椂鍒讹級
    val minute: Int,        // 鎻愰啋鍒嗛挓
    val label: String,      // 鎻愰啋鏍囩锛堝锛氭棭椁愬悗銆佸崍椁愬悗銆佺潯鍓嶏級
    val isEnabled: Boolean = true,  // 鏄惁鍚敤
    val days: String = "1111111"    // 7浣嶅瓧绗︿覆锛屾瘡浣嶄唬琛ㄥ懆涓€鍒板懆鏃ユ槸鍚﹀惎鐢?
)
