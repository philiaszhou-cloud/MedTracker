# 🔧 快速故障排除指南

> **遇到问题？快速定位和解决**

---

## 🚨 按现象快速诊断

### 现象 A：UI 显示 "正在识别"，但很久没反应

**可能原因分析**：

| 情况 | 时间 | 可能原因 | 解决方案 |
|-----|------|---------|--------|
| 仍在识别 | < 25s | 正常处理中 | 继续等待 |
| 已卡住 | 25-30s | finally 块未清理 | 检查 pillCounter.ts#917 |
| 永久卡死 | > 30s | globalTimer TDZ 问题 | 检查全局超时初始化 |

**快速检查**：
```bash
# 查看日志
adb logcat | grep "正在识别\|timeout\|已完成"

# 应该看到:
# [Recognize] 正在检测药片数量…
# [L1] Image onload
# [Recognize] 检测到的药片数量: X
# 或者
# [L1] timeout
# [L2] 进入 fallback
```

**修复代码位置**：
- [add.vue#L591-593](../src/pages/medication/add.vue#L591-L593) - finally 块清理

---

### 现象 B：日志中出现 "undefined" 或 "Cannot read property"

**可能原因分析**：

```
错误类型                    可能位置              解决方案
─────────────────────────────────────────────────────
Cannot read globalTimer     pillCounter#917       检查声明顺序
Cannot read resolvedUrl     detail.vue#xxx        检查 null 检查
Cannot read plus            recognize#395         添加 typeof 检查
safeResolve called twice    pillCounter#925       检查 resolved 标记
```

**快速检查**：
```bash
# 搜索关键错误
grep -r "Cannot read\|undefined\|null" console.log

# 检查声明顺序
grep -B5 "const safeResolve" pillCounter.ts
# 应该看到 globalTimer 在 safeResolve 之前声明
```

**修复代码位置**：
- [pillCounter.ts#917](../src/utils/pillCounter.ts#L917) - globalTimer 声明位置

---

### 现象 C：识别了数量，但没有品种识别结果

**正常情况（不是 bug）**：

```
场景: recognizePills() 异常或返回为空
结果: 降级处理，仅显示检测数量
日志: [Recognize] 品种识别失败: Error: ...

这是设计的，不影响使用
```

**如果需要诊断**：
```bash
# 查看 recognizePills 日志
grep "品种识别\|recognizePills" console.log

# 可能的原因:
# 1. 没有药品库数据
# 2. 颜色匹配失败
# 3. 异常被捕获
```

**验证代码位置**：
- [recognize/index.vue#530-532](../src/pages/recognize/index.vue#L530-L532) - 降级处理

---

### 现象 D：权限弹窗显示 "无法保存到相册"

**正常流程**：

```
1. 首次点击 "检测药片" 时出现权限弹窗
2. 用户点击 "拒绝" → 显示"无法保存到相册"
3. 用户点击 "去设置" → 打开系统设置
4. 用户在设置中启用相册权限
5. 返回 App，重新点击"检测" → 正常保存
```

**诊断日志**：
```
[Recognize] ⚠️ saveImageToPhotosAlbum fail: { errMsg: '...' }
```

**解决方案**：
1. 检查手机是否真的启用了相册权限
2. 重新启动 App
3. 再试一次

**代码位置**：
- [recognize/index.vue#393-421](../src/pages/recognize/index.vue#L393-L421) - 权限处理

---

### 现象 E：日志显示 [L1] timeout，没有识别结果

**可能原因**：

```
原因                    表现                    下一步
─────────────────────────────────────────────────────
网络慢                  [L1] timeout            继续看 [L2] 日志
图片太大                等待中...               可能需要 15-20s
手机卡顿                反应缓慢                正常（App 处理中）
文件访问权限            [L2] fail               检查权限设置
```

**诊断**：

```bash
# 检查是否进入 Level 2
grep -A5 "L1.*timeout" console.log

# 应该看到:
# [L1] timeout
# [L2] 进入 fallback
# [L2-a] blob Image onload   ← 成功或 fail
# 或
# [L2-b] base64 分析完成      ← 成功
```

**期望时间线**：
- L1 超时: 8 秒
- L2-a 处理: 5 秒（共 13 秒）
- L2-b 处理: 5 秒（共 18 秒）
- 全局超时: 25 秒

**解决方案**：
- 等待到 25 秒，看是否返回结果
- 如果返回空结果，说明全部失败（正常，重新拍照）
- 如果超过 25 秒还没反应，检查 finally 块是否清理

---

### 现象 F：识别出了 5 片，但点击 "确认识别" 后没有保存

**可能原因**：

```
原因                    检查位置
─────────────────────────────────
保存数据库失败          检查 Pinia store
用户没有确认点击        检查 UI 反馈
识别结果为空            检查 recognitionResult
品种匹配有问题          检查 recognizePills 日志
```

**诊断**：

```bash
# 检查保存日志
grep "保存\|save\|store" console.log

# 检查识别结果
grep "recognitionResult\|pills" console.log

# 应该看到品种分组信息
```

**解决方案**：
1. 检查控制台是否有错误
2. 查看 Pinia store 中的 medications 是否已更新
3. 手动检查数据库文件

**代码位置**：
- [recognize/index.vue](../src/pages/recognize/index.vue) - 保存逻辑

---

## 🔍 日志诊断表

### 正常识别的日志模式

```
✅ 这是成功的日志
═════════════════════════════════════════

[Recognize] App 端，使用 countPillsApp
[L1] 加载中...
[L1] Image onload
[L1] Canvas: 640x480
[L1] 分析完成
[Recognize] 检测到的药片数量: 5 regions: 5
[Recognize] 正在识别药片品种…
[Recognize] 品种识别完成: {
  pills: [...],
  grouped: [
    { medicationId: 'abc', medicationName: '阿司匹林', count: 3 }
  ],
  totalCount: 5,
  message: "共 5 片，其中 3 片已识别"
}
[Recognize] ✅ saveImageToPhotosAlbum success

📊 时间: 8 秒
✅ 状态: 完成，可保存
```

### 降级识别的日志模式

```
⚠️  降级处理日志
═════════════════════════════════════════

[Recognize] App 端，使用 countPillsApp
[L1] timeout
[L2] 进入 fallback
[L2] getImageInfo success
[L2-a] blob Image onerror
[L2-b] base64 分析完成: 800x600
[L1] 分析完成
[Recognize] 检测到的药片数量: 3 regions: 3
[Recognize] 正在识别药片品种…
[Recognize] 品种识别失败: Error: ...
[Recognize] 品种识别完成（降级为数量结果）

📊 时间: 18 秒
⚠️  状态: 有结果但无品种识别

→ 这是正常的，仍可使用
```

### 完全失败的日志模式

```
❌ 失败日志
═════════════════════════════════════════

[Recognize] App 端，使用 countPillsApp
[L1] timeout
[L2] 进入 fallback
[L2] getImageInfo success
[L2-a] blob Image onerror
[L2-b] base64 Image onerror
[L2 fallback] 所有加载方式均失败
[Recognize] 检测到的药片数量: 0 regions: 0
[Recognize] 未检测到药片

📊 时间: 18 秒
❌ 状态: 无结果

→ 提示用户: "未检测到药片"，可以重新拍照
```

---

## 🛠️ 常见修复方案

### 问题 1：超时永不清理（UI 永久卡住）

**症状**：UI 显示 "正在识别" > 30 秒

**根本原因**：finally 块未执行或 flag 未清理

**修复**：

```typescript
// 位置: add.vue#L520-595

async function runPillDetection() {
  pillDetecting.value = true;
  
  const timeoutId = setTimeout(() => {
    if (pillDetecting.value) {
      pillDetecting.value = false;  // ⭐ 强制清理
    }
  }, 25000);
  
  try {
    // ... 识别逻辑 ...
  } catch (e) {
    // ... 错误处理 ...
  } finally {
    clearTimeout(timeoutId);         // ⭐ 必须清理
    pillDetecting.value = false;     // ⭐ 必须为 false
  }
}
```

**验证**：
```bash
npm run type-check  # 应该通过
# 测试: 识别后 UI 应该恢复
```

---

### 问题 2：globalTimer 未定义（TDZ 错误）

**症状**：
```
Cannot read 'clearTimeout' of undefined
或
ReferenceError: globalTimer is not defined
```

**根本原因**：globalTimer 在 safeResolve 之后声明

**修复**：

```typescript
// 位置: pillCounter.ts#L917-925

// ❌ 错误的顺序
const safeResolve = (result) => {
  clearTimeout(globalTimer);  // ❌ globalTimer 未声明
};
let globalTimer: ReturnType<typeof setTimeout>;  // 声明在后

// ✅ 正确的顺序
let globalTimer: ReturnType<typeof setTimeout>;  // 先声明
const safeResolve = (result) => {
  clearTimeout(globalTimer);  // ✅ 可以访问
};
globalTimer = setTimeout(() => {...});  // 赋值（不是声明）
```

**验证**：
```bash
npm run type-check  # 应该无错误
grep "let globalTimer" pillCounter.ts | head -1
grep "const safeResolve" pillCounter.ts | head -1
# globalTimer 应该在 safeResolve 前面
```

---

### 问题 3：识别结果为空（降级处理）

**症状**：检测到了数量，但没有品种识别

**可能原因**：
1. recognizePills 异常 → 正常，降级处理
2. 没有药品库数据 → 正常，无法匹配
3. 颜色匹配失败 → 正常，返回 count=0

**检查代码**：

```typescript
// 位置: recognize/index.vue#L523-532

try {
  const result = await recognizePills(count.regions, medications.value);
  recognitionResult.value = result;
} catch (e) {
  console.error('[Recognize] 品种识别失败:', e);
  // 降级：仅显示数量，不显示品种
  recognitionResult.value = null;
  displayTotalCount.value = count.count;  // ← 仍然显示数量
}
```

**验证**：
- [ ] 检测结果 count.count > 0
- [ ] recognitionResult.value 为 null
- [ ] 仍然显示数量
- [ ] 这是正常的降级处理

---

### 问题 4：权限问题导致无法保存

**症状**：显示 "无法保存到相册"

**修复**：

```typescript
// 位置: recognize/index.vue#L383-421

fail: (err) => {
  console.warn('[Recognize] ⚠️ saveImageToPhotosAlbum fail:', err);
  savedToAlbum.value = false;
  
  // 显示权限引导
  uni.showModal({
    title: '无法保存到相册',
    content: '请在系统设置中允许访问相册',
    confirmText: '去设置',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        // 打开系统设置...
      }
    },
  });
}
```

**用户操作**：
1. 点击"去设置"
2. 在系统设置中找到 "相册" 权限
3. 启用权限
4. 返回 App
5. 重试识别

---

### 问题 5：日志太乱，无法诊断

**症状**：日志充满了 console.log，找不到关键信息

**修复**：

```bash
# 删除或注释掉无关的 console.log

# 保留这些:
✅ console.error()   - 错误诊断
✅ console.warn()    - 警告诊断
✅ [L1], [L2-a], [Recognize] 前缀的日志

# 删除这些:
❌ console.log('temp debug')
❌ console.log('processing...')
❌ console.log(largeObject)  # 打印大对象
```

**验证**：
```bash
grep "console.log" src/**/*.{ts,vue} | wc -l
# 应该很少（< 20 行）

grep "console.error\|console.warn" src/**/*.{ts,vue} | wc -l
# 应该正常（> 50 行）
```

---

## 📊 问题速查表

| 症状 | 可能原因 | 检查位置 | 修复方案 |
|-----|---------|---------|--------|
| UI 卡住 > 30s | finally 未清理 | add.vue#591 | 确保 pillDetecting = false |
| TypeError: globalTimer | TDZ 访问 | pillCounter#917 | 声明顺序 |
| 无品种结果 | recognizePills 异常 | recognize#530 | 正常降级 |
| 权限拒绝 | 用户未授权 | recognize#393 | 打开设置 |
| 日志混乱 | 调试日志未清理 | src/**/*.ts | 注释无关日志 |
| 网络超时 | 网络慢或文件大 | pillCounter#1130 | 等待降级 |
| 识别失败 | 图片质量差 | pillCounter#1400 | 重新拍照 |

---

## 🎯 5 分钟快速修复指南

### 情况 1：紧急发布，有 bug 需要快速修复

```
1. 定位问题（2 分钟）
   → 查看日志，找出关键词
   → 在本指南中搜索症状
   → 找到对应的修复代码位置

2. 应用修复（2 分钟）
   → 打开指定文件
   → 复制修复代码
   → 替换旧代码

3. 验证（1 分钟）
   → npm run type-check
   → 快速测试一遍
   → 确认修复有效
```

### 情况 2：已有现有代码，需要改进

```
使用代码模板快速改进：
→ [REPAIR_SUMMARY.md](REPAIR_SUMMARY.md#关键代码片段参考)

模板包括：
1. 超时保护模板
2. 三级 Fallback 模板
3. UI 状态清理模板
```

---

## 💡 诊断技巧

### 技巧 1：快速过滤日志

```bash
# 只看识别相关日志
adb logcat | grep "\[L[12]\|\[Recognize\]"

# 只看错误
adb logcat | grep "ERROR\|error\|Error"

# 只看超时
adb logcat | grep "timeout\|超时"

# 只看特定前缀
adb logcat | grep "^\[.*\]"
```

### 技巧 2：保存日志到文件

```bash
# 开始记录
adb logcat > app.log

# 执行测试，然后 Ctrl+C 停止

# 分析
grep "\[L1\]" app.log
grep "timeout" app.log
```

### 技巧 3：实时日志监控

```bash
# 打开 2 个终端

# 终端 1: 查看日志
adb logcat

# 终端 2: 执行命令
adb shell

# 或使用过滤
adb logcat | grep -E "时间戳|关键词"
```

---

## ✅ 修复检查清单

修复每个问题后，确认：

```
[ ] 代码修改已保存
[ ] npm run type-check 通过
[ ] 相关测试已运行
[ ] 日志输出正确
[ ] UI 状态正常
[ ] 没有新的错误出现
```

---

## 📞 无法自行修复？

如果按照本指南仍无法解决：

1. **收集完整信息**
   ```
   - 确切的错误信息
   - 完整的日志输出
   - 复现步骤
   - 设备信息（型号、系统版本）
   - App 版本号
   ```

2. **查阅详细文档**
   - [RECOGNITION_PIPELINE_VALIDATION.md](../RECOGNITION_PIPELINE_VALIDATION.md)
   - [REPAIR_SUMMARY.md](../REPAIR_SUMMARY.md)
   - [QUICK_TEST_GUIDE.md](../QUICK_TEST_GUIDE.md)

3. **提交问题**
   - 描述现象
   - 提供日志
   - 提供复现步骤
   - 等待反馈

---

**记住：大多数问题都有日志线索，仔细看日志是快速诊断的关键！** 🔍

