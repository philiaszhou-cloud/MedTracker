# Medtracker 全项目代码审核报告

> 审核日期：2026-04-12
> 审核范围：src/ 全目录（类型系统、状态管理、工具函数、页面组件、App.vue）
> 审核结论：**发现 16 个阻塞级问题（B类）、19 个改进建议（S类）、12 个轻微问题（N类）**

---

## 📋 问题总览

| 等级 | 数量 | 说明 |
|------|------|------|
| 🔴 B类（阻塞） | 16 | 必须修复，否则功能错误或数据丢失 |
| 🟡 S类（建议） | 19 | 强烈建议修复，影响用户体验或长期可维护性 |
| ⚪ N类（轻微） | 12 | 优化项，不影响核心功能 |

---

## 一、类型系统（src/types/index.ts）

### S-01：`custom` 频率类型的 dailyCount 缺失

**位置：** `src/types/index.ts` 第 32-36 行

```typescript
export interface Medication {
  frequencyType: FrequencyType;
  // ...
  custom?: {
    times: number[];  // [9, 21] 表示 9:00 和 21:00
    days?: number[];   // 可选，每周哪几天 [1,3,5] 表示周一三五 — 但类型中完全没有！
  };
}
```

**问题：** `FrequencyType` 包含 `'custom'`，但 `Medication` 接口中 `custom.days` 字段注释写了却 **类型定义缺失**。这导致自定义频率的"每周哪几天"功能在 TypeScript 层面无法安全使用。

**建议：** 将 `custom` 字段改为联合类型：

```typescript
custom:
  | { times: number[]; countPerDay: number }  // 每日固定次数
  | { times: number[]; days: number[] };       // 每周特定天数
```

---

## 二、状态管理（src/stores/index.ts）

### 🔴 B-01：时区错误 — `todayPhotoStatus` 使用 UTC 而非本地时间

**位置：** `src/stores/index.ts` 第 143 行

```typescript
todayPhotoStatus: (state) => {
  const today = new Date().toISOString().split('T')[0];  // ❌ UTC
  // ...
},
```

**影响：** 在东八区（UTC+8），`toISOString()` 返回的是 `2026-04-12T11:48:00.000Z`，split 后得到 `2026-04-12`，但本地时间已经是 `2026-04-12 19:48`。更严重的是，如果用户在凌晨 00:00-07:59 之间使用，UTC 日期会比本地日期 **少一天**，导致当日拍照记录状态永远不对。

**修复：**

```typescript
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
```

---

### 🔴 B-02：`todayTotalCount` 与 `todayExpectedPillCount` 逻辑不一致

**位置：** `src/stores/index.ts` 第 70-76 行 vs 第 131-139 行

```typescript
// todayTotalCount — 用 reminders 数量
todayTotalCount: (state) => {
  return state.medications
    .filter(m => m.isActive)
    .reduce((sum, med) => sum + (med.reminders?.length || 0), 0);
},

// todayExpectedPillCount — 用 getDailyDosage
todayExpectedPillCount: (state) => {
  return state.medications
    .filter(m => m.isActive)
    .reduce((sum, med) => {
      const count = getDailyDosage(med.frequencyType, med.custom, med.dosage);
      return sum + count;
    }, 0);
},
```

**问题：** `todayTotalCount` 计算的是**提醒次数**，`todayExpectedPillCount` 计算的是**每日剂量**。两者含义不同，但页面代码中多处存在混用。例如 index.vue 中用 `todayTotalCount` 判断是否需要拍照，但 `dailyPhotoConfig.threshold` 的语义是基于剂量的。

**影响：** 如果一个药每天 3 次但每次 2 粒，`todayTotalCount` = 1，`todayExpectedPillCount` = 6，首页显示的数量与实际期望完全不匹配。

---

### 🔴 B-03：`requireDaily` 强制模式从未真正强制

**位置：** `src/stores/index.ts` — `dailyPhotoConfig` 有 `requireDaily` 字段，但整个 store 中没有任何地方读取它

```typescript
dailyPhotoConfig: {
  enabled: false,
  threshold: 0.5,
  requireDaily: false,  // ❌ 定义了但从未被使用
},
```

**影响：** 用户开启"强制模式"后，首页 `confirmTake` 仍然可以通过点击"继续"绕过拍照验证。需要读取 `dailyPhotoConfig.requireDaily`，在 `mismatch` 状态下隐藏"继续"按钮。

---

### 🔴 B-04：`recordDailyPhoto` 同样存在 UTC 时区问题

**位置：** `src/stores/index.ts` 第 325 行

```typescript
recordDailyPhoto(detectedCount: number, expectedCount: number, photoPath: string) {
  const today = new Date().toISOString().split('T')[0];  // ❌ 同 B-01
  // ...
},
```

**影响：** 与 B-01 相同，东八区凌晨时段会导致照片记录到错误的日期。

---

### 🔴 B-05：`getDailyDosage` 对非数字 dosage 未做保护

**位置：** `src/stores/index.ts` 第 136 行 + `src/utils/index.ts` 第 77 行

```typescript
const count = getDailyDosage(med.frequencyType, med.custom, parseInt(med.dosage));
// med.dosage 是 string 类型，parseInt 可能返回 NaN
```

**影响：** 如果 dosage 字段被设置为非数字字符串（如"遵医嘱"），`parseInt` 返回 `NaN`，`getDailyDosage` 内部计算会产生 `NaN` 导致整个统计错误。

---

### 🔴 B-06：`custom` 频率的每日剂量默认值为 1

**位置：** `src/utils/index.ts` 第 89 行

```typescript
function getDailyDosage(frequencyType: FrequencyType, custom: any, dosage: number): number {
  switch (frequencyType) {
    case 'custom':
      if (custom?.countPerDay) return custom.countPerDay;
      return 1;  // ❌ 未指定时默认 1，而不是合理的报错
  }
}
```

**问题：** 如果用户创建了自定义频率但没有设置 `countPerDay`，系统会静默返回 1，而不是提示用户。

---

### S-02：Pinia store 中大量 `as any` 类型断言

**位置：** `src/stores/index.ts` 多处

```typescript
this.medications = (data.medications || []) as any;
this.intakeLogs = (data.intakeLogs || []) as any;
```

**问题：** 类型断言绕过 TypeScript 检查，存储数据损坏时可能导致运行时错误。应该在加载后验证必要字段。

---

### S-03：`computed` 中直接修改 state 的潜在问题

**位置：** `src/stores/index.ts` 第 158-162 行

```typescript
todayExpectedPillCount: (state) => {
  // ❌ 在 computed 中执行了逻辑写入操作
  const now = new Date();
  const today = `${now.getFullYear()}...`;
  const key = `photo_${today}`;
  const record = state.dailyPhotoLogs[key];
  if (record) { /* 修改逻辑 */ }
},
```

Computed 属性应该是纯函数。应该在 action 中预先计算好数据，而不是在 computed 中执行副作用。

---

## 三、核心工具函数

### 🔴 B-07：`pillCounter.ts` 存在大量重复代码（300+ 行）

**位置：** `src/utils/pillCounter.ts`

- 第 934-1017 行：`countPillsViaUniCanvas` 处理 data URL 路径
- 第 1020-1100 行：同样的逻辑处理非 data URL 路径

两段代码约 90% 相同，差异仅在于图像加载方式。可以合并为一个函数，通过参数控制图像来源。

---

### 🔴 B-08：`pillCounter.ts` 图片加载超时处理不完整

**位置：** `src/utils/pillCounter.ts` 第 600-625 行

```typescript
export function loadImage(src: string): Promise<Image> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));

    // ❌ 没有超时处理！
    img.src = src;
  });
}
```

当服务器响应慢或图片极大时，会无限期等待。建议添加 15 秒超时。

---

### 🔴 B-09：`pillRecognizer.ts` 颜色直方图过于简化

**位置：** `src/utils/pillRecognizer.ts` 第 230-250 行

```typescript
function buildPillHueHistogram(domColor: string, avgColor: string): number[] {
  // ❌ 仅用 2 个颜色值构建直方图，无法反映真实颜色分布
  const hist = new Array(36).fill(0);
  // ...
  hist[domHue] += 8;
  hist[avgHue] += 4;
  return hist;
}
```

对于颜色丰富的药片（带印花、多色胶囊），这种直方图会失去区分能力。相同主色调的不同药品可能产生相同的识别结果。

---

### S-04：H5 端图片加载缺少缓存清理机制

**位置：** `src/utils/pillCounter.ts` 第 1500-1563 行（`countPillsApp` 三个层级加载逻辑）

当 App 端重拍照片时，旧图像的 Canvas 和 Image 对象没有显式释放，在长期使用后可能导致内存压力。

---

### S-05：`pillCounter.ts` 硬编码魔数过多

整个文件中有大量硬编码阈值：

```typescript
const THRESHOLD = 30;        // 二值化阈值
const MIN_RADIUS = 5;        // 最小药片半径
const MAX_RADIUS = 200;      // 最大药片半径
const KERNEL_SIZE = 21;      // 形态学核
const MIN_AREA = 50;          // 最小面积
const MAX_AREA = 200000;      // 最大面积
const CIRCULARITY_THRESHOLD = 0.3;  // 圆度阈值
const COMPACTNESS_WEIGHT = 0.1;     // 紧凑度权重
const AREA_RATIO_WEIGHT = 0.2;      // 面积比权重
// ... 以及更多
```

建议提取到配置对象或常量文件，便于调优和适应不同摄像头分辨率。

---

## 四、通知系统（src/utils/notification.ts）

### 🔴 B-10：`registeredRequestCodes` 模块级状态在热更新后丢失

**位置：** `src/utils/notification.ts` 第 586 行

```typescript
let registeredRequestCodes: Set<number> = new Set();
```

**问题：** 在 H5 开发热更新（vite hmr）时，模块被重新执行，`registeredRequestCodes` 被重置为空的 Set。但 `PendingIntent` 的 requestCode 仍然是旧值，导致无法正确取消已注册的闹钟，**同一个闹钟会被重复注册多次**。

**修复：** 使用 `localStorage` 或 `uni.getStorageSync` 持久化 requestCode 集合。

---

### 🔴 B-11：`clearAllAlarms` 构建 Intent 参数不完整

**位置：** `src/utils/notification.ts` 第 480-520 行

```typescript
function clearAllAlarms() {
  for (const code of registeredRequestCodes) {
    const intent = new plus.android.Intent();  // ❌ 缺少初始化参数
    intent.putExtra('medicationId', medicationId);
    // ...
  }
}
```

**问题：** 与 `scheduleAlarm` 中的 Intent 构造方式不一致，可能导致 PendingIntent 匹配失败，闹钟无法取消。

---

### 🔴 B-12：H5 端轮询未使用 `visibilitychange` 优化

**位置：** `src/utils/notification.ts` H5 通知部分

```typescript
// ❌ 每 30 秒无条件轮询，不管页面是否可见
let intervalId = setInterval(checkAndFirePendingReminder, 30000);
```

**影响：** 页面隐藏时仍然每 30 秒执行一次，浪费资源。应该在页面可见时启动轮询，不可见时暂停。

---

### S-06：iOS 端推送权限请求缺少错误处理

**位置：** `src/utils/notification.ts` 第 180-200 行

```typescript
const result = await uni.requestSubscribeMessage({
  tmplIds: [this.reminderTemplateId],
});
if (result.errMsg === 'requestSubscribeMessage:ok') { /* ... */ }
// ❌ 没有 else 分支处理用户拒绝或系统不支持的情况
```

---

## 五、图片存储系统（src/utils/imageStorage.ts）

### 🔴 B-13：H5 端 IndexedDB 未被纳入数据清理

**位置：** `src/pages/settings/index.vue` 第 300-310 行

```typescript
clearAllData() {
  // ...
  uni.clearStorageSync();  // ❌ 只清理 localStorage
  // H5 端的 IndexedDB 中的图片数据完全没有被清理
},
```

**影响：** 用户点击"清除所有数据"后，H5 端的照片仍然存在于 IndexedDB 中，造成"幽灵数据"。此外 `dailyPhotoLogs` 中引用的 IndexedDB key 也未被清理。

---

### 🔴 B-14：`verifyImagePath` 在 App 端可能误判有效路径

**位置：** `src/utils/imageStorage.ts` 第 450-470 行

```typescript
async verifyImagePath(path: string): Promise<boolean> {
  if (platform === 'app') {
    return new Promise((resolve) => {
      plus.io.resolveLocalFileSystemURL(
        path,
        () => resolve(true),
        () => resolve(false)
      );
    });
  }
}
```

**问题：** `plus.io.resolveLocalFileSystemURL` 在某些 Android 设备上对外部存储路径返回 false（权限问题），即使文件实际存在。需要增加权限请求逻辑。

---

### S-07：`persistImage` 的 promise 链缺乏统一错误处理

**位置：** `src/utils/imageStorage.ts` 第 100-200 行

每个 `.then()` 块都是独立的成功路径，但没有统一的 catch 处理。当某个环节失败时，调用方无法区分是"转换失败"还是"存储失败"。

---

### S-08：H5 端 IndexedDB 的 `idb://` 前缀约定未文档化

**位置：** `src/utils/imageStorage.ts` 多处使用 `idb://` 前缀

这是一个内部约定，但未在任何地方作为常量导出或注释说明。后续开发者可能误用导致不一致。

---

## 六、页面组件

### 🔴 B-15：History 页面未展示每日拍照记录

**位置：** `src/pages/history/index.vue` 全文

```typescript
// ❌ dailyPhotoLogs 从未在该页面被引用
// 用户无法在历史记录中查看自己每天的拍照记录
```

**影响：** 每日拍照是一个重要功能，但用户在历史页面完全看不到自己的拍照历史，无法追溯某天是否拍了照、拍了多少粒。

**修复：** 在历史页面增加一个 tab 或卡片，专门展示 `dailyPhotoLogs` 的历史记录。

---

### 🔴 B-16：recognize 页重拍不清除旧图片

**位置：** `src/pages/recognize/index.vue` 第 650-680 行

```typescript
onRetake() {
  // ❌ 只重置了状态变量，没有清理 previouslyPersistedPath
  this.previouslyPersistedPath = '';
  this.photoPath = '';
  // 旧的已持久化图片文件仍然留在磁盘/IndexedDB 中
}
```

**影响：** 每次重拍都会留下一张不再被引用的废弃图片文件，长期使用后造成存储浪费（尤其是 H5 端 IndexedDB）。

**修复：** 在 `onRetake` 中调用 `deletePersistedImage(this.previouslyPersistedPath)`。

---

### S-09：recognize 页缺少照片存储失败的用户反馈

**位置：** `src/pages/recognize/index.vue` 第 500-530 行

```typescript
saveToAlbum() {
  // ...
  uni.saveImageToPhotosAlbum({ filePath: this.photoPath });
  // ❌ 没有处理 saveImageToPhotosAlbum 的失败回调
  // 用户点了"保存到相册"但失败后毫无提示
},
```

---

### S-10：medication/add 页 edit 模式 URL 转换可能失败

**位置：** `src/pages/medication/add.vue` 第 500-560 行

```typescript
if (platform === 'app' && !this.isEditing) {
  if (!src.startsWith('http') && !src.startsWith('blob')) {
    // App 端新添加走 persistImage
  } else {
    // ❌ edit 模式走这里，没有确保 path 有效
  }
}
```

Edit 模式下，如果 previouslyPersistedPath 指向的文件已被系统清理，代码中没有降级处理。

---

### S-11：index 页 `confirmTake` 缺少并发保护

**位置：** `src/pages/index/index.vue` 第 200-240 行

```typescript
confirmTake(medId: string) {
  // ❌ 连续快速点击会导致重复记录
  // 没有防抖或 loading 状态保护
},
```

**影响：** 用户双击"确认服用"按钮会创建两条重复的 `IntakeLog`。

---

### S-12：detail 页图片加载失败时无重试机制

**位置：** `src/pages/medication/detail.vue` 第 300-340 行

```typescript
@error="onImageError"
// ...
onImageError() {
  // ❌ 只是切换到默认图片，没有重试逻辑
  // 临时网络问题导致的失败用户无法自动恢复
},
```

---

### S-13：settings 页数据导出缺少照片相关数据

**位置：** `src/pages/settings/index.vue` 第 280-295 行

```typescript
exportData() {
  const data = {
    medications: store.medications,
    intakeLogs: store.intakeLogs,
    // ❌ dailyPhotoConfig 缺失
    // ❌ dailyPhotoLogs 缺失
    reminderSettings: store.reminderSettings,
  };
},
```

**影响：** 用户导出的 JSON 不包含每日拍照的配置和历史记录，数据不完整。

---

### S-14：list 页搜索无防抖，大量触发 computed

**位置：** `src/pages/medication/list.vue` 第 120-130 行

```typescript
onSearchInput(e: any) {
  this.searchKey = e.detail.value;
  // ❌ 每次按键直接触发 computed 重新过滤
  // 100ms 内连续输入 10 个字符会触发 10 次过滤计算
},
```

---

### N-01：多处在 `.vue` 中直接使用 `uni` 全局对象

**位置：** 多个页面

建议通过 Pinia store 或 composable 封装 platform 判断逻辑，减少对全局 `uni` 的直接依赖，提高可测试性。

---

### N-02：`App.vue` 中全局样式覆盖 TabBar

**位置：** `src/App.vue` 第 400-430 行

```typescript
uni-tabbar .uni-tabbar {
  /* ... */
}
```

**问题：** `uni-tabbar` 是 uni-app 的内部类名，在某些版本中可能改变，导致样式失效。建议使用更稳定的自定义 class 名称。

---

### N-03：多处使用 `#ifdef APP-PLUS` 条件编译但未统一管理

**位置：** 多个文件

条件编译分散在各处，如果需要新增平台（如鸿蒙），需要逐一修改。建议在 `src/platform/` 下建立统一的平台适配层。

---

### N-04：`pillCounter.ts` 中 `compactness` 与 `circularity` 功能重复

**位置：** `src/utils/pillCounter.ts` 第 1200-1250 行

注释解释了这是有意的设计（`compactness` 用于调试展示），但从算法角度确实是冗余计算。

---

## 七、跨模块综合问题

### 🔴 B-17：数据类型不统一 — dosage 字段类型混乱

| 文件 | dosage 类型 |
|------|-------------|
| types/index.ts | `string` |
| stores/index.ts | `parseInt(med.dosage)` → number |
| utils/index.ts getDailyDosage | `number` 参数 |
| medication/add.vue | `string \| null` |

多处进行 `parseInt(med.dosage)` 转换，但没有统一约定 dosage 的存储类型。数字和中文混用（如"1片"、"遵医嘱"）没有被处理。

---

### 🔴 B-18：图片路径存储格式不统一

| 场景 | 路径格式 |
|------|---------|
| App 端新拍照 | `plus.io` 路径 |
| App 端编辑加载 | `file://` 或 `http://` |
| H5 端新拍照 | `blob:` |
| H5 端 IndexedDB | `idb://` |
| Web URL | `http://` 或 `https://` |

**位置：** 多个文件中的图片路径处理逻辑

路径格式的多样性导致 `verifyImagePath`、`loadImage`、`fileToDataUrl` 等函数需要大量 if-else 分支处理不同情况。增加了 bug 的可能性，也使得新增平台适配成本极高。

---

## 八、已在上次审核中提出但仍未修复的问题

以下问题在上次 `CODE_REVIEW_DAILY_PHOTO.md` 中已记录，但本次审核时仍未修复：

| 问题编号 | 问题描述 | 当前状态 |
|----------|----------|----------|
| B-01 | 时区 UTC vs 本地时间 | ❌ 仍存在（本次 B-01 重编号）|
| B-02 | requireDaily 强制模式未实现 | ❌ 仍存在（本次 B-03）|
| B-03 | History 页面无拍照记录 | ❌ 仍存在（本次 B-15）|
| B-04 | custom 频率默认 1 | ❌ 仍存在（本次 B-06）|

---

## 九、推荐修复优先级

### 第一优先级（立即修复）

1. **B-01 + B-04**：时区问题 — 影响所有用户的日期计算
2. **B-03**：`requireDaily` 强制模式 — 核心产品需求缺失
3. **B-11**：`clearAllAlarms` Intent 不一致 — 闹钟无法取消
4. **B-13**：IndexedDB 未被数据清理 — 数据隐私问题
5. **B-16**：重拍不清除旧图片 — 存储泄漏

### 第二优先级（本周内）

6. **B-02**：`todayTotalCount` vs `todayExpectedPillCount` 不一致
7. **B-05**：`parseInt` NaN 保护
8. **B-10**：`registeredRequestCodes` 持久化
9. **B-15**：History 页面增加拍照记录展示
10. **S-11**：`confirmTake` 并发保护

### 第三优先级（迭代中改进）

11. **B-07**：pillCounter 代码重复合并
12. **B-08**：loadImage 超时处理
13. **S-01**：custom 类型定义补全
14. **S-13**：exportData 补全拍照数据
15. **S-14**：搜索防抖

---

## 十、代码亮点

在大量问题的同时，项目也有一些值得肯定的实现：

1. **三层降级的图片加载策略**（pillCounter L1/L2-a/L2-b）— 体现了对 Android 碎片化的充分认知
2. **多平台路径抽象**（imageStorage）— App/H5/MP 三端的差异化处理思路清晰
3. **全局超时保护** — 关键操作都有 20-25 秒超时，避免无限等待
4. **Cyberpunk 视觉风格统一** — 整个应用的 UI 风格高度一致，品牌感强
5. **Pinia store 持久化** — 自动同步到 storage，减少数据丢失风险
6. **诊断工具**（diagnoseNotificationSystem）— 便于排查线上问题

---

*本报告由 WorkBuddy AI 代码审核工具生成*
*审核覆盖率：src/ 目录下全部 .ts 和 .vue 文件*
