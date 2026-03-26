package com.medtracker.app.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * 鑽墿淇℃伅瀹炰綋
 */
@Entity(tableName = "medications")
data class Medication(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,           // 鑽墿鍚嶇О
    val color: String,          // 棰滆壊鎻忚堪锛堝锛氱櫧鑹层€侀粍鑹层€佺矇绾㈣壊绛夛級
    val shape: String,          // 褰㈢姸鎻忚堪锛堝锛氬渾褰€佹き鍦嗗舰銆佽兌鍥婄瓑锛?
    val colorCode: Int,         // 棰滆壊RGB浠ｇ爜锛岀敤浜嶶I灞曠ず
    val dosage: String,         // 鍓傞噺锛堝锛?鐗囥€?鐗囷級
    val notes: String = "",     // 澶囨敞
    val photoPath: String = "", // 鍗曠墖鑽墿鍙傝€冪収鐗囪矾寰?
    val order: Int = 0          // 鎺掑垪椤哄簭
)
