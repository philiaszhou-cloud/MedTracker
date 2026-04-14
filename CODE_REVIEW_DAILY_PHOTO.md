# 📸 MedReminderAI「每日拍照记录功能」代码审核报告

> **审核时间**: 2026-04-12 18:07  
> **审核范围**: 拍照识别 → 药片数量对比 → 强制校验 → 记录完整链路  
> **总体完成度**: **~80%** — 核心流程已打通，存在若干阻塞/建议级问题

---

## 一、功能需求回顾

| # | 需求点 | 说明 |
|---|---|---|
| R1 | 首页开关 | 设置页有开关，首页根据开关显示/隐藏拍照卡片 |
| R2 | 持久化 | 开关状态重启后不丢失 |
| R3 | 强制拦截（开启时） | 未拍照 → 禁止服药确认；数量不符 → 提示但可继续 |
| R4 | 关闭回退 | 关闭模式 → 回到原有直接确认流程 |
| R5 | 拍照→识别→对比 | 用户拍所有药片 → 系统识数 → 对比每日用量 |
| R6 | 记录存储 | 含日期/预期数/检测数/图片/状态 |

---

## 二、逐文件发现

### 2.1 `stores/index.ts` (379行) — 核心状态管理 ✅ 核心逻辑完整

**已实现:**
- `dailyPhotoConfig`: `{ enabled: boolean }` 配置对象
- `dailyPhotoLogs`: 完整记录数据结构（date/pillCount/expectedCount/photoUri/status/timestamp）
- `todayExpectedPillCount`: 遍历活跃药品 × 频率乘数
- `todayPhotoStatus`: UTC 日期查找当日记录
- `recordDailyPhoto()`: 覆盖更新旧记录 + 自动判断 completed/mismatch
- `loadFromStorage()` / `saveDailyPhotoConfig()` / `saveDailyPhotoLogs()`: 完整持久化

### 2.2 `pages/index/index.vue` (671行) — 首页 UI + 拦截逻辑 ✅ 基本完整

**已实现 (第44-198行):**
- 每日拍照卡片：v-if 条件渲染（关闭时隐藏）✅
- 三态展示：pending / completed / mismatch ✅
- confirmTake() 三层检查：
  - 未拍照 → 弹窗引导去拍照 ✅
  - 数量不符 → 弹窗提示（"继续"/"重新拍照"）✅
  - 已完成或关闭模式 → 直接走原有流程 ✅

### 2.3 `pages/recognize/index.vue` (861行) — 拍照识别页 ✅ 核心流程完整

**已实现:**
- URL 参数 `?mode=daily` 判断每日模式 (第240行) ✅
- App/H5 双端识别调用 (第427-448行) ✅
- 识别完成后自动调用 `store.recordDailyPhoto()` (第465-469行) ✅
- 每日模式对比卡片：预期 vs 检测数量 (第136-163行) ✅

### 2.4 `pages/settings/index.vue` (327行) — 设置页 ✅ 完整

**已实现 (第49-68行):**
- 开关 UI + 功能说明展开区域 ✅
- 调用 `store.updateDailyPhotoConfig()` → 持久化 ✅

### 2.5 `pages/history/index.vue` (381行) — 服药记录 ⚠️ 缺失

**问题:** dailyPhotoLogs 数据已正确存储和加载，但此页面**完全未集成**拍照日志展示。

### 2.6 `pages/medication/list.vue` + `detail.vue` + `add.vue`

作为数据基础，药品 CRUD 和用量设置均正常运作，不直接参与拍照流程。

### 2.7 `utils/pillCounter.ts` (1563行) — 药片检测算法

v8.3 版本，纯离线像素分析管线：
1. 高斯模糊降噪
2. 亮度直方图空隙分割（替代色差+Otsu）
3. 自适应形态学去噪（圆形核，四档半径）
4. BFS 连通区域标记
5. 多维度形状过滤（面积/宽高比/圆形度/亮度）

---

## 三、问题清单（按优先级排序）

---

### 🔴 阻塞级（必须修复）

#### B-01: 时区不一致导致跨天判定 Bug 🔴🔴🔴

**位置**: `stores/index.ts` 第141行 vs 第55-59行 / 第323行

```typescript
// todayPhotoStatus 使用 UTC 日期:
const today = new Date().toISOString().split('T')[0]; // ← UTC!

// todayLogs 使用本地日期:
const today = new Date();
today.setHours(0, 0, 0, 0); // ← 本地时间!
```

**影响**: 北京时间下午 16:00 后（UTC 00:00），`todayPhotoStatus` 会找不到当天的拍照记录，导致：
- 用户下午拍照后，系统仍显示"今日尚未拍照"
- 强制拦截误触发，用户无法完成服药确认

**修复方案:**
```typescript
// 统一使用本地时区:
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
```

---

#### B-02: "强制"并非真正强制 — 数量不符时可绕过

**位置**: `index.vue` 第178-194行

**现状**: 当 `status === 'mismatch'` 时，弹窗提供"**继续**"按钮允许用户跳过拍照直接记录。需求描述是"开启时**强制**用户每日拍照才能完成用药记录"，当前只是软拦截。

**两种修复路径:**
- **A. 硬性强制**: 移除"继续"选项，仅保留"重新拍照"
- **B. 保持现有行为但修改文案**: 将设置页说明从"数量正确才能完成"改为"建议数量正确后再记录"

---

#### B-03: 历史记录页未展示每日拍照日志 ❌ 缺失

**位置**: `history/index.vue`

**现状**: 该页面只展示 intakeLogs（taken/skipped/missed），完全没有读取或展示 dailyPhotoLogs。

**影响**: 
- 用户无法回溯查看过去每天的拍照验证结果
- 无法看到"哪几天拍了/哪几天没拍"
- 拍照功能的审计追踪能力缺失

**修复方案:**
在 `date-header` 区域增加拍照状态标识：
```html
<view v-if="getDailyPhotoStatus(group.date)" class="photo-status-badge">
  <text>{{ getDailyPhotoStatus(group.date)?.status === 'completed' ? '📸 已校验' : '⚠ 数量不符' }}</text>
</view>
```
并增加辅助函数：
```typescript
function getDailyPhotoStatus(date: string) {
  return store.dailyPhotoLogs.find(log => log.date === date) || null;
}
```

---

#### B-04: `custom` 自定义频率默认值不准

**位置**: `utils/index.ts` 第89行 + `stores/index.ts` 第133行

```typescript
custom: 1,  // ← 假设每天服用剂量×1次
```

**影响**: 如果用户设置了 "每周三次" 的自定义频率，系统仍然按每天1次计算预期药片数量，导致拍照对比结果持续为 mismatch。

**修复方案:**
- 在 Medication 类型中增加 `customDailyCount` 字段
- 或在 custom 频率下使用 `reminders.length * dosage` 作为预期值

---

### 🟡 建议级（应该修复）

#### S-01: 重拍时未清理旧图片文件

**位置**: `stores/index.ts` 第322-348行 `recordDailyPhoto()`

**问题**: 同一天多次重拍会覆盖 `dailyPhotoLogs` 中旧的 `photoUri` 字段，但旧图片文件本身未被清理。只有删除药品时才调用 `deletePersistedImage()`。

**影响**: 存储空间可能被废弃的拍照图片逐渐占用（每张 data URL 图片 ~100-300KB）。

**修复:** 在覆盖前先清理：
```typescript
if (existingIndex !== -1) {
  const oldPhotoUri = dailyPhotoLogs.value[existingIndex].photoUri;
  if (oldPhotoUri && oldPhotoUri !== photoUri) {
    deletePersistedImage(oldPhotoUri);
  }
}
```

---

#### S-02: 拍照识别缺少"确认提交"步骤

**位置**: `recognize/index.vue` 第465-469行

**现状**: 识别完成后**自动**调用 `store.recordDailyPhoto()` 记录结果。用户没有机会在看到对比结果后决定是否认可此次检测结果。

**影响**: 如果 AI 多检/漏检了药片，用户只能重新拍摄，而不能手动修正后提交。

**建议:** 在每日模式下增加一个"确认提交"按钮，让用户查看对比结果后主动确认。

---

#### S-03: 导出数据不包含拍照日志

**位置**: `settings/index.vue` 第162-169行

```typescript
const data = {
  medications: store.medications,
  intakeLogs: store.intakeLogs,
  reminderConfig: store.reminderConfig,
  // 缺少 dailyPhotoConfig 和 dailyPhotoLogs！
};
```

**修复:** 增加：
```typescript
dailyPhotoConfig: store.dailyPhotoConfig,
dailyPhotoLogs: store.dailyPhotoLogs,
```

---

#### S-04: `confirmTake` 参数类型不够精确

**位置**: `index.vue` 第161行

```typescript
function confirmTake(
  reminder: { medicationId: string; medicationName: string; dosage: string; scheduledTime: string; }
)
```

内联类型定义与 Store 返回类型耦合但不显式。建议定义 `TodayReminder` 接口复用。

---

### 💭 挑剔级（锦上添花）

| # | 问题 | 位置 |
|---|---|---|
| N-01 | `isDailyMode` computed 只是简单包装 `isDailyPhotoMode.value`，冗余 | recognize/index.vue:236 |
| N-02 | `dailyPhotoResult` 变量赋值后在模板中未绑定使用 | recognize/index.vue:226 |
| N-03 | 魔法数字 `640`（maxImageSize）硬编码在多处，应提取常量 | pillCounter.ts 多处, recognize.vue:437,440 |
| N-04 | H5/App Canvas ID 不一致 (`pill-canvas` vs `pill-detect-canvas`) | recognize/index.vue:64-69 vs 88-93 |
| N-05 | 每次 `onShow` 都全量 `loadFromStorage`（JSON.parse 全部数据），高频切换页面时有冗余 | index/list/history/settings 均有 |

---

## 四、功能完成度矩阵

| # | 功能子项 | 状态 | 说明 |
|---|---------|------|------|
| F1 | 设置页开关 UI | ✅ 完成 | toggle-switch + 说明文案 |
| F2 | 开关状态持久化 | ✅ 完成 | uni.setStorageSync |
| F3 | 首页拍照卡片展示 | ✅ 完成 | pending/completed/mismatch 三态 |
| F4 | 开启时未拍照拦截 | ✅ 完成 | 弹窗引导去拍照 |
| F5 | 开启时数量不符拦截 | ⚠️ 部分 | 有"继续"按钮可绕过（B-02） |
| F6 | 关闭时回退原模式 | ✅ 完成 | v-if 隐藏 + confirmTake 无额外检查 |
| F7 | 拍照入口（带 mode=daily） | ✅ 完成 | 首页卡片跳转传参 |
| F8 | 药片数量识别 | ✅ 完成 | v8.3 算法，1563 行核心代码 |
| F9 | 预期 vs 检测对比展示 | ✅ completed/mismatch/excess/deficit |
| F10 | 自动记录结果 | ✅ 完成 | recordDailyPhoto + 持久化 |
| F11 | **历史记录中展示拍照日志** | ❌ 缺失 | history 页面未集成 |
| F12 | **重拍时清理旧图片** | ❌ 缺失 | 覆盖记录时未删旧文件 |
| F13 | **自定义频率支持** | ⚠️ 部分 | custom 默认为 1 可能不准 |
| F14 | **导出数据包含拍照日志** | ❌ 缺失 | exportData() 未包含 |

**统计：10 项完成 / 2 项部分 / 4 项缺失 = 约 80%**

---

## 五、安全性评估

| 维度 | 评级 | 说明 |
|------|------|------|
| 图片安全 | ✅ 低风险 | 所有处理本地完成，不上传服务器 |
| 数据隐私 | ✅ 低风险 | uni.Storage 应用私有沙箱，无网络请求 |
| 输入验证 | ⚠️ 中等 | dosage/stockCount 用 parseInt 但未限制负数和超大值 |
| XSS 注入 | ✅ 安全 | `{{ }}` 插值自动转义，无 v-html |

---

## 六、性能评估

| 维度 | 评级 | 说明 |
|------|------|------|
| 图像处理 | ✅ 良好 | maxSize=640 限制；QuickSelect O(N)；形态学自适应 |
| Canvas 渲染 | ✅ 良好 | Path2D 批量绘制 >5000px 回退 ImageData |
| 存储 I/O | ⚠️ 可优化 | 每次 onShow 全量 JSON.parse（多页面重复） |
| 内存占用 | ✅ 可接受 | data URL 图片约 100-300KB/张，数量有限 |

---

## 七、总结与优先修复路线图

### 🎯 必须修（上线前）

1. **[B-01] 时区不一致 Bug** — 统一使用本地时区日期判断（影响所有 UTC+8 用户下午时段）
2. **[B-02] 强制语义明确** — 决定是硬强制还是软拦截，同步修改 UI 文案
3. **[B-03] 历史记录页展示拍照日志** — 至少加个状态标识
4. **[B-04] custom 频率默认值** — 要么让用户明确指定，要么用 reminders.length 计算

### 💡 应该修（下一迭代）

5. [S-01] 重拍清理旧图片
6. [S-02] 增加"确认提交"步骤
7. [S-03] 导出数据完整性

### ✨ 可以优化

8. [N-01~N-05] 代码质量小改进

---

*报告生成于 2026-04-12 by Code Review Agent 👁️*
