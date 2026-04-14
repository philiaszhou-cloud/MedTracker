# Medtracker 功能说明

## 项目概述

Medtracker 是一款基于 UniApp 框架开发的智能用药提醒应用，采用赛博朋克视觉风格，支持 Android / iOS / H5 多端运行。所有数据本地存储，完全离线可用，图片不上传任何服务器。

---

## 技术栈

| 项目 | 技术 |
|------|------|
| 前端框架 | Vue 3 + TypeScript |
| 跨平台 | UniApp |
| 状态管理 | Pinia |
| 构建工具 | Vite |
| 数据存储 | uni.setStorageSync（本地） |
| 图片存储 | App端: data URL / savedFiles；H5端: IndexedDB |
| AI 识别 | 本地 Canvas 像素分析（纯离线） |

---

## 页面结构

```
├── 首页 (index)          — 今日用药概览、快捷操作、库存预警
├── 药品库 (list)         — 药品列表、搜索、添加入口
├── 视觉识别 (recognize)  — 拍照识别药片数量、补充库存
├── 服药记录 (history)    — 历史记录查询、依从性统计
└── 设置 (settings)       — 提醒配置、每日拍照、数据管理
```

### 子页面

```
├── 添加药品 (medication/add)     — 新增/编辑药品
└── 药品详情 (medication/detail)  — 查看详情、编辑、删除
```

---

## 功能模块

### 1. 首页

| 功能 | 说明 |
|------|------|
| 今日用药概览 | 显示今日已服药/总次数，进度条可视化 |
| 快捷操作 | 拍照记录、添加药品、药品清单三个快捷入口 |
| 每日拍照验证 | 启用后显示每日拍照卡片，拍照时对比预期数量与检测数量 |
| 拍照验证卡片 | 显示预期数量、拍照数量、校验状态，支持重新拍照 |
| 数量对比提示 | 拍照检测时即时显示预期vs检测数量，提示完美匹配或数量不符 |
| 库存预警 | 库存不足3天的药品自动预警 |
| 今日提醒 | 按时间排列的待办提醒，一键确认服药 |
| 语音播报 | 确认服药后语音播报药品名称（App端） |

### 2. 药品管理

#### 2.1 添加药品

| 字段 | 必填 | 说明 |
|------|------|------|
| 用药类型 | 是 | 日常用药 / 临时用药 |
| 药盒照片 | 是 | 拍照或从相册选取 |
| 药片照片 | 是 | 拍照或从相册选取 |
| 药品名称 | 是 | 如：阿莫西林胶囊 |
| 规格 | 否 | 如：0.25g × 24粒 |
| 每次服用 | 是 | 数量（片） |
| 保质期 | 是 | 选择年月，过期自动提醒 |
| 用药频率 | 是 | 每日1/2/3次、隔日、每周、自定义 |
| 提醒时间 | 是 | 支持多个提醒时间 |
| 当前库存 | 是 | 片数 |
| 备注 | 否 | 特殊说明、医嘱等 |

#### 2.2 药片识别（添加药品页内）

| 功能 | 说明 |
|------|------|
| 识别药片轮廓 | 点击"识别药片轮廓"按钮启动检测 |
| 检测结果显示 | 显示检测到的药片数量和置信度 |
| 超时保护 | 25秒超时自动终止 |
| 离线处理 | 所有分析在设备本地完成 |

#### 2.3 药品列表

| 功能 | 说明 |
|------|------|
| 药品搜索 | 按名称搜索 |
| 库存显示 | 每个药品显示当前库存 |
| 库存不足标记 | 库存不足3天自动标红 |
| 停用标记 | 已停用药品半透明显示 |
| 提醒时间标签 | 显示每个药品的提醒时间 |

#### 2.4 药品详情

| 功能 | 说明 |
|------|------|
| 启用/停用 | 切换药品启用状态 |
| 药品照片 | 显示药盒和药片照片，点击可预览 |
| 用药方案 | 显示用药类型、剂量、频率、提醒时间、保质期 |
| 库存信息 | 显示库存数量、预计可用天数 |
| 近期记录 | 显示最近10条服药记录 |
| 编辑/删除 | 编辑药品信息或删除药品 |

### 3. 视觉识别

| 功能 | 说明 |
|------|------|
| 拍照识别 | 拍摄药片照片，自动检测数量 |
| 从相册选取 | 从手机相册选择图片 |
| 保存到相册 | 拍照后自动保存到系统相册 |
| 数量检测 | 纯离线Canvas像素分析，检测药片数量 |
| 置信度显示 | 显示检测置信度百分比 |
| 补充库存 | 检测完成后可选择药品补充库存（非每日模式） |
| 拍摄建议 | 置信度低时显示拍摄建议（非每日模式） |
| 每日拍照模式 | 启用时显示数量对比卡片，自动对比预期数量与检测数量 |
| 数量校验提示 | 显示完美匹配、数量超预期或数量不足提示 |

#### 识别流程

**标准模式：**
```
拍照/选取图片 → 显示预览 → 保存到相册 → 持久化图片 → 启动数量检测 → 显示结果 → 补充库存
```

**每日拍照模式：**
```
拍照/选取图片 → 显示预览 → 保存到相册 → 启动数量检测 → 显示对比卡片
(预期数量 VS 检测数量) → 保存拍照记录 → 返回首页
```

#### 技术细节

- **H5端**：使用 `countPillsH5WithOverlay`，基于 Web Canvas API 进行像素分析
- **App端**：使用 `countPillsApp`，自动选择 uni canvas 方案或 Web API 方案
- **data URL / blob URL**：优先走 Web API（`countPillsViaWebAPI`）
- **本地文件路径**：走 uni canvas 方案（`countPillsViaUniCanvas`），避免 WebView 加载本地文件失败

### 4. 服药记录

| 功能 | 说明 |
|------|------|
| 日期筛选 | 今天 / 近7天 / 近30天 / 全部 |
| 统计摘要 | 已服药、已跳过、已漏服、依从率 |
| 日期分组 | 按日期分组显示记录 |
| 状态标识 | ✅已服药 / ⏭️已跳过 / ❌已漏服 |

### 5. 设置

| 功能 | 说明 |
|------|------|
| 用药提醒 | 开关提醒功能 |
| 提醒声音 | 开关提醒声音 |
| 震动提醒 | 开关震动 |
| 提前提醒 | 0/5/10/15/30分钟 |
| 每日拍照记录 | 启用后需每日拍照验证 |
| 导出数据 | 导出JSON格式备份 |
| 清除数据 | 清除所有本地数据 |
| 隐私说明 | 所有数据本地存储 |

### 6. 每日拍照验证（可选功能）

| 功能 | 说明 |
|------|------|
| 启用/关闭 | 在设置页 "📸 每日拍照记录" 部分切换 |
| 状态卡片 | 首页显示当日拍照验证状态和结果 |
| 待拍照状态 | 显示 "⏳ 今日尚未拍照验证"，提供 "立即拍照" 按钮 |
| 已拍照状态 | 显示预期数量、拍照数量、校验状态徽章 |
| 数量对比 | 拍照时即时显示 "预期 VS 检测" 对比卡片，支持三种状态：
- ✓ 完美匹配！可以标记为完成
- ⚠ 药片数超过预期
- ⚠ 药片数少于预期 |
| 校验记录 | 每日拍照结果保存至 `dailyPhotoLogs`，包含：日期、拍照数量、预期数量、校验状态（completed/mismatch） |
| 服药流程 | 启用时检查每日拍照状态：
  - 未拍照 → 弹窗提示，点击 "去拍照" 跳转识别页
  - 已拍照但不符 → 弹窗警告但允许继续
  - 已拍照且匹配 → 正常进行服药确认 |
| 重新拍照 | 首页拍照卡片支持 "重新拍照" 按钮，可在同一日期更新记录 |

---

## 数据模型

### Medication（药品）

```typescript
interface Medication {
  id: string;
  name: string;                    // 药品名称
  specification: string;           // 规格
  dosage: string;                  // 单次剂量
  frequency: FrequencyType;        // 服药频率
  customFrequency?: string;        // 自定义频率
  stockCount: number;              // 剩余库存
  reminders: string[];             // 提醒时间 ["08:00", "20:00"]
  medicationType: MedicationType;  // 日常 | 临时
  boxImageUri: string;             // 药盒照片（data URL 或持久路径）
  pillImageUri: string;            // 药片照片（data URL 或持久路径）
  expiryDate: string;              // 保质期 "YYYY-MM"
  imageUri?: string;               // 兼容旧字段
  notes?: string;                  // 备注
  createdAt: number;               // 创建时间
  isActive: boolean;               // 是否启用
}
```

### IntakeLog（服药记录）

```typescript
interface IntakeLog {
  id: string;
  medicationId: string;
  medicationName: string;
  timestamp: number;
  status: 'taken' | 'skipped' | 'missed';
  scheduledTime: string;           // "08:00"
}
```

### ReminderConfig（提醒配置）

```typescript
interface ReminderConfig {
  enabled: boolean;
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  advanceMinutes: number;
}
```

### DailyPhotoConfig（每日拍照配置）

```typescript
interface DailyPhotoConfig {
  enabled: boolean;           // 是否启用每日拍照验证
  requireDaily: boolean;      // 是否强制每日验证（预留字段）
  lastPhotoDate?: string;     // 最后一次拍照日期 "YYYY-MM-DD"
}
```

### DailyPhotoLog（每日拍照记录）

```typescript
interface DailyPhotoLog {
  date: string;               // 拍照日期 "YYYY-MM-DD"
  pillCount: number;          // 检测到的药片数量
  expectedCount: number;      // 预期的每日总数量（从提醒配置计算）
  photoUri: string;           // 拍照保存的图片路径或data URL
  status: 'completed' | 'mismatch';  // 校验状态
  timestamp: number;          // 拍照时间戳
}
```

---

## 图片存储策略

### App端

| 阶段 | 路径格式 | 说明 |
|------|----------|------|
| 拍照后立即显示 | 临时路径 | `uni.chooseImage` 返回的 tempFilePath |
| 转换后显示 | data URL | `fileToDataUrl` 转换，base64编码 |
| 存入Store | data URL | **直接存储data URL，不依赖文件系统** |
| 持久化备份 | savedFiles:// | `uni.saveFile` 保存，作为备份 |

> **关键设计**：App端将 data URL 直接存入 `boxImageUri` / `pillImageUri`，因为 `savedFiles://` 路径可能被 Android 系统清理导致失效，而 data URL 是自包含的，不会丢失。

### H5端

| 阶段 | 路径格式 | 说明 |
|------|----------|------|
| 拍照后立即显示 | blob URL | `uni.chooseImage` 返回 |
| 持久化后 | idb:// key | IndexedDB 存储 |
| 显示时解析 | blob URL | `resolveDisplayUrl` 从 IndexedDB 读取 |

---

## 通知系统

| 平台 | 实现方式 |
|------|----------|
| Android | AlarmManager + NotificationCompat |
| iOS | 本地通知 |
| H5 | 轮询检查 |

### 通知渠道

- 创建专用通知渠道 `medreminder_channel`
- 支持精确闹钟权限请求
- 提醒时间变更后自动重新注册

---

## 工具模块

### pillCounter.ts — 药片数量检测

| 函数 | 说明 |
|------|------|
| `countPillsApp` | App端入口，自动选择方案 |
| `countPillsViaWebAPI` | Web DOM API方案（data/blob/http URL） |
| `countPillsViaUniCanvas` | uni canvas方案（本地文件路径） |
| `countPillsH5WithOverlay` | H5端带轮廓叠加的检测 |
| `analyzePixels` | 像素分析核心算法 |

### imageStorage.ts — 图片存储

| 函数 | 说明 |
|------|------|
| `persistImage` | 持久化图片（跨平台） |
| `fileToDataUrl` | 将文件路径转为 data URL |
| `resolveDisplayUrl` | 解析可显示的 URL |
| `loadImageFromStorage` | 从存储加载图片 |
| `verifyImagePath` | 验证路径有效性（Android） |
| `deletePersistedImage` | 删除持久化图片 |

### notification.ts — 通知系统

| 函数 | 说明 |
|------|------|
| `createNotificationChannel` | 创建通知渠道 |
| `scheduleAllReminders` | 注册所有提醒 |
| `requestNotificationPermission` | 请求通知权限 |

---

## 超时保护机制

所有可能卡死的异步操作均设有超时保护：

| 操作 | 超时时间 |
|------|----------|
| `persistImageApp` | 10秒 |
| `persistImageAppPlusIO` | 8秒 |
| `fileToDataUrl` | 8秒（外层）+ 5秒（FileReader） |
| `saveImageToPhotosAlbum` | 10秒 |
| `countPillsApp` | 20秒（内部） |
| `runPillDetection` | 25秒（外层） |

---

## 赛博朋克视觉风格

应用采用统一的赛博朋克设计语言：

- **配色**：深色背景（#0A0E27 / #0D1117）+ 霓虹高亮（#00D9FF / #00FF41 / #B000FF）
- **导航栏**：HUD风格，扫描线动画，十字瞄准装饰
- **卡片**：半透明毛玻璃效果，霓虹边框发光
- **按钮**：霓虹发光，按压缩放反馈
- **字体**：等宽字体（Courier New），大写标题
- **动画**：脉冲发光、扫描线、渐变过渡
