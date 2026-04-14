# 🔍 APK 测试快速参考

> 测试前必读，15 分钟快速上手

---

## 📱 5 个关键测试场景

### ✅ 测试 1：正常识别（3 分钟）
```
步骤:
  1. App 打开 → 进入"添加药品"页面
  2. 点击"拍照" → 拍摄 3-5 片药片（正常光线，清晰）
  3. 点击"检测药片"
  4. 等待 5-10 秒

预期:
  ✓ "正在识别" 状态
  ✓ 进度显示（H5 会看到药片上的绿色轮廓）
  ✓ 完成后显示 "检测到 X 片"
  ✓ 或进入 recognize 页面，显示品种识别结果

日志看点:
  [L1] Image onload           ← Web API 成功
  [Recognize] 检测到: X 片
```

---

### ✅ 测试 2：低质量图片（3 分钟）
```
步骤:
  1. 拍摄模糊/暗色图片（不清晰）
  2. 点击"检测药片"
  3. 等待 10-15 秒

预期:
  ✓ 不会卡住（即使模糊也会响应）
  ✓ 显示 "未检测到药片" 或 "0 片"
  ✓ 日志可能显示降级到 L2

日志看点:
  [L1] timeout
  [L2-a] blob Image onerror
  [Recognize] 检测到: 0 片
```

---

### ✅ 测试 3：快速点击防护（2 分钟）
```
步骤:
  1. 拍照后，快速连续点击 3 次 "检测药片"
  
预期:
  ✓ 仅执行 1 次检测（后续点击被拒）
  ✓ 不会有重复的异步调用

日志看点:
  [PillDetect] 仅出现 1 次 "检测失败" 或 "检测完成"
```

---

### ✅ 测试 4：超时强制退出（5 分钟）
```
步骤:
  1. 断网（飞行模式）
  2. 拍照
  3. 点击"检测药片"
  4. 等待 25+ 秒

预期:
  ✓ 约 25 秒后自动退出
  ✓ 显示 "检测超时，请检查图片后重试"
  ✓ 可以继续正常操作（不卡）

日志看点:
  各层 timeout：
  [L1] timeout(8s)
  [L2-a] timeout(5s)
  [L2-b] timeout(5s)
  [PillDetect] 检测超时(25s)，强制结束
```

---

### ✅ 测试 5：完整识别流程（5 分钟）
```
步骤:
  1. 添加药品 → 拍照清晰的多色药片（3-10 片）
  2. 点击"检测药片" → 完成
  3. 然后进入 recognize 页面（或重新拍照）
  4. 完整的识别流程
  5. 看到品种分组结果
  6. 手动调整数量
  7. 点击"确认识别"保存

预期:
  ✓ 完整流程 10-20 秒完成
  ✓ 显示所有品种分组
  ✓ 可以增/减数量
  ✓ 保存成功

日志看点:
  [Recognize] App 端，使用 countPillsApp
  [Recognize] 检测到: X 片
  [Recognize] 品种识别完成: { count: Y, grouped: [...] }
```

---

## 🔧 常见现象及诊断

### 现象 1：显示 "正在识别"，几秒后消失，没有结果

**原因分析**：
```
可能的日志：
  [L1] timeout                    ← 网络慢或文件大
  [L2-a] blob Image onerror       ← blob URL 无效
  [L2-b] fail                     ← data URL 转换失败
  [L2 fallback] 所有加载方式均失败

解决**不是问题**）:
  ✓ 这是正常降级行为
  ✓ 返回空结果（count=0）
  ✓ UI 显示"未检测到药片"
  ✓ 后续可以重新拍照重试
```

**不正常的情况**：
- UI 一直显示 "正在识别" > 30 秒（应该在 25 秒强制退出）
  → 检查是否有死循环或超时未清理

---

### 现象 2：图片显示为 "已丢失" 但预览正常

**原因分析**：
```
可能原因：
  - fileToDataUrl 转换超时或失败
  - IndexedDB 取不到 blob（H5）

解决方法：
  ✓ 重新拍照
  ✓ 检查日志中是否有 "[L2-b] 文件读取失败"
  ✓ 这通常不影响识别，只影响显示
```

---

### 现象 3：检测出了 X 片，但没有品种识别结果

**原因分析**：
```
预期行为（不是 bug）:
  ✓ recognizePills 失败时降级
  ✓ 仍然显示检测数量
  ✓ 但不显示具体品种分组

检查日志：
  [Recognize] 品种识别失败: Error: ...
  [Recognize] 品种识别完成（降级为数量结果）
```

---

### 现象 4：权限弹窗显示 "无法保存到相册"

**原因分析**：
```
正常现象：
  ✓ 首次使用需要权限
  ✓ 点击"去设置"打开系统设置
  ✓ 启用相册权限后重试

日志标志：
  [Recognize] ⚠️ saveImageToPhotosAlbum fail: { errMsg: '...' }
```

---

### 现象 5：日志中出现警告（但功能正常）

**正常的警告**（不需要修复）：
```
[L2-a] blob Image 超时(5s)     ← 继续 L2-b，正常
[countPillsH5] 叠加层加载超时  ← 跳过绘制，返回结果，正常
[PillDetect] 检测失败: Error   ← catch 处理，已告知用户，正常
```

**异常的警告**（需要 debug）：
```
[globalTimer] 未定义           ← TDZ 问题（应该已修复）
[safeResolve] called twice      ← 竞态条件（应该已防护）
Multiple Promise resolve        ← resolve 被调用多次（bug）
```

---

## 📊 日志解读指南

### 成功识别的完整日志

```
[Recognize] App 端，使用 countPillsApp
[L1] 加载中...
[L1] Image onload
[L1] Canvas: 640x480
[L1] 分析完成
[Recognize] 检测到的药片数量: 5 regions: 5
[Recognize] 正在识别药片品种…
[Recognize] 品种识别完成: { totalCount: 5, grouped: [...] }
[Recognize] ✅ saveImageToPhotosAlbum success
UI 显示: "识别完成：5 片" toast
```

**时间线**：约 5-8 秒完成

---

### 降级到 L2 的日志

```
[L1] timeout...
[L2] 进入 fallback
[L2] getImageInfo success
[L2-a] blob Image onload
[L2-a] 分析完成: 800x600
[Recognize] 检测到的药片数量: 3 regions: 3
[Recognize] 品种识别失败: Error: ...
[Recognize] 品种识别完成（降级为数量结果）
```

**时间线**：约 13-18 秒完成

---

### 全部失败的日志

```
[L1] timeout
[L2] 进入 fallback
[L2] getImageInfo success
[L2-a] blob Image onerror
[L2-b] base64 Image onerror
[L2 fallback] 所有加载方式均失败
[Recognize] 检测到的药片数量: 0 regions: 0
[Recognize] 未检测到药片
```

**UI 提示**："未检测到药片"
**时间线**：约 18-20 秒完成

---

## 🎯 测试检查清单

使用此清单确保 APK 质量：

```
[ ] 正常识别
    - 拍清晰图片
    - 5-10 秒内显示结果
    - 日志中 [L1] onload

[ ] 低质质量降级
    - 拍模糊图片
    - 显示 "未检测" 或 0 片
    - 日志中可能有 [L1] timeout

[ ] 快速点击防护
    - 连续点击 "检测" 3 次
    - 仅执行 1 次
    - 日志无重复

[ ] 超时强制退出
    - 断网状态拍照检测
    - 25 秒后自动退出
    - 显示超时提示
    - UI 可继续操作

[ ] 完整品种识别
    - 拍多色药片
    - recognize 页面显示分组
    - 可手动调整
    - 保存成功

[ ] 权限处理
    - 首次拒绝权限
    - 点击"去设置"可导航
    - 重新授权后可保存

[ ] 日志清晰性
    - [L1], [L2-a], [L2-b] 有日志前缀
    - ✅/⚠️ 标记清晰
    - 没有 "undefined" 类错误

[ ] 无 TypeScript 错误
    - npm run type-check 通过
    - 编译生成 APK 成功
```

---

## 🚨 发现 bug 时的反馈清单

如果发现问题，请提供以下信息：

```
1. 复现步骤
   例: 拍照 → 点击"检测药片" → 等待 25s 无反应

2. 实际现象
   例: UI 一直显示 "正在检测…"，无法操作

3. 预期现象
   例: 应该在 25s 后显示超时提示

4. 控制台日志
   例: 贴出完整的 [L1], [L2-a], [Recognize] 等日志

5. 测试环境
   - 设备型号: iPhone 12 / Android 13 / ...
   - App 版本: v1.0.0
   - 网络: WiFi / 4G / ...

6. 图片信息
   - 清晰度: 清晰 / 模糊 / ...
   - 光线: 正常 / 暗 / ...
   - 药片数: 1-5 / 6-10 / ...
```

---

## 💡 快速 Debug 技巧

### 打开 DevTools 查看日志

**Android:**
```
1. 连接电脑 USB
2. adb logcat | grep -E "\[L[12]|Recognize|PillDetect"
3. 看日志输出
```

**iOS:**
```
1. Xcode 连接 iOS 设备
2. Console 面板打开
3. 看日志输出
```

**H5 浏览器:**
```
1. F12 打开 DevTools
2. Console 标签
3. 过滤 keyword: "[L1" 或 "[Recognize"
```

### 常用过滤关键词

```
搜索成功:     grep "[L1] onload"
搜索降级:     grep "timeout"
搜索错误:     grep "fail\|error\|Error"
搜索识别:     grep "\[Recognize\]"
搜索保存:     grep "saveImage"
搜索超时:     grep "超时"
```

---

## 📞 问题排查树

```
现象: UI 卡住显示 "正在识别"
  ├─ > 30 秒?
  │  └─ BUG: 全局超时未触发
  │     检查: add.vue#L533 setTimeout 是否正常
  │
  ├─ 10-25 秒?
  │  └─ 可能的原因:
  │     1. 网络慢 → 正常（自动降级）
  │     2. 图片大 → 正常（处理中）
  │     3. 手机卡顿 → 正常（等待中）
  │
  └─ < 10 秒?
     └─ 日志中有 [L1] onload
        → 正常识别进行中

现象: 日志中 "safeResolve called twice"
  └─ BUG: Promise 重复 resolve
     检查: pillCounter.ts#L917 globalTimer 声明位置

现象: 权限弹窗无法打开系统设置
  └─ 日志中有 ⚠️ saveImageToPhotosAlbum fail
     原因: 权限被拒 → 正常，需用户手动授权
     解决: 点击"去设置" → 启用权限 → 重试
```

---

## ✅ 合格标准

APK **测试通过**的标准：

- [x] 所有 5 个测试场景都能完成
- [x] 没有 UI 卡顿 (> 30s 的现象)
- [x] 所有错误都有提示 (toast 或日志)
- [x] 日志清晰，能诊断问题
- [x] TypeScript 无编译错误
- [x] 没有权限崩溃或内存泄漏

---

## 🎬 下一步

✅ **通过上述 5 个测试** → 准备提交应用商店

❌ **有问题无法排查** → 拍屏幕视频 + 日志，反馈给开发者

💾 **没有问题** → 生成 APK 正式版，准备发布

---

**祝测试顺利！** 🚀

