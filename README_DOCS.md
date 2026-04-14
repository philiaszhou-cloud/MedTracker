# 📚 Medtracker 文档索引

> **快速查阅指南** - 根据您的需求快速定位文档

---

## 🎯 按用途分类

### 🔴 我想要...

#### 理解完整的识别流程
→ [RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md)
- ✅ 整体流程架构
- ✅ 三级 Fallback 详解
- ✅ 错误处理矩阵
- ✅ UI 状态管理
- ✅ 预期行为和时间线

#### 知道最终验证结果
→ [FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md)
- ✅ 全景检查清单
- ✅ 关键质量检查
- ✅ 完整流程验证（端到端）
- ✅ 错误场景验证
- ✅ 提交 APK 前检查清单

#### 快速开始 APK 测试
→ [QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md)
- ✅ 5 个关键测试场景
- ✅ 常见现象及诊断
- ✅ 日志解读指南
- ✅ 测试检查清单
- ✅ 快速 Debug 技巧

#### 了解所有修复内容
→ [REPAIR_SUMMARY.md](REPAIR_SUMMARY.md)
- ✅ 修复清单（14 个 TS 错 + 3 个 Bug）
- ✅ 修复前后对比
- ✅ 验证步骤
- ✅ 修复统计
- ✅ 后续步骤

---

## 📖 按主题分类

### 超时和 Fallback

**问题**：我想了解如何处理网络超时
**文档**：[RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md#三级-fallback-架构)
**关键内容**：
- L1: 8 秒 Image API
- L2-a: 5 秒 blob URL
- L2-b: 5 秒 data URL
- 全局: 25 秒强制退出

---

### 日志诊断

**问题**：我想知道日志应该显示什么
**文档**：[QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md#日志解读指南)
**关键内容**：
- 成功识别的完整日志
- 降级到 L2 的日志
- 全部失败的日志

---

### UI 状态管理

**问题**：我想确保 UI 不会卡住
**文档**：[RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md#ui-状态管理)
**关键内容**：
- add.vue 快速识别的状态机制
- recognize/index.vue 完整识别的状态机制
- finally 块清理保证

---

### 错误处理

**问题**：我想知道所有可能的错误情况
**文档**：[RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md#错误处理矩阵)
**关键内容**：
- L1 失败 → L2
- 像素分析异常 → 返回空
- 品种识别异常 → 降级
- 全局超时 → 强制退出

---

### 代码修复

**问题**：我想知道修复了什么
**文档**：[REPAIR_SUMMARY.md](REPAIR_SUMMARY.md#修复清单)
**关键内容**：
- BUG #1: TDZ 访问（globalTimer）
- BUG #2: 重复代码块
- BUG #3: 日志增强

---

### 测试方法

**问题**：我想知道如何测试这个功能
**文档**：[QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md#5-个关键测试场景)
**关键内容**：
1. 正常识别（3 分钟）
2. 低质量降级（3 分钟）
3. 快速点击防护（2 分钟）
4. 超时强制退出（5 分钟）
5. 完整识别流程（5 分钟）

---

## 🔍 按文件分类

### pillCounter.ts (1559 行)

**文档引用**：
- [RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md#countpillsviawebapi) - 三级 Fallback
- [REPAIR_SUMMARY.md](REPAIR_SUMMARY.md#第二阶段关键-bug-修复3-个) - TDZ Bug 修复
- [FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md#4️⃣-状态管理与-ui-清理保证) - 超时保护

**关键函数**：
- countPillsApp (L868)
- countPillsViaWebAPI (L1122)
- countPillsH5WithOverlay (L633)

---

### imageStorage.ts (488 行)

**文档引用**：
- [REPAIR_SUMMARY.md](REPAIR_SUMMARY.md#bug-2重复代码块) - 重复代码修复
- [RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md#场景1addvue-快速识别) - 文件持久化流程

**关键函数**：
- persistImage (L74)
- fileToDataUrl (L114)

---

### recognize/index.vue (878 行)

**文档引用**：
- [RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md#场景2recognizeindexvue-完整识别) - 完整识别流程
- [REPAIR_SUMMARY.md](REPAIR_SUMMARY.md#bug-3saveimagetoPhotosalbum-静态徽章) - 日志增强
- [QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md#测试-5完整识别流程5-分钟) - 测试指南

**关键函数**：
- startAnalysis (L470)
- doUploadImage (L354)

---

### add.vue (1223 行)

**文档引用**：
- [RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md#场景1addvue-快速识别) - 快速识别流程
- [FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md#addvue-快速识别) - UI 状态管理
- [QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md#测试-1正常识别3-分钟) - 测试方法

**关键函数**：
- runPillDetection (L520)
- pickImage (L362)

---

### pillRecognizer.ts (673 行)

**文档引用**：
- [RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md#recognizepillsregions-medications) - 品种识别流程
- [FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md#b-品种识别流程) - 详细步骤

**关键函数**：
- recognizePills (L608)

---

## 💡 常见问题快速查阅

### 问题 1: "UI 卡在 '正在识别' 很久"

→ 文档：[QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md#现象-1显示-正在识别几秒后消失没有结果)

关键点：
- 正常：5-25 秒内完成
- 异常：> 30 秒无响应 → 检查 finally 块是否正确

---

### 问题 2: "日志太混乱，无法诊断"

→ 文档：[QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md#日志解读指南)

关键点：
- [L1] = 第 1 层
- [L2-a] = 第 2 层子选项 a
- [L2-b] = 第 2 层子选项 b
- [Recognize] = 识别相关

---

### 问题 3: "权限弹窗显示无法保存"

→ 文档：[QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md#现象-4权限弹窗显示-无法保存到相册)

关键点：
- 正常现象，点击"去设置"
- 启用相册权限后重试

---

### 问题 4: "如何确保没有 Bug"

→ 文档：[FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md#提交-apk-前检查清单)

关键步骤：
- [ ] npm run type-check 通过
- [ ] 5 个测试场景都成功
- [ ] 日志清晰无异常

---

### 问题 5: "修复了什么"

→ 文档：[REPAIR_SUMMARY.md](REPAIR_SUMMARY.md#修复清单)

关键内容：
- 14 个 TypeScript 错误
- 3 个运行时 Bug
- 52 行重复代码

---

## 🎯 按场景快速导航

### 场景 A：我要进行 APK 测试

**推荐阅读顺序**：
1. [QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md) - 5 分钟了解测试方法
2. [FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md) - 1 分钟了解检查清单
3. 执行测试，遇到问题查看[快速参考](QUICK_TEST_GUIDE.md#现象-1显示-正在识别几秒后消失没有结果)

**预期耗时**：15 分钟

---

### 场景 B：我要理解识别流程

**推荐阅读顺序**：
1. [RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md#整体流程架构) - 流程概览
2. [RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md#三级-fallback-架构) - 三级 Fallback
3. [RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md#错误处理矩阵) - 错误场景

**预期耗时**：30 分钟

---

### 场景 C：我要知道修复了什么

**推荐阅读顺序**：
1. [REPAIR_SUMMARY.md](REPAIR_SUMMARY.md#修复清单) - 快速清单
2. [REPAIR_SUMMARY.md](REPAIR_SUMMARY.md#修复前后对比) - 效果对比
3. 对应的详细文档了解具体细节

**预期耗时**：10 分钟

---

### 场景 D：遇到 Bug 需要诊断

**推荐阅读顺序**：
1. [QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md#常见现象及诊断) - 查看是否是已知现象
2. [QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md#日志解读指南) - 分析日志
3. [QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md#问题排查树) - 问题树诊断

**预期耗时**：5-15 分钟

---

## 📊 文档内容统计

| 文档 | 内容 | 用途 |
|-----|------|------|
| RECOGNITION_PIPELINE_VALIDATION.md | 9KB, 400+ 行 | 深度理解识别流程 |
| FINAL_VALIDATION_REPORT.md | 15KB, 600+ 行 | 完整验证清单 |
| QUICK_TEST_GUIDE.md | 12KB, 500+ 行 | APK 测试快速指南 |
| REPAIR_SUMMARY.md | 18KB, 700+ 行 | 修复内容总结 |
| 本文档 | 此文件 | 文档索引和导航 |

**总计**：52KB+ 的详细文档，覆盖所有问题和解答

---

## 🔗 直接链接速查

### 快速查看

- [三级 Fallback 图](RECOGNITION_PIPELINE_VALIDATION.md#三级-fallback-链)
- [超时链时间线](RECOGNITION_PIPELINE_VALIDATION.md#超时保护链防止-ui-卡顿)
- [成功日志示例](QUICK_TEST_GUIDE.md#成功识别的完整日志)
- [问题排查树](QUICK_TEST_GUIDE.md#问题排查树)

### 深度阅读

- [完整流程验证](RECOGNITION_PIPELINE_VALIDATION.md#详细流程链路)
- [代码修复详解](REPAIR_SUMMARY.md#第二阶段关键-bug-修复3-个)
- [测试检查清单](FINAL_VALIDATION_REPORT.md#合格标准)

### 参考资料

- [关键代码片段](REPAIR_SUMMARY.md#关键代码片段参考)
- [TypeScript 类型检查](FINAL_VALIDATION_REPORT.md#9️⃣-typescript-类型检查)
- [日志诊断参考](RECOGNITION_PIPELINE_VALIDATION.md#关键质量检查)

---

## ✅ 检查清单

在开始使用这些文档之前：

- [ ] 已经读过了 [快速概览](#按用途分类)
- [ ] 知道我的使用场景（测试/理解/修复/诊断）
- [ ] 已找到对应的文档入口点
- [ ] 准备好进行 APK 测试或代码审查

---

## 💬 文档使用建议

### 首次使用
- ✅ 从本文档开始（你现在就在做）
- ✅ 根据场景选择对应文档
- ✅ 快速浏览目录了解结构
- ✅ 按需深入阅读具体部分

### 反复查阅
- 🔖 将常用文档加书签
- 🔍 使用浏览器查找功能 (Ctrl+F)
- 📌 记住关键链接
- 💾 离线下载保留备份

### 团队分享
- 👥 新成员：推荐先读 [QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md)
- 🔧 维护者：推荐先读 [REPAIR_SUMMARY.md](REPAIR_SUMMARY.md)
- 🧪 测试：推荐先读 [FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md)
- 🎓 学习：推荐先读 [RECOGNITION_PIPELINE_VALIDATION.md](RECOGNITION_PIPELINE_VALIDATION.md)

---

## 🎯 下一步

1. **选择你的场景**（上面有 4 个选项）
2. **按推荐顺序阅读文档**
3. **根据文档指导进行操作**
4. **遇到问题查看快速参考**

---

**祝您使用愉快！** 📚✨

