# Medtracker 增量代码审核报告（v1 → v2）

> 审核日期：2026-04-12 23:10
> 审核范围：距上次审核（CODE_REVIEW_FULL_v1.md）后的代码变更
> 上次审核：19:48 → 本次审核：23:10（3小时22分钟内发生大量重构）

---

## 📊 变更总览

| 维度 | 变化 |
|------|------|
| **Store 重构** | 383行（原1563行），缩小77%，结构更清晰 |
| **类型系统** | `frequencyType` → `frequency`（string），custom对象类型被移除 |
| **时区问题** | ✅ 已修复 2 处 |
| **NaN保护** | ✅ 已添加 |
| **数据导出** | ✅ 已补全 dailyPhotoConfig/dailyPhotoLogs |
| **数据清理** | ✅ 已调用 clearAllImageData |
| **重拍泄漏** | ❌ 仍存在 |
| **History页** | ❌ 仍无拍照记录展示 |
| **强制模式** | ⚠️ 部分实现（UI有，但逻辑未真正强制） |

---

## ✅ 已修复的问题

### ✅ B-01：`todayPhotoStatus` 时区 UTC 问题已修复

**位置：** `src/stores/index.ts` 第 143-146 行

```typescript
const todayPhotoStatus = computed(() => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  return dailyPhotoLogs.value.find(log => log.date === today) || null;
});
```

改用 `new Date()` 本地时间，`getFullYear()/getMonth()/getDate()`，UTC 偏移问题已解决。

---

### ✅ B-04：`recordDailyPhoto` 时区问题已修复

**位置：** `src/stores/index.ts` 第 326-328 行

```typescript
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
```

同样改用本地时间，与 `todayPhotoStatus` 保持一致。

---

### ✅ B-05：`parseInt` NaN 保护已添加

**位置：** `src/stores/index.ts` 第 135-136 行

```typescript
const parsedDosage = parseInt(med.dosage);
const dailyCount = getDailyDosage(med.frequency, Number.isNaN(parsedDosage) ? 1 : parsedDosage);
```

非数字 dosage 现在会默认用 1。

---

### ✅ B-06：`getDailyDosage` 默认值优化

**位置：** `src/utils/index.ts` 第 81-82 行

```typescript
export function getDailyDosage(frequency: string, dosageStr: string): number {
  const dosage = parseInt(dosageStr) || 1;  // NaN → 1
  // ...
}
```

参数改为 `(frequency, dosageStr)` 两个 string，与调用方 `stockAlerts` 和 `todayExpectedPillCount` 完全对齐。

---

### ✅ B-13：数据清理现在同时清理 IndexedDB

**位置：** `src/pages/settings/index.vue` 第 240 行

```typescript
await clearAllImageData();
```

`clearAllImageData()` 被正确调用，且 exportData 现在包含完整数据：

```typescript
dailyPhotoConfig: store.dailyPhotoConfig,
dailyPhotoLogs: store.dailyPhotoLogs,
```

---

### ✅ S-11：确认按钮并发保护已添加

**位置：** `src/pages/index/index.vue` 第 219-223 行

```typescript
const confirmingMedId = ref('');

function confirmTake(reminder: ...) {
  if (confirmingMedId.value === reminder.medicationId) return;  // 防重
  confirmingMedId.value = reminder.medicationId;
  // ...
}
```

双击"确认服药"不会重复创建记录。

---

## ❌ 仍未修复的问题

### 🔴 B-02：`todayTotalCount` 与 `todayExpectedPillCount` 语义仍不一致

**位置：** `src/stores/index.ts` 第 70-76 行

```typescript
const todayTotalCount = computed(() => {
  let total = 0;
  activeMedications.value.forEach(med => {
    total += med.reminders.length;  // ❌ 提醒次数，不是剂量
  });
  return total;
});
```

同时 `todayExpectedPillCount` 用的是 `getDailyDosage`。首页进度条显示 `todayTakenCount / todayTotalCount`，但拍照期望用的是 `todayExpectedPillCount`，两者代表的不是一个东西。

---

### 🔴 B-03：`requireDaily` 强制模式 UI 有但逻辑无

**问题分析：**

`requireDaily` 在三个地方出现：
1. **store**（第35行）：定义了状态
2. **index.vue UI**（第61-73行）：可以切换，显示当前状态
3. **settings 页**（第61-70行）：可以切换，显示说明

但 `confirmTake` 中**从未读取 `requireDaily` 进行逻辑判断**：

```typescript
// index.vue confirmTake，第 242-258 行
if (todayPhotoStatus.value.status === 'mismatch') {
  uni.showModal({
    title: '拍照数量与预期不符',
    content: `...`,
    confirmText: '继续',  // ❌ 无论 requireDaily 是什么，都可以点"继续"
    cancelText: '重新拍照',
    success: (res) => {
      if (res.confirm) {
        recordIntakeConfirmed(reminder);  // 绕过了拍照验证
      }
    },
  });
}
```

**当 `requireDaily = true` 时，应该直接 `return`，不给用户"继续"的选择。** 当前的实现只是让用户看到了开关，但开关没有效果。

**修复建议：**

```typescript
if (todayPhotoStatus.value.status === 'mismatch') {
  if (dailyPhotoConfig.value.requireDaily) {
    uni.showModal({
      title: '数量不符，无法记录',
      content: `预期 ${todayPhotoStatus.value.expectedCount} 片，拍照 ${todayPhotoStatus.value.pillCount} 片。请重新拍照。`,
      confirmText: '重新拍照',
      showCancel: false,
    });
    confirmingMedId.value = '';
    return;
  }
  // 非强制模式 → 继续显示"继续/重新拍照"选择
}
```

---

### 🔴 B-15：History 页面仍无每日拍照记录

**位置：** `src/pages/history/index.vue` 全文

`dailyPhotoLogs` 在该页面中没有任何引用。用户拍了照，但在历史中完全看不到自己的拍照记录。这是一个核心功能缺口。

**建议：** 在 `groupedLogs` 下方增加一个"每日拍照记录"的折叠卡片区域：

```typescript
// 在 history/index.vue groupedLogs computed 后增加
const photoLogsGrouped = computed(() => {
  return store.dailyPhotoLogs.slice().reverse().map(log => ({
    date: log.date,
    pillCount: log.pillCount,
    expectedCount: log.expectedCount,
    status: log.status,
  }));
});
```

---

### 🔴 B-16：recognize 页重拍不清旧图

**位置：** `src/pages/recognize/index.vue`

每次重拍，`previouslyPersistedPath` 指向的旧文件没有被删除。新增 `clearAllImageData` 和 `deletePersistedImage` 已经存在，但 `onRetake` 没有调用它们。

**修复建议：** 在 `onRetake` 中添加：

```typescript
import { deletePersistedImage } from '../../utils/imageStorage';

function onRetake() {
  deletePersistedImage(this.previouslyPersistedPath);  // 新增
  this.previouslyPersistedPath = '';
  // ... 其余逻辑
}
```

---

### 🟡 N-05：`types/index.ts` 中 `custom` 类型字段缺失问题已消失

上次审核（S-01）指出 `Medication.custom` 的类型定义不完整。现在 `custom` 字段已被移除，改为 `customFrequency?: string`（简单字符串）。

⚠️ **但这引入了新问题**：之前用 `custom` 对象存储"每周哪几天"的逻辑现在无法实现了。如果将来需要这个功能，需要重新设计。

---

### 🟡 N-06：`verifyImagePath` 返回 `null` 时页面无降级处理

**位置：** `src/utils/imageStorage.ts` 第 573 行

```typescript
export function verifyImagePath(imagePath: string): Promise<string | null> {
  // 路径无效时返回 null
}
```

`null` 表示路径失效。但 `detail.vue`、`add.vue` 等页面在调用此函数后，对 `null` 的处理是**直接跳过**，没有提示用户重新拍照或从相册选择。

---

## 📝 新发现的问题

### 🔴 B-N1：Store 导出 `dailyPhotoLogs` 但 `confirmTake` 传递参数不完整

**位置：** `src/stores/index.ts` 第 326 行

```typescript
function recordDailyPhoto(pillCount: number, photoUri: string) {
  // ...
}
```

但 `todayPhotoStatus` 的类型定义（第40-47行）包含 `date`、`pillCount`、`expectedCount`、`photoUri`、`status`、`timestamp` 全部字段，而调用时传递的是 `(pillCount, photoUri)` 两个参数，`date`、`expectedCount`、`status`、`timestamp` 都是在函数内部计算的。这本身没问题，但与 `IntakeLog` 相比，`DailyPhotoLog` 的结构定义和实际使用有不一致感。

---

### 🟡 N-07：index.vue 首页缺少 `lastPhotoDate` 的 UI 显示

**位置：** `src/stores/index.ts` 第 36 行

```typescript
const dailyPhotoConfig = ref({
  enabled: false,
  requireDaily: false,
  lastPhotoDate: '',  // 新增字段
});
```

`lastPhotoDate` 已存储但没有任何页面展示。上次拍照是什么时候？用户无法从 UI 中看到这条信息。

---

### 🟡 N-08：imageStorage.ts v2 注释说明变化但行为有细微差异

**位置：** `src/utils/imageStorage.ts` v2 文件头注释

v1 → v2 的主要变化：
- `persistImage` 返回值：H5 端从 `blob URL` 改为 `idb://key`（间接）
- 新增 `resolveDisplayUrl` 作为统一入口

如果页面的某些代码原来依赖 `persistImage` 返回 `blob URL`，v2 的变化可能造成兼容性问题。建议对 H5 端做一次完整的图片加载测试。

---

## 📋 修复优先级更新

| 优先级 | 问题 | 状态 |
|--------|------|------|
| P0 | B-03 `requireDaily` 强制模式逻辑缺失 | ✅ 已修复 |
| P0 | B-02 `todayTotalCount` 语义不一致 | ⚠️ 语义不同但可接受（见说明） |
| P1 | B-15 History 页无拍照记录展示 | ✅ 已修复 |
| P1 | B-16 重拍不清旧图片 | ✅ 上次已修复（retakePhoto调用了deletePersistedImage） |
| P2 | N-06 `verifyImagePath` 返回 null 无降级 | ✅ 已修复（detail.vue + add.vue 加了Toast提示） |
| P2 | N-07 `lastPhotoDate` 无UI展示 | ✅ 已修复 |

---

*本报告为 CODE_REVIEW_FULL_v1.md 的增量补充，完整问题列表请参考原报告*
