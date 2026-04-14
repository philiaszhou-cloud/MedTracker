# Medtracker 全项目代码审核报告 v3（含照片丢失修复）

> 审核日期：2026-04-12 23:38
> 覆盖范围：src/ 全部源码
> 本次重点：**🔴 照片丢失 Bug 根因修复 + 全面审核**

---

## 🔴 本次修复的核心 Bug：药盒/药片照片丢失

### 问题现象
用户编辑药品时拍摄了药盒和药片照片，App 内显示正常。但**重新进入药品详情页或重启 App 后照片消失/黑屏**，而系统相册中却能看到当时拍的照片。

### 根因分析（三重叠加）

```
拍照 → tempPath → fileToDataUrl()转base64(3~8MB) → form.boxImageUri = base64字符串
                                                    ↓
                                          saveMedication()
                                                    ↓
                                    JSON.stringify(medications) 
                                      含2张base64图片 ≈ 6~16MB
                                                    ↓
                              uni.setStorageSync() ← ⚠️ 超出容量上限！
                              （uni-app localStorage 通常限制 5MB）
                                                    ↓
                              存储失败/截断 → 下次加载解析失败 → 照片丢失
```

### 三处代码缺陷

| # | 文件 | 行号 | 问题 |
|---|------|------|------|
| **1** | `add.vue` | 第 458 行（旧） | **将 base64 data URL 直接存入 `form.boxImageUri`**，导致 `setStorageSync` 时数据量爆炸 |
| **2** | `imageStorage.ts` | 第 78 行（旧） | `isAlreadyPersisted()` 将 `data:image` 视为已持久化 → **跳过磁盘写入** |
| **3** | `stores/index.ts` | 第 152 行 | 整个药品数组 JSON 序列化时包含大图 base64，**超出 localStorage 上限后静默失败** |

### 修复方案

#### 修复 1：`add.vue` — 改为先持久化再存路径

```typescript
// ★ v12 修复流程（新）
// Step 1: 先用 tempPath 持久化到磁盘（uni.saveFile / IndexedDB）
const persistedPath = await persistImage(tempPath);

// Step 2: form 只存持久化后的短路径字符串（如 "savedFiles://xxx" 或 "idb://key"）
form.value.boxImageUri = persistedPath;   // ← 不再是 data URL！

// Step 3: 仅 displayUrl 用 data URL（纯展示用途，不进存储）
boxDisplayUrl.value = await fileToDataUrl(persistedPath);
```

**核心变化**：持久化操作从"可选的后续步骤"变为"必须的第一步"，确保在 data URL 转换之前完成磁盘写入。

#### 修复 2：`imageStorage.ts` — 移除 `data:image` 的误判

```typescript
function isAlreadyPersisted(path: string): boolean {
  return (
    path.includes('_doc/') ||
    path.includes('savedFiles') ||
    // ...
    path.startsWith('idb://')
    // ❌ 移除: path.startsWith('data:image')
    // ❌ 移除: path.startsWith('blob:')
    // 原因：这些是内存中的临时数据，不保证跨会话存在
  );
}
```

**影响**：即使调用方错误地将 data URL 传入 `persistImage()`，也会被正确处理（H5端会走 fetch→blob→IndexedDB 流程）。

#### 修复 3：`detail.vue` + `add.vue` — 兼容旧版 data URL

```typescript
// 检测旧版本遗留的 data URL 格式
const boxIsDataUrl = (currentMed.boxImageUri || '').startsWith('data:');
if (boxIsDataUrl) {
  console.log('[Detail] ★ 检测到旧版 data URL 格式');
  resolvedBoxUrl.value = currentMed.boxImageUri; // 直接使用（仍可显示）
  uni.showToast({ title: '⚠️ 建议重新拍摄以迁移格式', icon: 'none' });
}
```

**目的**：旧数据不会立刻丢失，但提示用户重新拍摄来触发新的持久化流程。

---

## 📊 全项目问题清单

### 🔴 B类（阻塞级）

| 编号 | 文件 | 问题 | 状态 |
|------|------|------|------|
| **B-01** | `stores/index.ts` L143 | `todayPhotoStatus` UTC vs 本地时间 | ✅ 已修复（v2） |
| **B-02** | `stores/index.ts` L70-76 | `todayTotalCount` vs `todayExpectedPillCount` 语义不同 | ℹ️ 可接受（用途不同） |
| **B-03** | `index/index.vue` | `requireDaily` 强制模式未实现 | ✅ 已修复（v2） |
| **B-04** | `stores/index.ts` L326 | `recordDailyPhoto` UTC 时间 | ✅ 已修复（v2） |
| **B-05** | `stores/index.ts` L135 | `parseInt(dosage)` NaN 保护 | ✅ 已修复（v2） |
| **B-06** | `utils/index.ts` L89 | `custom` 频率默认值 1 | ✅ 已修复（v2） |
| **B-07** | `pillCounter.ts` | 300+行重复代码 | ✅ **已修复（v13）** |
| **B-08** | `pillCounter.ts` | `loadImage` 无超时保护 | ⚠️ 待添加 |
| **B-09** | `pillRecognizer.ts` | 颜色直方图过于简化 | ⚠️ 设计取舍 |
| **B-10** | `notification.ts` | `registeredRequestCodes` 热更新丢失 | ✅ **已修复（v13）** |
| **B-11** | `notification.ts` | `clearAllAlarms` Intent 不一致 | ✅ 已确认无问题（Intent 构建与 scheduleAlarm 一致） |
| **B-12** | `notification.ts` | H5轮询未优化 visibilitychange | ⚠️ 低优先级 |
| **B-13** | `settings/index.vue` | IndexedDB 未纳入清理 | ✅ 已修复（v2） |
| **B-14** | `imageStorage.ts` | `verifyImagePath` Android 误判 | ⚠️ 边缘情况 |
| **B-15** | `history/index.vue` | 无每日拍照记录展示 | ✅ 已修复（v2） |
| **B-16** | `recognize/index.vue` | 重拍不清旧图 | ✅ 上次已修复（retakePhoto调用了deletePersistedImage） |
| **B-17** | `types/index.ts` | dosage 类型 string/number 混用 | ⚠️ 设计遗留 |
| **B-18** | 多文件 | 图片路径存储格式不统一 | ⚠️ 架构债务 |
| **★ B-NEW** | `add.vue` + `imageStorage.ts` | **base64 data URL 直接存入 form → setStorage 超限 → 照片丢失** | ✅ **本次修复！** |

---

### 🟡 S类（建议改进）

| 编号 | 文件 | 问题 | 状态 |
|------|------|------|------|
| S-01 | `types/index.ts` | `custom.frequency` 缺少结构化定义 | ⚠️ 功能降级 |
| S-02 | `stores/index.ts` | 大量 `as any` 类型断言 | 待优化 |
| S-03 | `stores/index.ts` | computed 中有逻辑副作用 | 待拆分 |
| S-04 | `pillCounter.ts` | H5端缓存未清理 | 低优先级 |
| S-05 | `pillCounter.ts` | 硬编码魔数过多 | 建议提取配置 |
| S-06 | `notification.ts` | iOS推送权限无错误处理 | 待补充 |
| S-07 | `imageStorage.ts` | promise链缺统一catch | 低优先级 |
| S-08 | `imageStorage.ts` | `idb://` 前缀未文档化 | 已注释说明 |
| S-09 | `recognize/index.vue` | 相册保存失败无反馈 | ✅ 已修复（doSaveToAlbum加了fail处理） |
| S-10 | `medication/add.vue` | edit模式URL转换失败无降级 | ⚠️ 有Toast提示 |
| S-11 | `index/index.vue` | confirmTake并发保护 | ✅ 已修复（v2） |
| S-12 | `detail.vue` | 图片加载失败无重试 | ✅ 已增强（v12兼容旧格式+Toast） |
| S-13 | `settings/index.vue` | exportData缺photo数据 | ✅ 已修复（v2） |
| S-14 | `list.vue` | 搜索无防抖 | ✅ **已修复（v13，300ms debounce）** |

### ⚪ N类（轻微）

| 编号 | 文件 | 问题 |
|------|------|------|
| N-01 | 多文件 | `.vue` 中直接用全局 `uni` 对象 |
| N-02 | `App.vue` | TabBar样式依赖内部类名 |
| N-03 | 多文件 | 条件编译分散未统一管理 |
| N-04 | `pillCounter.ts` | compactness 与 circularity 冗余 |
| N-05 | `types/index.ts` | custom对象类型被移除为简单字符串 |
| N-06 | `verifyImagePath` | null返回值已有Toast处理 ✅ |
| N-07 | `lastPhotoDate` | 已有UI展示 ✅ |
| N-08 | imageStorage v2 | H5行为变化需测试 |

---

## ✅ 代码亮点

1. **三层数据加载降级链**（pillCounter L1/L2-a/L2-b）— 体现对Android碎片化的充分理解
2. **多平台路径抽象层**（imageStorage）— App/H5/MP 三端差异化处理的清晰思路
3. **全局超时保护体系** — 关键操作均有 8-25s 超时，避免无限等待
4. **赛博朋克视觉系统** — 整体 UI 风格高度一致，品牌感强
5. **Pinia store 自动持久化** — 每次 mutation 同步 storage
6. **诊断工具**（diagnoseNotificationSystem）— 便于线上排查

---

## 📋 后续待办（按优先级排序）

### P0 - 本周内
- [x] **B-07**: pillCounter 300+行重复代码合并提取公共函数 ✅ v13
- [x] **B-10**: registeredRequestCodes 持久化到 storage ✅ v13
- [x] **B-11**: clearAllAlarms Intent 参数与 scheduleAlarm 统一 ✅ 已确认无问题

### P1 - 下周迭代
- [ ] **B-08**: loadImage 添加 15s 超时保护
- [ ] **S-02**: stores 中 `as any` 改为类型守卫或 Zod 校验
- [ ] **S-05**: pillCounter 魔数提取到配置常量文件
- [ ] **N-03**: 条件编译统一到 `src/platform/` 适配层

### P2 - 技术债
- [ ] **B-17/B-18**: 统一图片路径存储格式，建立 `ImagePath` 工具类型
- [x] **S-14**: list.vue 搜索加 debounce（300ms） ✅ v13

---

*本报告由 WorkBuddy AI 代码审核工具生成 v3*
*审核覆盖率：100% src/ 目录 .ts + .vue 文件*
*本次新增：B-NEW 照片丢失根因修复（3个文件4处修改）*
