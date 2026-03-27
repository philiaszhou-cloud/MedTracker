# MedTracker - 每日服药记录 Android APP

## 项目概述

一个帮助用户每天记录服药情况的 Android APP，支持摄像头拍照记录、药物信息管理、提醒设置和历史查看。

## 功能特点

### 💊 主界面（今日）
- 显示今日日期和服药状态（已服/未服）
- 一键打开摄像头拍照记录
- 展示已设置的5种药物信息
- 最近服药统计

### 📷 摄像头拍照
- 使用 CameraX 调用后置摄像头
- 全屏摄像头预览
- 拍照后预览确认/重拍
- 顶部显示每种药物的颜色和形状提示
- 照片自动保存到 Pictures/MedTracker/ 目录
- 确认后保存服药记录

### ⚙️ 设置界面
**药物管理：**
- 添加/编辑/删除药物
- 药物名称、颜色（10种预设）、形状（7种预设）
- 每次剂量设置
- 可选参考照片

**提醒管理：**
- 添加多个提醒时间
- 时间选择器（24小时制）
- 提醒标签（如：早餐后、睡前）
- 开关单独控制每个提醒

### 📋 历史记录
- 按日期列出所有服药记录
- 每条记录显示日期、状态、服药时间
- 照片缩略图
- 点击查看全屏大图
- 统计完成情况

## 技术架构

```
com.medtracker.app/
├── data/
│   ├── entity/          # Room实体：Medication, MedicationRecord, Reminder
│   ├── dao/             # 数据访问：MedicationDao, RecordDao, ReminderDao
│   └── database/        # AppDatabase（Room数据库）
├── ui/
│   ├── main/            # MainActivity, HomeFragment
│   ├── camera/          # CameraFragment（CameraX）
│   ├── settings/        # SettingsFragment, AddMedicationFragment, Adapters
│   └── history/         # HistoryFragment, HistoryAdapter, PhotoViewFragment
├── viewmodel/           # MainViewModel（统一状态管理）
├── reminder/            # ReminderReceiver, ReminderScheduler（AlarmManager）
└── MedTrackerApplication.kt
```

**主要依赖：**
- CameraX 1.3.1 — 摄像头
- Room 2.6.1 — 本地数据库
- Navigation Component 2.7.6 — 页面导航
- Glide 4.16.0 — 图片加载
- Material Components — UI组件
- AlarmManager — 提醒调度

## 项目文件位置

`c:\Users\ThinkPad\WorkBuddy\20260326092742\MedTracker\`

## 如何编译运行

### 方式一：Android Studio（推荐）
1. 安装 Android Studio Hedgehog 或更新版本
2. File → Open → 选择 `MedTracker` 文件夹
3. 等待 Gradle 同步完成
4. 连接 Android 手机（开启开发者模式和USB调试）或创建虚拟设备
5. 点击 ▶ 运行

### 方式二：命令行
```bash
cd MedTracker
./gradlew assembleDebug
# APK 生成位置: app/build/outputs/apk/debug/app-debug.apk
```

## 首次使用流程
1. 安装 APP
2. 授权摄像头、通知、存储权限
3. 进入「设置」页 添加5种药物（填写名称、选择颜色和形状）
4. 在「设置」页 添加每日提醒时间
5. 每天收到提醒后，打开 APP → 把5种药放在一起 → 拍照 → 确认服药

## 注意事项
- 最低 Android 版本：8.0（API 26）
- 需要 Android 12+ 才能使用精确闹钟（SCHEDULE_EXACT_ALARM）
- 照片存储在手机相册的 MedTracker 文件夹中
- 提醒在重启后会自动重新注册（通过 BOOT_COMPLETED）


-- Updated at 2026-03-26 23:15:14
