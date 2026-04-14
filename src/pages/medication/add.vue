<template>
  <view class="add-med-page">
    <view class="container">

      <!-- ① 用药类型切换 -->
      <view class="card">
        <text class="card-title">用药类型 *</text>
        <view class="type-toggle">
          <view
            class="type-btn"
            :class="{ active: form.medicationType === 'daily' }"
            @tap="form.medicationType = 'daily'"
          >
            <text class="type-icon">●</text>
            <text class="type-label">日常用药</text>
            <text class="type-desc">长期规律服用</text>
          </view>
          <view
            class="type-btn"
            :class="{ active: form.medicationType === 'temporary' }"
            @tap="form.medicationType = 'temporary'"
          >
            <text class="type-icon">⚡</text>
            <text class="type-label">临时用药</text>
            <text class="type-desc">短期按需服用</text>
          </view>
        </view>
      </view>

      <!-- ② 药品照片（必填） -->
      <view class="card">
        <text class="card-title">药品照片 *</text>
        <text class="card-sub">请分别拍摄药盒和药片，有助于识别和区分</text>

        <view class="photo-row">
          <!-- 药盒照片 -->
          <view class="photo-slot" @tap="pickImage('box')">
            <view v-if="boxDisplayUrl" class="photo-preview">
              <image :src="boxDisplayUrl" mode="aspectFill" class="preview-img" />
              <view class="photo-change-mask">
                <text class="photo-change-text">重新拍摄</text>
              </view>
            </view>
            <view v-else class="photo-placeholder">
              <text class="photo-icon">◻</text>
              <text class="photo-hint">药盒照片</text>
              <text class="photo-hint-sub">必填</text>
            </view>
          </view>

          <!-- 药片照片 -->
          <view class="photo-slot" @tap="pickImage('pill')">
            <view v-if="pillDisplayUrl" class="photo-preview">
              <!-- 检测模式：显示带轮廓的 Canvas -->
              <canvas
                v-if="pillDetected && pillCanvasReady"
                canvas-id="pill-canvas"
                id="pill-canvas"
                class="pill-canvas"
                :style="{ width: canvasDisplayWidth + 'rpx', height: canvasDisplayHeight + 'rpx' }"
              />
              <!-- 普通模式：显示原图 -->
              <image v-else :src="pillDisplayUrl" mode="aspectFill" class="preview-img" />
              <view class="photo-change-mask">
                <text class="photo-change-text">重新拍摄</text>
              </view>
              <!-- 检测结果标签 -->
              <view v-if="pillDetected" class="pill-detect-badge">
                <text class="detect-badge-text">✓ {{ pillDetectCount }} 片</text>
              </view>
            </view>
            <view v-else class="photo-placeholder">
              <text class="photo-icon">●</text>
              <text class="photo-hint">药片照片</text>
              <text class="photo-hint-sub">必填</text>
            </view>
          </view>
        </view>

        <!-- 药片识别操作区 -->
        <view v-if="pillDisplayUrl" class="pill-detect-section">
          <view class="detect-action-row">
            <view class="detect-btn" @tap="runPillDetection">
              <text class="detect-btn-text">{{ pillDetecting ? '识别中...' : '∇ 识别药片轮廓' }}</text>
            </view>
            <view v-if="pillDetected" class="detect-btn detect-btn-reset" @tap="resetPillDetection">
              <text class="detect-btn-text">显示原图</text>
            </view>
          </view>
        </view>

        <!-- 离屏检测 Canvas：App 端原生 canvas 方案专用，不可见 -->
        <canvas canvas-id="pill-detect-canvas"
          style="position: fixed; left: -9999px; top: -9999px; width: 640px; height: 640px;"
        />
      </view>

      <!-- ③ 药品基本信息 -->
      <view class="card">
        <text class="card-title">药品信息</text>

        <!-- 药品名称 -->
        <view class="form-group">
          <text class="form-label">药品名称 *</text>
          <input
            class="form-input"
            :class="{ 'form-input-focus': focusField === 'name' }"
            :value="form.name"
            @input="form.name = ($event.detail as any).value"
            @focus="focusField = 'name'"
            @blur="focusField = ''"
            placeholder="如：阿莫西林胶囊"
            placeholder-style="color: #BBB; font-size: 34rpx;"
            confirm-type="next"
          />
        </view>

        <!-- 规格 -->
        <view class="form-group">
          <text class="form-label">品牌</text>
          <input
            class="form-input"
            :class="{ 'form-input-focus': focusField === 'brand' }"
            :value="form.brand"
            @input="form.brand = ($event.detail as any).value"
            @focus="focusField = 'brand'"
            @blur="focusField = ''"
            placeholder="如：同仁堂、拜耳"
            placeholder-style="color: #BBB; font-size: 34rpx;"
            confirm-type="next"
          />
        </view>

        <!-- 规格 -->
        <view class="form-group">
          <text class="form-label">规格</text>
          <input
            class="form-input"
            :class="{ 'form-input-focus': focusField === 'spec' }"
            :value="form.specification"
            @input="form.specification = ($event.detail as any).value"
            @focus="focusField = 'spec'"
            @blur="focusField = ''"
            placeholder="如：0.25g × 24粒"
            placeholder-style="color: #BBB; font-size: 34rpx;"
            confirm-type="next"
          />
        </view>

        <!-- 单次剂量 -->
        <view class="form-group">
          <text class="form-label">每次服用 *</text>
          <view class="dosage-row">
            <input
              class="form-input dosage-input"
              :class="{ 'form-input-focus': focusField === 'dosage' }"
              type="digit"
              :value="form.dosage"
              @input="form.dosage = ($event.detail as any).value"
              @focus="focusField = 'dosage'"
              @blur="focusField = ''"
              placeholder="数量"
              placeholder-style="color: #BBB; font-size: 34rpx;"
              confirm-type="next"
            />
            <text class="dosage-unit">片</text>
          </view>
        </view>

        <!-- 保质期（必填） -->
        <view class="form-group">
          <text class="form-label">保质期 *</text>
          <view class="expiry-row" @tap="showExpiryPicker">
            <text class="expiry-value" :class="{ placeholder: !form.expiryDate }">
              {{ form.expiryDate ? formatExpiry(form.expiryDate) : '选择截止年月' }}
            </text>
            <text class="expiry-icon">📅</text>
          </view>
          <text v-if="isExpired" class="expiry-warning">⚠️ 此药品已过期，请谨慎使用</text>
          <text v-else-if="isExpiringSoon" class="expiry-notice">即将到期（3个月内），请注意补充</text>
        </view>
      </view>

      <!-- ④ 用药频率 -->
      <view class="card">
        <text class="card-title">用药频率</text>

        <view class="frequency-grid">
          <view
            v-for="(item, idx) in frequencyOptions"
            :key="idx"
            class="freq-option"
            :class="{ active: form.frequency === item.value }"
            @tap="selectFrequency(item.value as FrequencyType)"
          >
            <text class="freq-text">{{ item.label }}</text>
          </view>
        </view>

        <view v-if="form.frequency === 'custom'" class="form-group mt-20">
          <input
            class="form-input"
            :class="{ 'form-input-focus': focusField === 'custom' }"
            :value="form.customFrequency"
            @input="form.customFrequency = ($event.detail as any).value"
            @focus="focusField = 'custom'"
            @blur="focusField = ''"
            placeholder="请描述用药频率，如：每周三次"
            placeholder-style="color: #BBB; font-size: 34rpx;"
            confirm-type="done"
          />
        </view>
      </view>

      <!-- ⑤ 提醒时间 -->
      <view class="card">
        <text class="card-title">提醒时间</text>
        <text class="text-muted text-small mb-20">设置每天的服药提醒时间</text>

        <view class="reminder-list">
          <view v-for="(time, index) in form.reminders" :key="index" class="reminder-row">
            <view class="time-picker" @tap="pickTime(index)">
              <text class="time-display">{{ time || '选择时间' }}</text>
              <text class="time-icon">🕐</text>
            </view>
            <view class="btn-remove" @tap="removeReminder(index)">
              <text class="remove-icon">✕</text>
            </view>
          </view>
        </view>

        <view class="add-time-btn" @tap="addReminder">
          <text>+ 添加提醒时间</text>
        </view>
      </view>

      <!-- ⑥ 库存 & 备注 -->
      <view class="card">
        <text class="card-title">库存信息</text>

        <view class="form-group">
          <text class="form-label">当前库存（片）*</text>
          <input
            class="form-input"
            :class="{ 'form-input-focus': focusField === 'stock' }"
            type="digit"
            :value="form.stockCount"
            @input="form.stockCount = ($event.detail as any).value"
            @focus="focusField = 'stock'"
            @blur="focusField = ''"
            placeholder="请输入当前药片数量"
            placeholder-style="color: #BBB; font-size: 34rpx;"
            confirm-type="done"
          />
        </view>

        <view class="form-group">
          <text class="form-label">备注</text>
          <textarea
            class="form-input form-textarea"
            :value="form.notes"
            @input="form.notes = ($event.detail as any).value"
            placeholder="可选：记录特殊说明、医嘱等"
            placeholder-style="color: #BBB; font-size: 34rpx;"
            :maxlength="200"
          />
        </view>
      </view>

      <!-- 保存按钮 -->
      <view class="save-area">
        <view class="btn-primary" @tap="saveMedication">
          <text>{{ isEditMode ? '保存修改' : '添加药品' }}</text>
        </view>
      </view>

    </view>

    <!-- 保质期选择器 -->
    <view v-if="showPicker" class="picker-mask" @tap.self="showPicker = false">
      <view class="picker-panel">
        <view class="picker-header">
          <text class="picker-cancel" @tap="showPicker = false">取消</text>
          <text class="picker-title">选择保质期</text>
          <text class="picker-confirm" @tap="confirmExpiry">确定</text>
        </view>
        <picker-view
          class="picker-view"
          :value="pickerValue"
          @change="onPickerChange"
        >
          <picker-view-column>
            <view v-for="y in yearList" :key="y" class="picker-item">{{ y }}年</view>
          </picker-view-column>
          <picker-view-column>
            <view v-for="m in monthList" :key="m" class="picker-item">{{ m }}月</view>
          </picker-view-column>
        </picker-view>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, getCurrentInstance } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useMedStore } from '../../stores/index';
import { DEFAULT_REMINDER_TIMES } from '../../types';
import type { FrequencyType, MedicationType } from '../../types';
import { persistImage, loadImageFromStorage, resolveDisplayUrl, fileToDataUrl, verifyImagePath, isPersistentImagePath } from '../../utils/imageStorage';
import { countPillsH5WithOverlay, countPillsApp } from '../../utils/pillCounter';
import type { PillRegion, CountResult } from '../../utils/pillCounter';

const store = useMedStore();

// ─── 聚焦状态（App 端高亮边框用）───
const focusField = ref('');

// ─── 编辑模式 ───
const editId = ref('');
const isEditMode = ref(false);

// ─── 图片显示 URL（与 form 中的持久化 key 分离）───
// form.boxImageUri / form.pillImageUri 存持久化 key（idb:// 或 savedFiles 路径）
// boxDisplayUrl / pillDisplayUrl 存可直接用于 <image :src> 的 URL
const boxDisplayUrl = ref('');
const pillDisplayUrl = ref('');

// ─── 图片持久化状态标记 ───
const isPersistingImages = ref(false);

// ─── 表单数据 ───
const form = ref({
  medicationType: 'daily' as MedicationType,
  boxImageUri: '',
  pillImageUri: '',
  name: '',
  brand: '',
  specification: '',
  dosage: '1',
  expiryDate: '', // 格式 "YYYY-MM"
  frequency: 'once_daily' as FrequencyType,
  customFrequency: '',
  reminders: ['08:00'] as string[],
  stockCount: '',
  notes: '',
  imageUri: '',
});

// ─── 频率选项 ───
const frequencyOptions = [
  { label: '每日1次', value: 'once_daily' },
  { label: '每日2次', value: 'twice_daily' },
  { label: '每日3次', value: 'thrice_daily' },
  { label: '隔日1次', value: 'every_other_day' },
  { label: '每周1次', value: 'weekly' },
  { label: '自定义', value: 'custom' },
];

// ─── 保质期相关 ───
const showPicker = ref(false);
const currentYear = new Date().getFullYear();
const yearList = Array.from({ length: 15 }, (_, i) => currentYear + i - 1); // 前1年到后13年
const monthList = Array.from({ length: 12 }, (_, i) => i + 1);

// pickerValue: [yearIndex, monthIndex]
const pickerValue = ref([1, new Date().getMonth()]); // 默认当前年月
const tempPicker = ref([1, new Date().getMonth()]);

const isExpired = computed(() => {
  if (!form.value.expiryDate) return false;
  const [y, m] = form.value.expiryDate.split('-').map(Number);
  const expiry = new Date(y, m - 1, 1); // 月初
  const now = new Date();
  now.setDate(1); now.setHours(0, 0, 0, 0);
  return expiry < now;
});

const isExpiringSoon = computed(() => {
  if (!form.value.expiryDate || isExpired.value) return false;
  const [y, m] = form.value.expiryDate.split('-').map(Number);
  const expiry = new Date(y, m - 1, 1);
  const soon = new Date();
  soon.setMonth(soon.getMonth() + 3);
  return expiry <= soon;
});

function showExpiryPicker() {
  // 初始化 picker 到已选值或当前月
  if (form.value.expiryDate) {
    const [y, m] = form.value.expiryDate.split('-').map(Number);
    const yIdx = yearList.indexOf(y);
    pickerValue.value = [yIdx >= 0 ? yIdx : 1, m - 1];
  }
  tempPicker.value = [...pickerValue.value];
  showPicker.value = true;
}

function onPickerChange(e: any) {
  tempPicker.value = e.detail.value;
}

function confirmExpiry() {
  pickerValue.value = [...tempPicker.value];
  const y = yearList[tempPicker.value[0]];
  const m = monthList[tempPicker.value[1]];
  form.value.expiryDate = `${y}-${String(m).padStart(2, '0')}`;
  showPicker.value = false;
}

function formatExpiry(val: string): string {
  if (!val) return '';
  const [y, m] = val.split('-');
  return `${y}年${parseInt(m)}月`;
}

// ─── 图片选择 ───
function pickImage(target: 'box' | 'pill') {
  uni.showActionSheet({
    itemList: ['拍照', '从相册选择'],
    success: (actionRes) => {
      const sourceType = actionRes.tapIndex === 0 ? 'camera' : 'album';
      pickImageFromSource(target, sourceType);
    },
  });
}

function setImagePreview(target: 'box' | 'pill', previewUrl: string) {
  if (target === 'box') {
    boxDisplayUrl.value = previewUrl;
  } else {
    pillDisplayUrl.value = previewUrl;
    resetPillDetection();
  }
}

function setImageStoragePath(target: 'box' | 'pill', storedPath: string) {
  if (target === 'box') {
    form.value.boxImageUri = storedPath;
  } else {
    form.value.pillImageUri = storedPath;
  }
}

function clearImageSelection(target: 'box' | 'pill') {
  setImageStoragePath(target, '');
  setImagePreview(target, '');
}

function pickImageFromSource(target: 'box' | 'pill', sourceType: 'camera' | 'album') {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: [sourceType],
    success: async (res) => {
      const tempPath = res.tempFilePaths[0];
      if (!tempPath) return;

      // 1. 先把当前选择的路径保存在表单中，供保存时二次持久化兜底
      setImageStoragePath(target, tempPath);
      setImagePreview(target, tempPath);

      // 2. 仅拍照场景才回存系统相册，避免从相册选图时产生重复照片
      if (sourceType === 'camera') {
        try {
          await new Promise<void>((resolve) => {
            uni.saveImageToPhotosAlbum({
              filePath: tempPath,
              success: () => {
                resolve();
              },
              fail: () => {
                resolve();
              },
            });
          });
        } catch (e) {
          console.error('[AddMed] 保存到相册异常:', e);
        }
      }

      // 3. 异步处理图片转换和持久化，不阻塞UI
      // ★ v12 修复：先持久化获取稳定路径，再转换为 data URL 仅用于显示
      // 根因：之前将 base64 data URL 直接存入 form → setStorageSync 时超限导致静默丢失
      isPersistingImages.value = true;
      (async () => {
        try {
          // ── Step 1：先持久化到磁盘（必须在 data URL 转换之前）
          // 原因：isAlreadyPersisted("data:image...") 返回 true 会跳过持久化，
          //       所以必须用原始 tempPath 持久化
          const persistStartTime = performance.now();
          const persistedPath = await persistImage(tempPath);
          const persistTime = performance.now() - persistStartTime;

          let finalStoragePath = persistedPath || tempPath;
          console.log(`[pickImage] 图片持久化完成 (${persistTime.toFixed(0)}ms): target=${target}, finalPath=${finalStoragePath.substring(0, 80)}`);

          if (!isPersistentImagePath(finalStoragePath)) {
            console.warn('[pickImage] 当前仍是临时路径，保存药品时将再次尝试持久化:', finalStoragePath);
            return;
          }

          // ── Step 2：仅将持久化路径存入 form（不存 base64！）
          // 这样 setStorageSync 只存储短路径字符串，不会超出容量上限
          // #ifdef H5
          if (target === 'box') {
            setImageStoragePath(target, finalStoragePath);
            const resolvedUrl = await resolveDisplayUrl(finalStoragePath);
            if (resolvedUrl) boxDisplayUrl.value = resolvedUrl;
          } else {
            setImageStoragePath(target, finalStoragePath);
            const resolvedUrl = await resolveDisplayUrl(finalStoragePath);
            if (resolvedUrl) pillDisplayUrl.value = resolvedUrl;
          }
          // #endif

          // #ifndef H5
          // App 端：持久化路径用于存储，data URL 仅用于即时显示
          let displayUrl = finalStoragePath;
          // #ifdef APP-PLUS
          // 将持久化路径转为 data URL 以便 <image> 可靠渲染
          // （某些 Android ROM 的 <image :src="savedFilePath"> 会黑屏）
          try {
            const dataUrl = await fileToDataUrl(finalStoragePath);
            if (dataUrl) {
              displayUrl = dataUrl;
            } else {
              console.warn('[pickImage] fileToDataUrl 失败，使用持久化路径显示');
            }
          } catch (e) {
            console.warn('[pickImage] data URL 转换异常:', e);
          }
          // #endif

          if (target === 'box') {
            boxDisplayUrl.value = displayUrl;
            setImageStoragePath(target, finalStoragePath); // ★ 存储 path，不是 data URL
          } else {
            pillDisplayUrl.value = displayUrl;
            setImageStoragePath(target, finalStoragePath); // ★ 存储 path，不是 data URL
          }
          // #endif
        } catch (e) {
          console.error('[pickImage] 处理异常:', e);
          // 不清空用户已选图片，保存时再做一次持久化兜底
        } finally {
          isPersistingImages.value = false;
        }
      })();
    },
  });
}

async function ensurePersistentImageForSave(target: 'box' | 'pill', imagePath: string): Promise<string> {
  if (!imagePath) return '';
  if (isPersistentImagePath(imagePath)) return imagePath;

  const persistedPath = await persistImage(imagePath);
  if (!persistedPath || !isPersistentImagePath(persistedPath)) {
    return '';
  }

  setImageStoragePath(target, persistedPath);

  // #ifdef H5
  const resolvedUrl = await resolveDisplayUrl(persistedPath);
  if (resolvedUrl) {
    setImagePreview(target, resolvedUrl);
  }
  // #endif

  // #ifndef H5
  let displayUrl = persistedPath;
  // #ifdef APP-PLUS
  try {
    const dataUrl = await fileToDataUrl(persistedPath);
    if (dataUrl) displayUrl = dataUrl;
  } catch (e) {
    console.warn('[saveMedication] 转换图片显示地址失败:', e);
  }
  // #endif
  setImagePreview(target, displayUrl);
  // #endif

  return persistedPath;
}

// ─── 药片检测 ───
const pillDetecting = ref(false);
const pillDetected = ref(false);
const pillCanvasReady = ref(false);
const pillDetectCount = ref(0);
const pillDetectConfidence = ref(0);
const pillRegions = ref<PillRegion[]>([]);
const canvasDisplayWidth = ref(0);
const canvasDisplayHeight = ref(0);

async function runPillDetection() {
  if (!pillDisplayUrl.value || pillDetecting.value) return;

  pillDetecting.value = true;
  pillDetected.value = false;
  pillCanvasReady.value = false;

  // ★ 超时保护（25秒）：内层 L1=8s + L2=5~8s + 余量，确保不会和内层超时竞态
  const timeoutId = setTimeout(() => {
    if (pillDetecting.value) {
      console.warn('[PillDetect] 检测超时(25s)，强制结束');
      pillDetecting.value = false;
      uni.showToast({ title: '检测超时，请检查图片后重试', icon: 'none', duration: 3000 });
    }
  }, 25000);

  try {
    let result: CountResult;

    // ★ 修复：统一使用 countPillsApp（内部已根据路径格式自动选择最佳方案）
    result = await countPillsApp(
      pillDisplayUrl.value,
      640,
    );

    if (!result || result.count === undefined) {
      result = { count: 0, confidence: 0, message: '检测结果为空', regions: [] };
    }

    clearTimeout(timeoutId);

    pillDetectCount.value = result.count;
    pillDetectConfidence.value = result.confidence;
    pillRegions.value = result.regions;
    pillDetected.value = true;
    pillCanvasReady.value = true; // 无论是否有结果，都设置为true，避免UI一直显示"识别中"

    // H5 端：计算 Canvas 显示尺寸并触发渲染
    // #ifdef H5
    if (result.regions.length > 0) {
      await nextTick();
      const canvasEl = document.getElementById('pill-canvas') as HTMLCanvasElement | null;
      if (canvasEl && canvasEl.width > 0) {
        const slotWidth = 345; // rpx
        const imgRatio = canvasEl.width / canvasEl.height;
        canvasDisplayWidth.value = slotWidth;
        canvasDisplayHeight.value = Math.round(slotWidth / imgRatio);
      }
    }
    // #endif

    if (result.count > 0) {
      uni.showToast({ title: `检测到 ${result.count} 片药片`, icon: 'success' });
    } else {
      uni.showToast({ title: result.message || '未检测到药片', icon: 'none' });
    }
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('[PillDetect] 检测失败:', e);
    uni.showToast({ title: '检测失败：' + String(e), icon: 'none', duration: 3000 });
    pillDetected.value = true;
  } finally {
    clearTimeout(timeoutId);
    pillDetecting.value = false;
  }
}

function resetPillDetection() {
  pillDetected.value = false;
  pillCanvasReady.value = false;
  pillDetectCount.value = 0;
  pillDetectConfidence.value = 0;
  pillRegions.value = [];
}

// ─── 编辑模式加载 ───
onLoad(async (options) => {
  if (options?.editId) {
    editId.value = options.editId;
    isEditMode.value = true;
    const med = store.medications.find(m => m.id === options.editId);
    if (med) {
      // ★ v9 新增：验证已保存的图片路径是否仍有效（Android 修复）
      // ★ v12 增强：兼容旧版 data URL / blob URL 格式
      const boxIsDataUrl = (med.boxImageUri || '').startsWith('data:') || (med.boxImageUri || '').startsWith('blob:');
      const pillIsDataUrl = (med.pillImageUri || '').startsWith('data:') || (med.pillImageUri || '').startsWith('blob:');
      
      const boxValid = boxIsDataUrl ? true : await verifyImagePath(med.boxImageUri || '');
      const pillValid = pillIsDataUrl ? true : await verifyImagePath(med.pillImageUri || '');
      
      if (boxIsDataUrl || pillIsDataUrl) {
        console.log('[add] ★ 检测到旧版 data URL 格式的照片，建议重新拍摄');
        uni.showToast({
          title: '⚠️ 照片为旧格式，建议重新拍摄',
          icon: 'none',
          duration: 3000,
        });
      }
      
      if (!boxValid && med.boxImageUri && !boxIsDataUrl) {
        console.warn('[add] 药盒图片路径已失效:', med.boxImageUri);
        uni.showToast({ title: '⚠️ 药盒图片已失效，请重新拍摄', icon: 'none', duration: 2500 });
      }
      if (!pillValid && med.pillImageUri) {
        console.warn('[add] 药片图片路径已失效:', med.pillImageUri);
        uni.showToast({ title: '⚠️ 药片图片已失效，请重新拍摄', icon: 'none', duration: 2500 });
      }
      
      // 恢复显示用 URL
      // ★ v10 修复：App 端编辑模式图片显示
      //   策略：
      //     - 如果 imageUri 已经是 data URL / blob URL，直接使用（不会失效）
      //     - H5 端：必须走 resolveDisplayUrl 将 idb:// key 解析为 blob URL
      //     - App 端：优先使用 fileToDataUrl 将本地路径转为 data URL
      //       - 如果 fileToDataUrl 失败，回退到原始路径
      //       - 同时保留原始路径用于持久化
      let boxUrl = '', pillUrl = '';
      // data URL / blob URL 直接使用，不需要转换（已在上方声明 boxIsDataUrl / pillIsDataUrl）
      
      if (boxIsDataUrl) {
        boxUrl = med.boxImageUri || '';
      }
      if (pillIsDataUrl) {
        pillUrl = med.pillImageUri || '';
      }
      
      // #ifdef H5
      if (!boxIsDataUrl) {
        boxUrl = boxValid ? await resolveDisplayUrl(med.boxImageUri || '') : '';
      }
      if (!pillIsDataUrl) {
        pillUrl = pillValid ? await resolveDisplayUrl(med.pillImageUri || '') : '';
      }
      // #endif
      // #ifndef H5
      // App 端：先验证路径有效性，再尝试转换为 data URL
      if (!boxIsDataUrl && boxValid) {
        boxUrl = await fileToDataUrl(med.boxImageUri || '');
      }
      if (!pillIsDataUrl && pillValid) {
        pillUrl = await fileToDataUrl(med.pillImageUri || '');
      }
      // 回退：如果转换失败，使用原始路径
      if (!boxUrl && med.boxImageUri && boxValid && !boxIsDataUrl) boxUrl = med.boxImageUri;
      if (!pillUrl && med.pillImageUri && pillValid && !pillIsDataUrl) pillUrl = med.pillImageUri;
      // #endif
      
      boxDisplayUrl.value = boxUrl || '';
      pillDisplayUrl.value = pillUrl || '';

      form.value = {
        medicationType: med.medicationType || 'daily',
        boxImageUri: boxValid ? (med.boxImageUri || '') : '', // ★ 如果路径失效，清除存储
        pillImageUri: pillValid ? (med.pillImageUri || '') : '', // ★ 如果路径失效，清除存储
        name: med.name,
        brand: med.brand || '',
        specification: med.specification,
        dosage: String(med.dosage),
        expiryDate: med.expiryDate || '',
        frequency: med.frequency,
        customFrequency: med.customFrequency || '',
        reminders: [...med.reminders],
        stockCount: String(med.stockCount),
        notes: med.notes || '',
        imageUri: med.imageUri || '',
      };

      if (options?.brandChanged === '1') {
        boxDisplayUrl.value = '';
        pillDisplayUrl.value = '';
        resetPillDetection();
        form.value.boxImageUri = '';
        form.value.pillImageUri = '';
        uni.showModal({
          title: '已更换药品品牌',
          content: '请更新品牌信息，并重新拍摄药盒和药片照片后再保存库存。',
          confirmText: '知道了',
          showCancel: false,
        });
      }

      // 同步 picker 初始位置
      if (med.expiryDate) {
        const [y, mo] = med.expiryDate.split('-').map(Number);
        const yIdx = yearList.indexOf(y);
        pickerValue.value = [yIdx >= 0 ? yIdx : 1, mo - 1];
      }
      
      // ★ v9 新增：如果有图片路径失效，提示用户
      if ((!boxValid && med.boxImageUri) || (!pillValid && med.pillImageUri)) {
        uni.showModal({
          title: '图片已丢失',
          content: '检测到部分药品图片无法访问，请重新拍摄或从相册选取。',
          confirmText: '知道了',
          showCancel: false,
        });
      }
      
      uni.setNavigationBarTitle({ title: '编辑药品' });
    }
  }
});

// ─── 频率变化时更新默认时间（仅新增模式）───
watch(() => form.value.frequency, (newFreq) => {
  if (!isEditMode.value) {
    const defaultTimes = DEFAULT_REMINDER_TIMES[newFreq];
    if (defaultTimes && defaultTimes.length > 0) {
      form.value.reminders = [...defaultTimes];
    }
  }
});

function selectFrequency(freq: FrequencyType) {
  form.value.frequency = freq;
}

// ─── 时间选择 ───
function pickTime(index: number) {
  uni.showActionSheet({
    itemList: generateTimeSlots(),
    success: (res) => {
      form.value.reminders[index] = generateTimeSlots()[res.tapIndex];
    },
  });
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 5; h <= 23; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

function addReminder() {
  if (form.value.reminders.length >= 6) {
    uni.showToast({ title: '最多添加6个提醒', icon: 'none' });
    return;
  }
  form.value.reminders.push('');
}

function removeReminder(index: number) {
  if (form.value.reminders.length <= 1) {
    uni.showToast({ title: '至少保留1个提醒', icon: 'none' });
    return;
  }
  form.value.reminders.splice(index, 1);
}

// ─── 保存 ───
async function saveMedication() {
  if (isPersistingImages.value) {
    uni.showToast({ title: '图片处理中，请稍候', icon: 'none' }); return;
  }
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入药品名称', icon: 'none' }); return;
  }
  if (!form.value.boxImageUri) {
    uni.showToast({ title: '请拍摄药盒照片', icon: 'none' }); return;
  }
  if (!form.value.pillImageUri) {
    uni.showToast({ title: '请拍摄药片照片', icon: 'none' }); return;
  }
  if (!form.value.expiryDate) {
    uni.showToast({ title: '请选择保质期', icon: 'none' }); return;
  }
  if (!form.value.dosage || parseInt(form.value.dosage) <= 0) {
    uni.showToast({ title: '请输入正确的服用剂量', icon: 'none' }); return;
  }
  const stockNum = parseInt(form.value.stockCount);
  if (isNaN(stockNum) || stockNum < 0) {
    uni.showToast({ title: '请输入有效的库存数量', icon: 'none' }); return;
  }
  const hasEmptyTime = form.value.reminders.some(t => !t);
  if (hasEmptyTime) {
    uni.showToast({ title: '请设置所有提醒时间', icon: 'none' }); return;
  }

  const persistedBoxPath = await ensurePersistentImageForSave('box', form.value.boxImageUri);
  if (!persistedBoxPath) {
    uni.showToast({ title: '药盒图片保存失败，请重新选择', icon: 'none', duration: 2500 }); return;
  }

  const persistedPillPath = await ensurePersistentImageForSave('pill', form.value.pillImageUri);
  if (!persistedPillPath) {
    uni.showToast({ title: '药片图片保存失败，请重新选择', icon: 'none', duration: 2500 }); return;
  }

  const payload = {
    name: form.value.name.trim(),
    brand: form.value.brand.trim(),
    specification: form.value.specification.trim() || '未填写',
    dosage: form.value.dosage,
    frequency: form.value.frequency,
    customFrequency: form.value.customFrequency,
    reminders: form.value.reminders.sort(),
    stockCount: parseInt(form.value.stockCount),
    notes: form.value.notes,
    medicationType: form.value.medicationType,
    boxImageUri: persistedBoxPath,
    pillImageUri: persistedPillPath,
    expiryDate: form.value.expiryDate,
    imageUri: form.value.imageUri || undefined,
  };

  if (isEditMode.value && editId.value) {
    store.updateMedication(editId.value, payload);
    uni.showToast({ title: '保存成功', icon: 'success' });
  } else {
    store.addMedication(payload);
    uni.showToast({ title: '添加成功', icon: 'success' });
  }

  setTimeout(() => { uni.navigateBack(); }, 1000);
}
</script>

<style scoped>
/* ═══ 添加/编辑药品页 — 赛博朋克表单 ═══ */

.add-med-page {
  background: #0A0E27;
  background: linear-gradient(135deg, #0A0E27 0%, #1a1f3a 50%, #0f1535 100%);
  min-height: 100vh;
}

.container {
  padding: 24rpx;
  padding-bottom: 160rpx;
}

/* ── 用药类型切换 ── */
.type-toggle {
  display: flex;
  gap: 16rpx;
}

.type-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 16rpx;
  border-radius: 12rpx;
  border: 2rpx solid rgba(0, 217, 255, 0.2);
  background: rgba(20, 28, 60, 0.6);
  gap: 8rpx;
  transition: all 0.2s ease-out;
}

.type-btn.active {
  border-color: #00D9FF;
  background: rgba(0, 217, 255, 0.12);
  box-shadow: 0 0 20px rgba(0, 217, 255, 0.2);
}

.type-icon {
  font-size: 44rpx;
}

.type-label {
  font-size: 28rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.type-btn.active .type-label {
  color: #00D9FF;
  text-shadow: 0 0 10px rgba(0, 217, 255, 0.4);
}

.type-desc {
  font-size: 26rpx;
  color: #B0B8D4;
}

/* ── 照片上传 ── */
.card-sub {
  font-size: 28rpx;
  color: #B0B8D4;
  margin-bottom: 24rpx;
  display: block;
}

.photo-row {
  display: flex;
  gap: 16rpx;
}

.photo-slot {
  flex: 1;
  height: 220rpx;
  border-radius: 12rpx;
  overflow: hidden;
  position: relative;
  border: 2rpx solid rgba(0, 217, 255, 0.2);
  background: rgba(15, 21, 53, 0.8);
  transition: all 0.2s ease-out;
}

.photo-slot:active {
  border-color: rgba(0, 217, 255, 0.6);
  box-shadow: 0 0 20px rgba(0, 217, 255, 0.2);
}

.photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.photo-icon {
  font-size: 48rpx;
}

.photo-hint {
  font-size: 28rpx;
  color: #B0B8D4;
  font-weight: 700;
}

.photo-hint-sub {
  font-size: 20rpx;
  color: #FF6B00;
  font-weight: 700;
}

.photo-preview {
  width: 100%;
  height: 100%;
  position: relative;
}

.preview-img {
  width: 100%;
  height: 100%;
}

.photo-change-mask {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.6);
  padding: 10rpx;
  display: flex;
  justify-content: center;
}

.photo-change-text {
  font-size: 28rpx;
  color: #00D9FF;
  font-weight: 700;
}

/* ── 药片检测 ── */
.pill-canvas {
  width: 100%;
  height: 220rpx;
  border-radius: 12rpx;
}

.pill-detect-badge {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  background: rgba(0, 255, 65, 0.15);
  border: 1.5rpx solid #00FF41;
  border-radius: 9rpx;
  padding: 6rpx 12rpx;
  z-index: 2;
  box-shadow: 0 0 10px rgba(0, 255, 65, 0.3);
}

.detect-badge-text {
  font-size: 26rpx;
  color: #00FF41;
  font-weight: 700;
}

.pill-detect-section {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1px solid rgba(0, 217, 255, 0.1);
}

.detect-action-row {
  display: flex;
  gap: 16rpx;
}

.detect-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx 24rpx;
  background: rgba(0, 217, 255, 0.12);
  border: 2rpx solid #00D9FF;
  border-radius: 9rpx;
  color: #00D9FF;
  font-weight: 700;
  transition: all 0.2s ease-out;
}

.detect-btn:active {
  background: rgba(0, 217, 255, 0.2);
  box-shadow: 0 0 15px rgba(0, 217, 255, 0.3);
}

.detect-btn-reset {
  flex: 0 0 auto;
  background: rgba(20, 28, 60, 0.6);
  border-color: rgba(0, 217, 255, 0.2);
  color: #B0B8D4;
  padding: 16rpx 20rpx;
}

.detect-btn-text {
  font-size: 28rpx;
}

/* ── 保质期 ── */
.expiry-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(20, 28, 60, 0.6);
  border: 2rpx solid rgba(0, 217, 255, 0.2);
  border-radius: 9rpx;
  padding: 18rpx 16rpx;
}

.expiry-value {
  font-size: 28rpx;
  color: #00D9FF;
  font-weight: 700;
  font-family: 'Courier New', monospace;
}

.expiry-value.placeholder {
  color: #B0B8D4;
}

.expiry-icon {
  font-size: 32rpx;
}

.expiry-warning {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #FF6B00;
  font-weight: 700;
}

.expiry-notice {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #FFFF00;
}

/* ── 频率 ── */
.frequency-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.freq-option {
  padding: 14rpx 20rpx;
  background: rgba(20, 28, 60, 0.6);
  border-radius: 9rpx;
  border: 2rpx solid rgba(0, 217, 255, 0.1);
  transition: all 0.2s ease-out;
}

.freq-option.active {
  background: rgba(0, 217, 255, 0.12);
  border-color: #00D9FF;
  box-shadow: 0 0 15px rgba(0, 217, 255, 0.2);
}

.freq-text {
  font-size: 26rpx;
  color: #B0B8D4;
  font-weight: 700;
}

.freq-option.active .freq-text {
  color: #00D9FF;
  text-shadow: 0 0 10px rgba(0, 217, 255, 0.4);
}

/* ── 提醒时间 ── */
.reminder-list {
  margin-bottom: 20rpx;
}

.reminder-row {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
  gap: 12rpx;
}

.time-picker {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(20, 28, 60, 0.6);
  border: 2rpx solid rgba(0, 217, 255, 0.2);
  border-radius: 9rpx;
  padding: 14rpx 16rpx;
  transition: all 0.2s ease-out;
}

.time-picker:active {
  border-color: #00D9FF;
  box-shadow: 0 0 15px rgba(0, 217, 255, 0.2);
}

.time-display {
  font-size: 28rpx;
  font-weight: 900;
  color: #00D9FF;
  font-family: 'Courier New', monospace;
}

.time-icon {
  font-size: 28rpx;
}

.btn-remove {
  width: 50rpx;
  height: 50rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 107, 0, 0.12);
  border: 1.5rpx solid rgba(255, 107, 0, 0.3);
  border-radius: 9rpx;
  transition: all 0.2s ease-out;
}

.btn-remove:active {
  background: rgba(255, 107, 0, 0.2);
  border-color: #FF6B00;
  box-shadow: 0 0 10px rgba(255, 107, 0, 0.3);
}

.remove-icon {
  color: #FF6B00;
  font-size: 24rpx;
  font-weight: 900;
}

.add-time-btn {
  text-align: center;
  padding: 18rpx;
  color: #00D9FF;
  font-size: 26rpx;
  font-weight: 700;
  border: 2rpx dashed rgba(0, 217, 255, 0.3);
  border-radius: 9rpx;
  background: rgba(0, 217, 255, 0.05);
}

/* ── 剂量行 ── */
.dosage-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.dosage-input {
  flex: 1;
}

.dosage-unit {
  font-size: 28rpx;
  color: #B0B8D4;
  font-weight: 700;
}

/* ── 文本域 ── */
.form-textarea {
  min-height: 160rpx;
  width: 100%;
}

/* ── 保存 ── */
.save-area {
  margin-top: 20rpx;
}

/* ── 底部 picker ── */
.picker-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}

.picker-panel {
  width: 100%;
  background: rgba(10, 14, 39, 0.95);
  border-radius: 18rpx 18rpx 0 0;
  overflow: hidden;
  border-top: 2rpx solid rgba(0, 217, 255, 0.2);
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid rgba(0, 217, 255, 0.1);
}

.picker-cancel {
  font-size: 28rpx;
  color: #B0B8D4;
}

.picker-title {
  font-size: 30rpx;
  color: #00D9FF;
  font-weight: 900;
}

.picker-confirm {
  font-size: 28rpx;
  color: #00D9FF;
  font-weight: 900;
}

.picker-view {
  height: 380rpx;
  width: 100%;
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #B0B8D4;
  height: 76rpx;
}

.mt-20 {
  margin-top: 20rpx;
}

/* ── 表单通用（赛博风格）── */
.form-group {
  margin-bottom: 24rpx;
}

.form-label {
  font-size: 28rpx;
  font-weight: 700;
  color: #B0B8D4;
  margin-bottom: 10rpx;
  display: block;
  text-transform: uppercase;
  letter-spacing: 1rpx;
  font-family: 'Courier New', monospace;
}

.form-input {
  border: 2rpx solid rgba(0, 217, 255, 0.2);
  border-radius: 9rpx;
  padding: 16rpx;
  font-size: 28rpx;
  background: rgba(15, 21, 53, 0.8);
  color: #FFFFFF;
  width: 100%;
  box-sizing: border-box;
  height: auto;
  line-height: 1.5;
  display: block;
  transition: all 0.2s ease-out;
  font-family: 'Courier New', monospace;
}

.form-textarea.form-input {
  height: auto;
  min-height: 140rpx;
  line-height: 1.6;
  padding: 16rpx;
}

.form-input-focus {
  border-color: #00D9FF !important;
  background: rgba(20, 28, 60, 0.9) !important;
  box-shadow: 0 0 15px rgba(0, 217, 255, 0.2) !important;
}
</style>
