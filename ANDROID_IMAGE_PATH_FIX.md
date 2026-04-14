# Android 图片路径失效修复（v9）

## 问题分析

**现象**：Android 用户录入 5 种药品后，重启 APP（2-3 分钟后）药盒和药片的照片在 APP 中丢失，但手机相册中仍有照片存在。

**根因**：Android 上 `uni.saveFile()` 返回的 `savedFiles://` 路径在以下情况会失效：
- 某些 ROM 的缓存机制清理了临时文件
- App 版本升级导致存储目录变化  
- 系统存储空间不足触发的清理
- App 被彻底杀死后重启（状态时间过长）

**影响范围**：仅 Android 平台；H5 和 iOS 不受影响。

---

## 解决方案

### ✅ 已实施的修复

#### 1. **imageStorage.ts - 路径有效性验证函数**

新增导出函数 `verifyImagePath(imagePath: string)`：
```typescript
export function verifyImagePath(imagePath: string): Promise<string | null> {
  // 验证 Android savedFiles 路径是否仍有效
  // 如果文件存在，返回原路径
  // 如果文件不存在，返回 null
}
```

**工作原理**：
- 使用 `plus.io.resolveLocalFileSystemURL()` 检查文件是否存在
- 非 `savedFiles` 路径的立即返回（临时路径、data URL 等）
- 超时 5 秒后返回 null（防止卡死）

---

#### 2. **medication/add.vue - 编辑药品时检查路径**

在 `onLoad` 中添加验证逻辑：

```typescript
// ★ v9 新增：验证已保存的图片路径是否仍有效
const boxValid = await verifyImagePath(med.boxImageUri || '');
const pillValid = await verifyImagePath(med.pillImageUri || '');

// 如果路径无效，清除存储中的失效路径 ✓
form.value.boxImageUri = boxValid ? (med.boxImageUri || '') : '';
form.value.pillImageUri = pillValid ? (med.pillImageUri || '') : '';

// 如果有失效路径，提示用户 ✓
if ((!boxValid && med.boxImageUri) || (!pillValid && med.pillImageUri)) {
  uni.showModal({
    title: '图片已丢失',
    content: '检测到部分药品图片无法访问，请重新拍摄或从相册选取。',
  });
}
```

**用户体验**：
1. 打开药品编辑页面时，自动检查图片路径
2. 如果路径失效，展示友好提示
3. 用户可以选择重新拍摄或从相册选取
4. 失效路径会被清除，防止下次重复出现

---

### 🔄 建议的后续优化（v10）

#### 1. **药品列表显示失效标记**

在 `medication/list.vue` 中，对有失效图片的药品显示 ⚠️ 警告图标：

```typescript
// 检查药品图片是否有效
const hasInvalidImages = async (med) => {
  const boxValid = await verifyImagePath(med.boxImageUri || '');
  const pillValid = await verifyImagePath(med.pillImageUri || '');
  return !boxValid || !pillValid;
};
```

效果：
```
📦 感冒灵 ⚠️     ← 红色警告，表示图片已丢失
💊 维生素 B ✓    ← 绿色对勾，表示图片正常
```

---

#### 2. **自动备份到相册**

考虑在 `imageStorage.ts` 中添加可选的"自动备份到相册"功能：
- 保存到 `savedFiles` 的同时，也调用 `saveImageToPhotosAlbum`
- 这样用户即使 `savedFiles` 失效，仍可从相册恢复

```typescript
// 伪代码
async function persistImage(tempPath) {
  const savedPath = await uni.saveFile(tempPath);  // 方案一
  await saveImageToPhotosAlbum(tempPath);          // 方案二（备份）
  return savedPath;
}
```

**权衡**：
- ✅ 增加可靠性（双重备份）
- ❌ 用户相册会被照片填满（需要清理）
- ❌ 权限可能被拒绝（需要处理失败）

---

## 测试清单

### 验证修复效果
- [ ] 录入 5 种药品（包括拍摄药盒和药片照片）
- [ ] 关闭 APP 等待 2-3 分钟
- [ ] 重新打开 APP，进入药品编辑页面
- [ ] 验证：
  - ✅ 如果路径仍有效 → 图片正常显示
  - ✅ 如果路径失效 → 显示"图片已丢失"提示，用户可重新拍摄
  - ✅ 修改并保存药品后，重新进入不再出现失效路径

### 手动清理相册
- [ ] 手机相册中确实保存了所有拍摄的照片
- [ ] 可以手动删除相册中的过期照片

---

## 技术细节

### Android 文件路径格式

| 路径类型 | 示例 | 生命周期 | 备注 |
|---------|------|---------|------|
| 临时路径 | `/data/user/0/.../img_xxx.jpg` | 会话 | App 杀死后失效 |
| savedFiles | `_doc/xxx.jpg` | 持久 | 某些 ROM 会清理 ⚠️ |
| 相册路径 | `content://media/.../123` | 持久 | 最可靠（通过 Content Provider） |
| data URL | `data:image/jpeg;base64,...` | 临时 | 内存中，重启后丢失 |

---

## 日志示例

打开已保存的药品时，控制台输出：

```
[imageStorage] 路径有效: _doc/med_photos/photo_1712876543210.jpg
[add] 药品图片加载成功
```

或者（路径失效）：

```
[imageStorage] ★ 路径失效（文件不存在）: _doc/med_photos/photo_1712876543210.jpg
[add] 药盒图片路径已失效: _doc/med_photos/photo_1712876543210.jpg
[add] 图片已丢失 → 显示用户提示
```

---

## 总结

| 阶段 | 状态 | 内容 |
|------|------|------|
| **v9** ✅ | 已完成 | 路径有效性检查 + 用户提示 |
| **v10** 📋 | 建议 | 列表页面警告标记 + 自动备份方案 |
| **v11+** 💭 | 考虑 | 从相册自动恢复的智能机制 |

问题已经缓解，用户有清晰的提示和操作引导。后续可考虑实现更自动化的恢复机制。
