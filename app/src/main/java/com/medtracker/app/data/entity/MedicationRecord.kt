package com.medtracker.app.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * 姣忔棩鏈嶈嵂璁板綍瀹炰綋
 */
@Entity(tableName = "medication_records")
data class MedicationRecord(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val date: String,               // 鏃ユ湡锛屾牸寮忥細yyyy-MM-dd
    val takenTime: String = "",     // 瀹為檯鏈嶈嵂鏃堕棿
    val photoPath: String = "",     // 褰撴棩鎵€鏈夎嵂鐗囧悎鐓ц矾寰?
    val isTaken: Boolean = false,   // 鏄惁宸叉湇鑽?
    val notes: String = "",         // 澶囨敞
    val medicationIds: String = ""  // 宸茶瘑鍒?纭鐨勮嵂鐗㊣D鍒楄〃锛堥€楀彿鍒嗛殧锛?
)
