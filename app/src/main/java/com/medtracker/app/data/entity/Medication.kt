package com.medtracker.app.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * 药物信息实体
 */
@Entity(tableName = "medications")
data class Medication(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,           // 药物名称
    val color: String,          // 颜色描述（如：白色、黄色、粉红色等）
    val shape: String,          // 形状描述（如：圆形、椭圆形、胶囊等）
    val colorCode: Int,         // 颜色RGB代码，用于UI展示
    val dosage: String,         // 剂量（如：1片、2片）
    val notes: String = "",     // 备注
    val photoPath: String = "", // 单片药物参考照片路径
    val order: Int = 0          // 排列顺序
)
