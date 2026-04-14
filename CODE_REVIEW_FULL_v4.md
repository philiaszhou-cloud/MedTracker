# Medtracker 全项目代码审核报告 v4

> **审核时间**: 2026-04-13 08:40  
> **审核范围**: 全部 `.ts` / `.vue` 源文件（types、stores、utils ×4、pages ×7、App.vue、pages.json）  
> **基于版本**: CODE_REVIEW_FULL_v3 之后的所有变更  

---

## 🔧 已实施更改（2026-04-13）

以下为在本次审阅会话中已直接实施或修复的项（由开发/审阅者实时修改）：

- `tsconfig.json`：将 `@vue/tsconfig` 的关键选项内联并移除/替换已弃用项，添加 `verbatimModuleSyntax` 及 `ignoreDeprecations`，修复了 TypeScript 配置导致的诊断噪声。
- 已修复的 TypeScript 错误：
  - `src/utils/pillCounter.ts`：`quickSelect` 签名扩展为接受 `Float64Array`，解决直方图处理时的类型不匹配错误。
  - `src/stores/index.ts`：修正 `todayExpectedPillCount` 处对 `getDailyDosage` 的调用，传入字符串类型的 `med.dosage`，消除了类型错误并通过 `vue-tsc` 检查。
- `src/pages/recognize/index.vue`：增加带标注的导出功能（H5 使用 `canvas.toDataURL()`，App 使用 `uni.canvasToTempFilePath()`），并在用户确认数量时把标注图路径作为拍照记录的一部分保存（`recordDailyPhoto`）。
- 底部导航图标：更新了 `src/pages.json` 的图标引用（SVG 用于 H5，PNG 用于 App），并新增脚本 `tools/convert_svgs_to_pngs.js`（依赖 `sharp`）将仓库中的赛博朋克风 `static/tab/*.svg` 批量渲染为高分辨率 `*.png`，以修复 App 下图标不可见的问题。
- 文档：新增 `CHANGELOG.md` 并在 `START_HERE.md` 中加入 Recent changes 链接，记录本次变更。
- 运行结果：已执行 `npm run type-check`，当前无类型检查错误。

说明：以上更改为本次会话中所做的工程性修复与 UX 改进，仍有若干 B/S/N 类问题需要在后续迭代中进一步解决（见下文）。


## 📊 审核总览

| 等级 | 数量 | 说明 |
|------|------|------|
| 🔴 B 类（阻塞/严重） | **5** | 影响功能正确性或导致崩溃 |
| 🟡 S 类（建议改进） | **8** | 不影响运行，但影响可维护性/性能 |
| ⚪ N 类（轻微/代码洁癖） | **6** | 不影响功能 |

---

## 🔴 B 类问题（阻塞/严重）

### B-01：强制模式下 mismatch 仍有"继续"按钮绕过
- **文件**: `src/pages/index/index.vue` L231-247
- **现状**: 当 `requireDaily=true` 且拍照状态为 `mismatch` 时，弹窗仍显示"继续"按钮让用户绕过强制校验
- **风险**: 强制模式名不副实——开启后用户仍可不按正确数量服药
- **修复方案**: 当 `dailyPhotoConfig.requireDaily === true && todayPhotoStatus.status === 'mismatch'` 时：
  - 方案A（推荐）：隐藏"继续"按钮，只显示"重新拍照"
  - 方案B：保留"继续"但在记录时标记为 `taken_with_warning`（带警告状态的已服药），首页统计中单独展示

### B-02：`recordIntake` 库存扣减使用 `parseInt` 对非数字 dosage 可能产生 NaN
- **文件**: `src/stores/index.ts` L304
- **现状**: `const dosage = parseInt(med.dosage) || 1;`
- **问题**: 
  - 如果 `dosage` = `"半片"` → `parseInt` → `NaN` → fallback 到 `1` → 扣错了数量
  - 如果 `dosage` = `"1.5片"` → `parseInt` → `1` → 丢失小数部分
  - 如果 `dosage` = `"2粒胶囊"` → `parseInt` → `2` → 碰巧正确但不稳健
- **修复方案**: 提取数字部分的正则 `/[\d.]+/` 替代 `parseInt`

### B-03：`custom` 频率的每日剂量计算完全不可靠
- **文件**: `src/utils/index.ts` L81-93
- **现状**: `getDailyDosage('custom', '每周三次')` → `freqMap['custom'] = 1` → 返回 `1 * parseInt('每周三次') = 1 * NaN = 1`
- **问题**: 
  - 用户设置频率为"每周三次"、dosage 为"2片"，期望每日剂量应该是 `3*2/7 ≈ 0.86` 或某种合理值
  - 当前结果返回 `1`（因为 `parseInt('每周三次') === NaN`，fallback 到 1）
  - 这会导致 `todayExpectedPillCount` 偏高或偏低，拍照对比结果不准
- **修复方案**: 
  - 方案A（简单）：`custom` 频率返回 `0` 并在 UI 提示"自定义频率无法自动计算"
  - 方案B（完整）：将 `customFrequency?: string` 解析为结构化数据 `{timesPerWeek: number}`

### B-04：`clearAllImageData` App端清理路径与实际存储路径不一致
- **文件**: `src/utils/imageStorage.ts` L502-556 vs L94-129
- **现状**:
  - `persistImageApp()` 使用 `uni.saveFile()` → 文件保存在系统 `savedFiles` 目录（路径格式如 `file:///storage/emulated/0/Android/data/.../savedFiles/xxx.jpg`）
  - `clearAllImageData()` 尝试删除 `_doc/med_photos/` 目录
  - **这两条路径根本不是同一个！**
- **风险**: 用户点"清除所有数据"后，App 端已持久化的照片文件残留在 `savedFiles` 中，占用磁盘空间且无法回收
- **修复方案**: 
  - 方案A（推荐）：维护一个已持久化路径列表（类似 alarmCodes 的做法），删除时遍历逐一清理
  - 方案B：改用统一的存储目录（所有图片都存到 `_doc/med_photos/`）

### B-05：H5 轮询触发集合 `h5TriggeredToday` 永不清理，内存持续增长
- **文件**: `src/utils/notification.ts` L437
- **现状**: `const h5TriggeredToday = new Set<string>()` 是模块级变量，key 格式为 `${med.id}_${timeStr}_${now.getDate()}`
- **问题**: Set 只增不减。每天最多添加 `药品数 × 提醒次数` 条目，如果 App 连续运行 30 天不刷新，Set 中会积累大量过时条目
- **实际影响**: **低**（每条目仅 ~50 字节，即使 100 个药品×3 次/天×30 天 ≈ 9000 条 ≈ 450KB），但不符合最佳实践
- **修复方案**: 每次检查前清理前一天及之前的条目：
  ```ts
  const todayKey = String(new Date().getDate());
  for (const key of h5TriggeredToday) {
    if (!key.endsWith(`_${todayKey}`)) h5TriggeredToday.delete(key);
  }
  ```

---

## 🟡 S 类问题（建议改进）

### S-01：`loadFromStorage` 无缓存，每次页面切换都全量 JSON.parse
- **文件**: `src/stores/index.ts` L171-216
- **问题**: `index.vue` 和 `history.vue` 都在 `onShow` 中调用 `loadFromStorage()`，每次都 parse 5 个 storage key
- **影响**: 数据量大时（数百条记录+多张照片 URI）造成不必要的 CPU 开销和短暂卡顿
- **建议**: 增加 dirty flag 或版本号判断，仅在实际变更时重新加载

### S-02：`luma` 函数在 pillCounter.ts 和 pillRecognizer.ts 中重复定义
- **文件**: `src/utils/pillCounter.ts` L58-61, `src/utils/pillRecognizer.ts` L73-75
- **问题**: 同一函数两处定义，未来修改一处容易遗漏另一处
- **建议**: 统一到 `utils/index.ts` 导出，两处共用

### S-03：`isApp` 在 script setup 顶层执行，时机可能过早
- **文件**: `src/pages/recognize/index.vue` L254
- **现状**: `const isApp = typeof plus !== 'undefined';` 在模块加载时就求值
- **问题**: uni-app 中 `plus` 对象可能在某些时机尚未初始化（尤其热更新场景），导致 `isApp` 为 `false` 从而走了 H5 分支
- **建议**: 改为 computed 属性或在函数内部惰性求值

### S-04：导出数据的日期使用 ISO 格式，不够友好
- **文件**: `src/pages/settings/index.vue` L193
- **现状**: `exportDate: new Date().toISOString()` → `"2026-04-13T00:47:35.123Z"`
- **建议**: 改为 `new Date().toLocaleString('zh-CN')`

### S-05：add.vue 与 detail.vue 的编辑模式图片加载逻辑高度重复
- **文件**: `src/pages/medication/add.vue` L590-670, `src/pages/medication/detail.vue`（类似逻辑）
- **问题**: 两处都有 data URL / blob URL 判断 → verifyImagePath → resolveDisplayUrl / fileToDataUrl 的完整流程，约 80 行几乎一样
- **建议**: 抽取到 `useMedicationPhotoEditor` composable 中复用

### S-06：history 页面的日期过滤逻辑在 filteredLogs 和 filteredPhotoLogs 中重复
- **文件**: `src/pages/history/index.vue` L168-194 vs L212-238
- **问题**: 两段 switch-case 完全相同（today/week/month/all 四个分支）
- **建议**: 提取 `getFilterStartTime(filterValue): number` 公共函数

### S-07：App.vue `onShow` 每次都重新注册全部提醒
- **文件**: `src/App.vue` L28-47
- **现状**: 每次切回前台都调用 `scheduleAllReminders()`（内部先 `clearAllReminders` 再逐个注册）
- **影响**: 如果用户有 10 种药品×3 次提醒 = 30 条闹钟，每次切页面都要注销再重注册 30 次 AlarmManager 操作
- **建议**: 增加脏标记检测，仅当药品列表或提醒配置变化时才重新注册

### S-08：pillRecognizer 的色相直方图仅从 2 个颜色值估算，精度不足
- **文件**: `src/utils/pillRecognizer.ts` L448-484
- **现状**: `buildPillHueHistogram` 从 `domColor`(1个) + `avgColor`(1个) 共 2 个 RGB 值生成 12-bin 直方图
- **问题**: 12 个 bin 中最多只有 2~4 个非零值（含相邻扩散），与药品库中从真实像素提取的直方图做 Bhattacharyya 匹配时，信息量差距太大
- **建议**: 至少从 PillRegion 的 `avgColor` + `domColor` + 边界框四角颜色 共 ~5 个采样点生成更丰富的近似直方图；或者改为直接用 avgColor/domColor 做 RGB 欧氏距离匹配，去掉直方图维度降低复杂度

---

## ⚪ N 类问题（轻微）

| # | 问题 | 文件 | 行号 |
|---|------|------|------|
| N-01 | 生产环境残留大量 `console.log/warn` | 所有 ts 文件 | 散布各处 |
| N-02 | `Medication.imageUri` 字段标记为"兼容旧字段"但仍被引用（deletePersistedImage、recognize 等） | types/index.ts + 多处 | L18 |
| N-03 | `calcDaysRemaining` 返回 `Infinity`，UI 若直接显示可能显示 "∞ 天" | utils/index.ts | L73 |
| N-04 | `compactness` 字段值恒等于 `circularity`（冗余字段） | pillCounter.ts | L509-510 |
| N-05 | `sendLocalNotification` 的 `smallIcon` 硬编码为 `17301651`（android.R.drawable.ic_dialog_info） | notification.ts | L196 |
| N-06 | `declare const wx: any;` 全局声明仅微信小程序使用，其他平台多余 | recognize/index.vue | L227 |

---

## ✅ 已确认无问题的模块

以下模块在上次审核后的变更中已验证正常：

| 模块 | 状态 |
|------|------|
| 时区处理（`todayPhotoStatus` / `recordDailyPhoto`） | ✅ 已用本地时间 |
| 数据导出完整性（`exportData`） | ✅ 含 dailyPhotoConfig + dailyPhotoLogs |
| 数据清理（`clearAllData`） | ✅ 已调 clearAllImageData |
| Intent 一致性（`clearAllAlarms` vs `scheduleAlarm`） | ✅ 完全一致 |
| requestCode 持久化 | ✅ restoreRegisteredAlarmCodes 已接入 |
| 重复代码合并（pillCounter drawAndAnalyze） | ✅ 已提取公共函数 |
| 搜索防抖（list.vue debounce） | ✅ 已加 300ms |
| 照片丢失根因（base64 存入 form） | ✅ 已改为 persist 先行 |
| verifyImagePath null 反馈 | ✅ detail/add 已加 Toast |
| lastPhotoDate 显示 | ✅ index.vue 已增加 |
| 重拍旧图清理 | ✅ retakePhoto 已调 deletePersistedImage |
| History 拍照记录展示 | ✅ 已完整实现 |

---

## 🔗 问题关联关系图

```
B-02 (parseInt dosage)
   └─ 影响 → 库存扣减不准 → 用户看到剩余药量错误

B-03 (custom frequency=1)
   └─ 影响 → todayExpectedPillCount 错误
       └─ 影响 → 拍照对比结果始终不符（误报）
             └─ 影响 → B-01 强制模式频繁触发

B-04 (clearAllImageData 清不到 savedFiles)
   └─ 影响 → "清除数据" 后磁盘占用不减
       └─ 影响 → 长期使用后磁盘空间泄漏

S-05 (add/detail 重复) + S-06 (history 过滤重复)
   └─ 影响 → 维护成本增加，修改易遗漏
```

---

## 📋 修复优先级推荐

| 优先级 | 问题 | 工作量 | 收益 |
|--------|------|--------|------|
| **P0** | B-02 `parseInt` 库存扣减 | 5min | 防止数据损坏 |
| **P0** | B-04 清理路径不一致 | 30min | 防止磁盘泄漏 |
| **P1** | B-01 强制模式绕过 | 15min | 功能一致性 |
| **P1** | B-03 custom 频率计算 | 20min | 拍照对比准确度 |
| **P2** | S-01~S-08 各项优化 | 2~4h | 可维护性 |

---

*报告结束 — Medtracker Code Review v4 @ 2026-04-13*
