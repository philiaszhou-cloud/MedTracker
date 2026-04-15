<template>
  <view class="detail-page">
    <view class="container" v-if="medication">
      <!-- 药品主信息卡片 -->
      <view class="card main-card">
        <view class="med-name-row">
          <text class="med-name">{{ medication.name }}</text>
          <view
            class="toggle-switch"
            :class="{ on: medication.isActive }"
            @tap="toggleActive"
          >
            <view class="toggle-knob"></view>
          </view>
        </view>
        <text v-if="medication.brand" class="med-brand">{{ formatBrandPrefix(medication.brand) }}</text>
        <text class="med-spec text-muted">{{ medication.specification }}</text>
        <view class="med-tags mt-20">
          <view class="tag" :class="medication.medicationType === 'temporary' ? 'tag-orange' : 'tag-blue'">
            {{ medication.medicationType === 'temporary' ? t('common.temporaryMedication') : t('common.dailyMedication') }}
          </view>
          <view class="tag" :class="stockTagClass">{{ formatStockTag(medication.stockCount) }}</view>
        </view>
      </view>

      <!-- 药品照片 -->
      <view class="card" v-if="medication.boxImageUri || medication.pillImageUri">
        <text class="card-title">{{ t('detail.medicationPhotos') }}</text>
        <view class="photo-row">
          <view v-if="medication.boxImageUri" class="photo-item" @tap="previewImage(resolvedBoxUrl || medication.boxImageUri)">
            <image
              :src="resolvedBoxUrl || medication.boxImageUri"
              mode="aspectFill"
              class="photo-thumb"
              @error="onPhotoError($event, 'box')"
            />
            <text v-if="photoErrors.box && !resolvedBoxUrl" class="photo-error">{{ t('detail.boxPhotoMissing') }}</text>
            <text v-else class="photo-label">{{ t('detail.boxPhoto') }}</text>
          </view>
          <view v-if="medication.pillImageUri" class="photo-item" @tap="previewImage(resolvedPillUrl || medication.pillImageUri)">
            <image
              :src="resolvedPillUrl || medication.pillImageUri"
              mode="aspectFill"
              class="photo-thumb"
              @error="onPhotoError($event, 'pill')"
            />
            <text v-if="photoErrors.pill && !resolvedPillUrl" class="photo-error">{{ t('detail.pillPhotoMissing') }}</text>
            <text v-else class="photo-label">{{ t('detail.pillPhoto') }}</text>
          </view>
        </view>
      </view>

      <!-- 用药方案 -->
      <view class="card">
        <text class="card-title">{{ t('detail.medicationPlan') }}</text>
        <view class="info-row">
          <text class="info-label">{{ t('common.medicationType') }}</text>
          <text class="info-value" :class="medication.medicationType === 'temporary' ? 'text-orange' : 'text-blue'">
            {{ medication.medicationType === 'temporary' ? t('common.temporaryMedication') : t('common.dailyMedication') }}
          </text>
        </view>
        <view class="info-row">
          <text class="info-label">{{ t('common.brand') }}</text>
          <text class="info-value">{{ medication.brand || t('common.notProvided') }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">{{ t('common.dosage') }}</text>
          <text class="info-value">{{ medication.dosage }} {{ t('common.pillsUnit') }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">{{ t('common.frequency') }}</text>
          <text class="info-value">{{ getFrequencyLabel(medication.frequency) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">{{ t('common.reminderTime') }}</text>
          <view class="reminder-tags">
            <text v-for="(time, idx) in medication.reminders" :key="idx" class="tag tag-blue">
              {{ time }}
            </text>
          </view>
        </view>
        <view class="info-row" v-if="medication.expiryDate">
          <text class="info-label">{{ t('common.expiryDate') }}</text>
          <text class="info-value" :class="expiryClass">{{ formatExpiry(medication.expiryDate) }}</text>
        </view>
        <view v-if="medication.notes" class="info-row">
          <text class="info-label">{{ t('common.notes') }}</text>
          <text class="info-value">{{ medication.notes }}</text>
        </view>
      </view>

      <!-- 库存信息 -->
      <view class="card">
        <text class="card-title">{{ t('detail.stockInfo') }}</text>
        <view class="stock-display">
          <view class="stock-circle" :class="{ 'low': daysRemaining <= 3 }">
            <text class="stock-number">{{ medication.stockCount }}</text>
            <text class="stock-unit">{{ t('common.pillsUnit') }}</text>
          </view>
          <view class="stock-detail">
            <text class="days-text" :class="{ 'text-danger': daysRemaining <= 3 }">
              {{ daysRemaining <= 0 ? t('detail.outOfStock') : formatRemainingDays(daysRemaining) }}
            </text>
            <text class="text-muted text-small mt-10">{{ formatDailyUsage(dailyUsage) }}</text>
          </view>
        </view>

        <view v-if="hasIncomingStock" class="incoming-stock-card">
          <view class="batch-row">
            <text class="batch-label">{{ t('detail.currentBatch') }}</text>
            <text class="batch-value">{{ formatBatchSummary(currentBatchStockCount, medication.expiryDate) }}</text>
          </view>
          <view class="batch-row">
            <text class="batch-label">{{ t('detail.incomingBatch') }}</text>
            <text class="batch-value">{{ formatBatchSummary(incomingStockCount, medication.incomingStock?.expiryDate || '') }}</text>
          </view>
          <text class="batch-hint">{{ t('detail.incomingAutoSwitchHint') }}</text>
          <view class="btn-secondary batch-action-btn" @tap="confirmUseIncomingStock">
            <text>{{ t('detail.useNewStockNow') }}</text>
          </view>
        </view>

        <view class="restock-actions">
          <view class="btn-secondary" @tap="toggleRestockPanel">
            <text>{{ showRestockPanel ? t('detail.collapseRestock') : t('detail.expandRestock') }}</text>
          </view>
        </view>

        <view v-if="showRestockPanel" class="restock-panel">
          <text class="restock-title">{{ t('detail.restockTitle') }}</text>
          <view class="restock-mode-row">
            <view class="restock-mode-btn" :class="{ active: restockMode === 'same' }" @tap="restockMode = 'same'">
              <text>{{ t('detail.sameBrand') }}</text>
            </view>
            <view class="restock-mode-btn warn" :class="{ active: restockMode === 'changed' }" @tap="restockMode = 'changed'">
              <text>{{ t('detail.changedBrand') }}</text>
            </view>
          </view>

          <view v-if="restockMode === 'same'" class="restock-form">
            <text class="restock-hint">{{ t('detail.sameBrandHint') }}</text>
            <input
              class="restock-input"
              type="digit"
              :value="restockAmount"
              @input="restockAmount = ($event.detail as any).value"
              :placeholder="t('detail.restockPlaceholder')"
              placeholder-style="color: #8EA0BE; font-size: 30rpx;"
            />
            <view class="restock-field">
              <text class="info-label">{{ t('detail.restockExpiryLabel') }}</text>
              <picker mode="date" fields="month" :value="restockPickerValue" @change="onRestockExpiryChange">
                <view class="restock-picker">
                  <text class="restock-picker-text" :class="{ placeholder: !restockExpiryDate }">
                    {{ restockExpiryDate ? formatExpiry(restockExpiryDate) : t('detail.selectRestockExpiry') }}
                  </text>
                </view>
              </picker>
            </view>
            <view class="btn-primary restock-confirm-btn" @tap="confirmRestockSameBrand">
              <text>{{ t('detail.confirmRestock') }}</text>
            </view>
          </view>

          <view v-else class="restock-form">
            <text class="restock-hint warn">{{ t('detail.changedBrandHint') }}</text>
            <view class="btn-primary restock-confirm-btn" @tap="goToBrandChangeEdit">
              <text>{{ t('detail.goEditRetake') }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 最近服药记录 -->
      <view class="card">
        <text class="card-title">{{ t('detail.recentRecords') }}</text>
        <view v-if="recentLogs.length > 0">
          <view v-for="log in recentLogs" :key="log.id" class="log-item">
            <view class="log-dot" :class="log.status"></view>
            <view class="log-info">
              <text class="log-time">{{ formatLogTime(log.timestamp) }}</text>
              <text class="log-status" :class="'text-' + statusColor(log.status)">{{ statusText(log.status) }}</text>
            </view>
          </view>
        </view>
        <view v-else class="empty-state-mini">
          <text class="text-muted">{{ t('detail.noRecentRecords') }}</text>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-buttons">
        <view class="btn-secondary" @tap="editMedication">
          <text>{{ t('detail.editMedication') }}</text>
        </view>
        <view class="btn-danger mt-20" @tap="deleteMedication">
          <text>{{ t('detail.deleteMedication') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { useMedStore } from '../../stores/index';
import { getDailyDosage, calcDaysRemaining, formatDate, formatTime } from '../../utils';
import type { Medication, IntakeLog, FrequencyType } from '../../types';
import { loadImageFromStorage, fileToDataUrl, verifyImagePath } from '../../utils/imageStorage';

const store = useMedStore();
const { t, locale } = useI18n();
const medicationId = ref('');
const medication = ref<Medication | null>(null);

// 可显示的照片 URL（已从 IndexedDB 恢复）
const resolvedBoxUrl = ref('');
const resolvedPillUrl = ref('');
const showRestockPanel = ref(false);
const restockMode = ref<'same' | 'changed'>('same');
const restockAmount = ref('');
const restockExpiryDate = ref('');

// 照片加载错误状态
const photoErrors = ref({ box: false, pill: false });

watch(() => locale.value, () => {
  uni.setNavigationBarTitle({ title: t('nav.medicationDetail') });
}, { immediate: true });

function onPhotoError(_e: any, type: 'box' | 'pill') {
  // 只在使用原始路径时才标记为错误（即resolvedUrl为空的情况下）
  // 因为有些路径格式在<image>中需要时间加载，不要急着标记为错误
  const isResolved = type === 'box' ? resolvedBoxUrl.value : resolvedPillUrl.value;
  if (!isResolved) {
    photoErrors.value[type] = true;
    console.warn(`[Detail] ${type === 'box' ? '药盒' : '药片'}照片加载失败，将显示为灰色`);
  }
}

const daysRemaining = computed(() => {
  if (!medication.value) return 0;
  const dailyUsage = getDailyDosage(medication.value.frequency, medication.value.dosage);
  return calcDaysRemaining(medication.value.stockCount, dailyUsage);
});

const dailyUsage = computed(() => {
  if (!medication.value) return 0;
  return getDailyDosage(medication.value.frequency, medication.value.dosage);
});

const hasIncomingStock = computed(() => !!medication.value?.incomingStock?.stockCount);

const incomingStockCount = computed(() => medication.value?.incomingStock?.stockCount || 0);

const currentBatchStockCount = computed(() => {
  if (!medication.value) return 0;
  if (typeof medication.value.activeStockCount === 'number') {
    return medication.value.activeStockCount;
  }

  const queuedStock = medication.value.incomingStock?.stockCount || 0;
  return queuedStock > 0 ? Math.max(0, medication.value.stockCount - queuedStock) : medication.value.stockCount;
});

const restockPickerValue = computed(() => restockExpiryDate.value || currentMonthValue());

const stockTagClass = computed(() => {
  return daysRemaining.value <= 3 ? 'tag-red' : 'tag-green';
});

// 保质期颜色
const expiryClass = computed(() => {
  if (!medication.value?.expiryDate) return '';
  const [y, m] = medication.value.expiryDate.split('-').map(Number);
  const expiry = new Date(y, m - 1, 1);
  const now = new Date(); now.setDate(1); now.setHours(0,0,0,0);
  if (expiry < now) return 'text-danger';
  const soon = new Date(); soon.setMonth(soon.getMonth() + 3);
  if (expiry <= soon) return 'text-warning';
  return 'text-success';
});

function formatExpiry(val: string): string {
  if (!val) return '';
  const [y, m] = val.split('-');
  const expiry = new Date(Number(y), Number(m) - 1, 1);
  const now = new Date(); now.setDate(1); now.setHours(0,0,0,0);
  if (locale.value === 'en') {
    const monthLabel = expiry.toLocaleString('en-US', { month: 'short' });
    const base = `${monthLabel} ${y}`;
    return expiry < now ? `${base} (expired)` : base;
  }
  if (expiry < now) return `${y}年${parseInt(m)}月（已过期）`;
  return `${y}年${parseInt(m)}月`;
}

function previewImage(url: string) {
  uni.previewImage({ urls: [url], current: url });
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function syncMedicationFromStore() {
  if (!medicationId.value) return;
  medication.value = store.medications.find(item => item.id === medicationId.value) || null;
}

function formatBrandPrefix(brand: string) {
  if (locale.value === 'en') {
    return `Brand · ${brand}`;
  }
  return `品牌 · ${brand}`;
}

function formatStockTag(count: number) {
  if (locale.value === 'en') {
    return `Stock ${count} pills`;
  }
  return `库存 ${count} 片`;
}

function formatRemainingDays(count: number) {
  if (locale.value === 'en') {
    return `About ${count} days remaining`;
  }
  return `预计可用 ${count} 天`;
}

function formatDailyUsage(count: number) {
  if (locale.value === 'en') {
    return `About ${count} pills/day`;
  }
  return `每日用量约 ${count} 片`;
}

function formatBatchSummary(count: number, expiryDate: string) {
  if (!expiryDate) {
    return locale.value === 'en' ? `${count} pills` : `${count} 片`;
  }
  if (locale.value === 'en') {
    return `${count} pills · ${formatExpiry(expiryDate)}`;
  }
  return `${count} 片 · ${formatExpiry(expiryDate)}`;
}

function formatUseIncomingStockContent(currentCount: number, incomingCount: number) {
  if (locale.value === 'en') {
    return `Using the new stock now will mark the current ${currentCount} pills as lost and switch the app to the newly received ${incomingCount} pills. Continue?`;
  }
  return `立即启用新库存后，当前批次剩余的 ${currentCount} 片会按损耗处理，系统将改为使用新入库的 ${incomingCount} 片并更新保质期。是否继续？`;
}

function formatPendingExpiryConflict(expiryDate: string) {
  const formattedExpiry = formatExpiry(expiryDate);
  if (locale.value === 'en') {
    return `A pending incoming batch with expiry ${formattedExpiry} is already registered. To register a different expiry date, start using that batch first.`;
  }
  return `当前已经登记了一批保质期为 ${formattedExpiry} 的新库存。如需登记另一批不同保质期的新库存，请先启用这批新库存。`;
}

function onRestockExpiryChange(event: any) {
  restockExpiryDate.value = event.detail.value;
}

function resetRestockForm() {
  restockAmount.value = '';
  restockExpiryDate.value = '';
  restockMode.value = 'same';
}

const recentLogs = computed((): IntakeLog[] => {
  if (!medicationId.value) return [];
  return store.intakeLogs
    .filter(l => l.medicationId === medicationId.value)
    .slice(0, 10);
});

onLoad(async (options) => {
  if (options?.id) {
    medicationId.value = options.id;
    medication.value = store.medications.find(m => m.id === options.id) || null;
    // 恢复 IndexedDB 存储的照片
    if (medication.value) {
      // ★ v12 增强：兼容旧版 data URL 格式 + 验证路径有效性
      const currentMed = medication.value;
      const originalBoxPath = currentMed.boxImageUri || '';
      const originalPillPath = currentMed.pillImageUri || '';

      // ★ v12：检测旧版遗留的 data URL 格式（之前版本直接将 base64 存入 form）
      const boxIsDataUrl = originalBoxPath.startsWith('data:');
      const pillIsDataUrl = originalPillPath.startsWith('data:');
      if (boxIsDataUrl || pillIsDataUrl) {
        console.log('[Detail] ★ 检测到旧版 data URL 格式，正在迁移...');
        // data URL 直接用于显示，但提示用户重新拍照以持久化到磁盘
        uni.showToast({
          title: t('detail.legacyPhotoWarning'),
          icon: 'none',
          duration: 3000,
        });
      }

      // 验证路径有效性（data URL 视为有效）
      const verifiedBoxPath = boxIsDataUrl ? originalBoxPath : await verifyImagePath(originalBoxPath);
      const verifiedPillPath = pillIsDataUrl ? originalPillPath : await verifyImagePath(originalPillPath);
      const boxValid = !!verifiedBoxPath;
      const pillValid = !!verifiedPillPath;

      if (verifiedBoxPath && verifiedBoxPath !== currentMed.boxImageUri) {
        currentMed.boxImageUri = verifiedBoxPath;
      }
      if (verifiedPillPath && verifiedPillPath !== currentMed.pillImageUri) {
        currentMed.pillImageUri = verifiedPillPath;
      }

      if ((verifiedBoxPath && verifiedBoxPath !== originalBoxPath) || (verifiedPillPath && verifiedPillPath !== originalPillPath)) {
        store.updateMedication(currentMed.id, {
          boxImageUri: verifiedBoxPath || '',
          pillImageUri: verifiedPillPath || '',
        });
      }

      if (!boxValid && currentMed.boxImageUri && !boxIsDataUrl) {
        console.warn('[Detail] 药盒图片路径已失效:', currentMed.boxImageUri);
        uni.showToast({ title: t('detail.invalidBox'), icon: 'none', duration: 2500 });
      }
      if (!pillValid && currentMed.pillImageUri && !pillIsDataUrl) {
        console.warn('[Detail] 药片图片路径已失效:', currentMed.pillImageUri);
        uni.showToast({ title: t('detail.invalidPill'), icon: 'none', duration: 2500 });
      }
      
      // ★ 修复：确保所有图片加载异步操作都完成后再返回
      // 原因：iOS WebView 中如果不等待，图片可能无法显示
      const imageLoadTasks: Promise<void>[] = [];
      
      if (currentMed.boxImageUri && boxValid) {
        imageLoadTasks.push(
          (async () => {
            try {
              // 如果已经是 data URL 或 blob URL，直接使用
              if (currentMed.boxImageUri.startsWith('data:') || currentMed.boxImageUri.startsWith('blob:')) {
                resolvedBoxUrl.value = currentMed.boxImageUri;
                return;
              }
              // #ifdef H5
              resolvedBoxUrl.value = await loadImageFromStorage(verifiedBoxPath || '');
              // #endif
              // #ifndef H5
              resolvedBoxUrl.value = await fileToDataUrl(verifiedBoxPath || '');
              if (!resolvedBoxUrl.value) {
                resolvedBoxUrl.value = verifiedBoxPath || '';
              }
              // #endif
            } catch (e) {
              console.warn('[Detail] 加载 boxImageUri 失败:', e);
              resolvedBoxUrl.value = verifiedBoxPath || '';
            }
          })()
        );
      }
      
      if (currentMed.pillImageUri && pillValid) {
        imageLoadTasks.push(
          (async () => {
            try {
              // 如果已经是 data URL 或 blob URL，直接使用
              if (currentMed.pillImageUri.startsWith('data:') || currentMed.pillImageUri.startsWith('blob:')) {
                resolvedPillUrl.value = currentMed.pillImageUri;
                return;
              }
              // #ifdef H5
              resolvedPillUrl.value = await loadImageFromStorage(verifiedPillPath || '');
              // #endif
              // #ifndef H5
              resolvedPillUrl.value = await fileToDataUrl(verifiedPillPath || '');
              if (!resolvedPillUrl.value) {
                resolvedPillUrl.value = verifiedPillPath || '';
              }
              // #endif
            } catch (e) {
              console.warn('[Detail] 加载 pillImageUri 失败:', e);
              resolvedPillUrl.value = verifiedPillPath || '';
            }
          })()
        );
      }
      
      // 等待所有图片加载完成
      if (imageLoadTasks.length > 0) {
        await Promise.all(imageLoadTasks);
      }
      
      // ★ v9 新增：如果有图片路径失效，提示用户（可选）
      if ((!boxValid && currentMed.boxImageUri) || (!pillValid && currentMed.pillImageUri)) {
        console.warn('[Detail] 部分药品图片已丢失，需要重新拍摄或从相册选取');
      }
    }
  }
});

function getFrequencyLabel(freq: string): string {
  return t(`frequency.${freq as FrequencyType}`);
}

function toggleRestockPanel() {
  showRestockPanel.value = !showRestockPanel.value;
  if (!showRestockPanel.value) {
    resetRestockForm();
  }
}

function confirmRestockSameBrand() {
  if (!medication.value) return;
  const amount = parseInt(restockAmount.value, 10);
  if (isNaN(amount) || amount <= 0) {
    uni.showToast({ title: t('detail.invalidRestock'), icon: 'none' });
    return;
  }
  if (!restockExpiryDate.value) {
    uni.showToast({ title: t('detail.invalidRestockExpiry'), icon: 'none' });
    return;
  }

  const result = store.addStock(medication.value.id, amount, restockExpiryDate.value);
  if (!result.ok) {
    if (result.reason === 'pending_expiry_conflict' && medication.value.incomingStock?.expiryDate) {
      uni.showModal({
        title: t('detail.pendingExpiryConflictTitle'),
        content: formatPendingExpiryConflict(medication.value.incomingStock.expiryDate),
        showCancel: false,
        confirmText: t('common.confirm'),
      });
      return;
    }

    const fallbackTitle = result.reason === 'invalid_expiry'
      ? t('detail.invalidRestockExpiry')
      : t('detail.invalidRestock');
    uni.showToast({ title: fallbackTitle, icon: 'none' });
    return;
  }

  syncMedicationFromStore();
  resetRestockForm();
  showRestockPanel.value = false;
  uni.showToast({
    title: result.activatedImmediately ? t('detail.stockActivatedImmediately') : t('detail.stockRegistered'),
    icon: 'success',
  });
}

function confirmUseIncomingStock() {
  if (!medication.value?.incomingStock) return;

  uni.showModal({
    title: t('detail.useNewStockTitle'),
    content: formatUseIncomingStockContent(currentBatchStockCount.value, incomingStockCount.value),
    confirmText: t('detail.useNewStockNow'),
    confirmColor: '#FF7A59',
    cancelText: t('common.cancel'),
    success: (res) => {
      if (!res.confirm || !medication.value) return;

      const switched = store.useIncomingStock(medication.value.id);
      if (!switched) {
        uni.showToast({ title: t('detail.noIncomingStock'), icon: 'none' });
        return;
      }

      syncMedicationFromStore();
      uni.showToast({ title: t('detail.stockActivated'), icon: 'success' });
    },
  });
}

function goToBrandChangeEdit() {
  if (!medication.value) return;
  uni.navigateTo({
    url: `/pages/medication/add?editId=${encodeURIComponent(medication.value.id)}&brandChanged=1`,
  });
}

function toggleActive() {
  if (medication.value) {
    store.toggleMedication(medication.value.id);
    // store.toggleMedication 已通过同一对象引用修改了 isActive，无需手动再次取反
    uni.showToast({
      title: medication.value.isActive ? t('detail.enabled') : t('detail.disabled'),
      icon: 'none',
    });
  }
}

function formatLogTime(ts: number): string {
  return `${formatDate(ts)} ${formatTime(ts)}`;
}

function statusText(status: string): string {
  const map: Record<string, string> = { taken: t('common.taken'), skipped: t('common.skipped'), missed: t('common.missed') };
  return map[status] || status;
}

function statusColor(status: string): string {
  const map: Record<string, string> = { taken: 'success', skipped: 'warning', missed: 'danger' };
  return map[status] || 'muted';
}

function editMedication() {
  if (medication.value) {
    uni.navigateTo({
      url: `/pages/medication/add?editId=${encodeURIComponent(medication.value.id)}`,
    });
  }
}

function deleteMedication() {
  uni.showModal({
    title: t('detail.confirmDeleteTitle'),
    content: t('detail.confirmDeleteContent', { name: medication.value?.name || '' }),
    confirmText: t('common.delete'),
    confirmColor: '#D32F2F',
    success: (res) => {
      if (res.confirm && medication.value) {
        store.removeMedication(medication.value.id);
        uni.showToast({ title: t('detail.deleted'), icon: 'success' });
        setTimeout(() => uni.navigateBack(), 1000);
      }
    },
  });
}
</script>

<style scoped>
.detail-page {
  background: #0A0E27;
  background: linear-gradient(135deg, #0A0E27 0%, #1a1f3a 50%, #0f1535 100%);
  min-height: 100vh;
}

.container {
  padding: 24rpx;
  padding-bottom: 100rpx;
}

/* 主信息卡 */
.main-card {
  background: rgba(30, 45, 90, 0.5);
  border-color: rgba(0, 217, 255, 0.4);
  box-shadow: 0 0 25px rgba(0, 217, 255, 0.2);
}

.med-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.med-name {
  font-size: 40rpx;
  font-weight: 900;
  color: #00D9FF;
  text-shadow: 0 0 15px rgba(0, 217, 255, 0.5);
  letter-spacing: 1.5rpx;
  text-transform: uppercase;
  font-family: 'Courier New', monospace;
}

/* 开关 */
.toggle-switch {
  width: 76rpx;
  height: 44rpx;
  border-radius: 33rpx;
  background: rgba(15, 21, 53, 0.8);
  border: 2rpx solid rgba(0, 217, 255, 0.2);
  padding: 3rpx;
  position: relative;
  transition: all 0.3s ease-out;
}

.toggle-switch.on {
  background: rgba(0, 255, 65, 0.15);
  border-color: #00FF41;
  box-shadow: 0 0 15px rgba(0, 255, 65, 0.3);
}

.toggle-knob {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: #B0B8D4;
  transition: all 0.3s ease-out;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
}

.toggle-switch.on .toggle-knob {
  transform: translateX(32rpx);
  background: #00FF41;
  box-shadow: 0 0 12px rgba(0, 255, 65, 0.5);
}

.med-spec {
  color: #B0B8D4;
  font-size: 26rpx;
}

.med-brand {
  display: block;
  color: #FF7A59;
  font-size: 24rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}

.med-tags {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
}

/* 照片展示 */
.photo-row {
  display: flex;
  gap: 16rpx;
}

.photo-item {
  flex: 1;
  position: relative;
}

.photo-thumb {
  width: 100%;
  height: 240rpx;
  border-radius: 18rpx;
  border: 2rpx solid rgba(0, 217, 255, 0.2);
  background: rgba(15, 21, 53, 0.8);
  box-shadow: 0 0 15px rgba(0, 217, 255, 0.15);
  transition: all 0.2s ease-out;
}

.photo-thumb:active {
  border-color: rgba(0, 217, 255, 0.6);
  box-shadow: 0 0 25px rgba(0, 217, 255, 0.4);
  transform: scale(0.98);
}

.photo-label {
  position: absolute;
  bottom: 12rpx;
  left: 12rpx;
  background: rgba(0, 217, 255, 0.15);
  color: #00D9FF;
  padding: 6rpx 12rpx;
  border-radius: 9rpx;
  font-size: 26rpx;
  font-weight: 700;
  border: 1rpx solid #00D9FF;
}

.photo-error {
  position: absolute;
  bottom: 12rpx;
  left: 12rpx;
  background: rgba(255, 107, 0, 0.2);
  color: #FF6B00;
  padding: 6rpx 12rpx;
  border-radius: 9rpx;
  font-size: 20rpx;
  font-weight: 700;
}

/* 信息行 */
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(0, 217, 255, 0.1);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  color: #B0B8D4;
  font-size: 26rpx;
  font-weight: 700;
}

.info-value {
  color: #00D9FF;
  font-size: 26rpx;
  font-weight: 700;
  text-align: right;
  flex: 1;
  padding-left: 16rpx;
}

.reminder-tags {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
  flex: 1;
  justify-content: flex-end;
}

/* 库存圆形显示 */
.stock-display {
  display: flex;
  align-items: center;
  gap: 32rpx;
  padding: 24rpx;
  margin: 16rpx 0;
}

.stock-circle {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background: rgba(0, 217, 255, 0.1);
  border: 3rpx solid #00D9FF;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 25px rgba(0, 217, 255, 0.3);
  flex-shrink: 0;
}

.stock-circle.low {
  border-color: #FF6B00;
  background: rgba(255, 107, 0, 0.1);
  box-shadow: 0 0 25px rgba(255, 107, 0, 0.25);
}

.stock-number {
  font-size: 56rpx;
  font-weight: 900;
  color: #00D9FF;
  letter-spacing: 1rpx;
  font-family: 'Courier New', monospace;
}

.stock-circle.low .stock-number {
  color: #FF6B00;
}

.stock-unit {
  font-size: 24rpx;
  color: #B0B8D4;
  letter-spacing: 0.5rpx;
}

.stock-detail {
  flex: 1;
}

.incoming-stock-card {
  margin: 0 24rpx 12rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: rgba(255, 122, 89, 0.08);
  border: 1rpx solid rgba(255, 122, 89, 0.24);
}

.batch-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  padding: 8rpx 0;
}

.batch-label {
  color: #FFC4B5;
  font-size: 24rpx;
  font-weight: 700;
}

.batch-value {
  color: #FFF2E8;
  font-size: 24rpx;
  text-align: right;
  flex: 1;
}

.batch-hint {
  display: block;
  margin-top: 8rpx;
  color: #FFD5C8;
  font-size: 22rpx;
  line-height: 1.6;
}

.batch-action-btn {
  margin-top: 18rpx;
}

.restock-actions {
  margin-top: 12rpx;
}

.restock-panel {
  margin-top: 20rpx;
  padding: 22rpx;
  border-radius: 18rpx;
  background: rgba(11, 20, 48, 0.72);
  border: 1rpx solid rgba(0, 217, 255, 0.18);
}

.restock-title {
  display: block;
  color: #E6F7FF;
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 18rpx;
}

.restock-mode-row {
  display: flex;
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.restock-mode-btn {
  flex: 1;
  padding: 16rpx 14rpx;
  text-align: center;
  border-radius: 14rpx;
  border: 2rpx solid rgba(0, 217, 255, 0.2);
  background: rgba(0, 217, 255, 0.08);
  color: #BCEFFF;
  font-size: 26rpx;
  font-weight: 700;
}

.restock-mode-btn.active {
  border-color: #00D9FF;
  color: #00D9FF;
  box-shadow: 0 0 18rpx rgba(0, 217, 255, 0.22);
}

.restock-mode-btn.warn {
  border-color: rgba(255, 122, 89, 0.25);
  background: rgba(255, 122, 89, 0.08);
  color: #FFC4B5;
}

.restock-mode-btn.warn.active {
  border-color: #FF7A59;
  color: #FF7A59;
  box-shadow: 0 0 18rpx rgba(255, 122, 89, 0.22);
}

.restock-form {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.restock-hint {
  color: #AFC7E9;
  font-size: 24rpx;
  line-height: 1.6;
}

.restock-hint.warn {
  color: #FFC4B5;
}

.restock-input {
  width: 100%;
  min-height: 88rpx;
  padding: 0 24rpx;
  border-radius: 14rpx;
  border: 2rpx solid rgba(0, 217, 255, 0.2);
  background: rgba(15, 21, 53, 0.85);
  color: #E6F7FF;
  font-size: 32rpx;
  box-sizing: border-box;
}

.restock-field {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.restock-picker {
  min-height: 88rpx;
  padding: 0 24rpx;
  border-radius: 14rpx;
  border: 2rpx solid rgba(0, 217, 255, 0.2);
  background: rgba(15, 21, 53, 0.85);
  display: flex;
  align-items: center;
}

.restock-picker-text {
  color: #E6F7FF;
  font-size: 30rpx;
}

.restock-picker-text.placeholder {
  color: #8EA0BE;
}

.restock-confirm-btn {
  margin-top: 4rpx;
}

.days-text {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 8rpx;
}

/* 日志项 */
.log-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid rgba(0, 217, 255, 0.1);
}

.log-item:last-child {
  border-bottom: none;
}

.log-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 10px currentColor;
}

.log-dot.taken {
  background: #00FF41;
  box-shadow: 0 0 10px rgba(0, 255, 65, 0.5);
}

.log-dot.missed {
  background: #FF6B00;
  box-shadow: 0 0 10px rgba(255, 107, 0, 0.5);
}

.log-info {
  flex: 1;
}

.log-time {
  display: block;
  color: #B0B8D4;
  font-size: 24rpx;
}

.log-status {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  margin-top: 2rpx;
}

.empty-state-mini {
  text-align: center;
  padding: 40rpx 20rpx;
  color: #B0B8D4;
}

/* 操作按钮 */
.action-buttons {
  margin-top: 32rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(0, 217, 255, 0.15);
}

/* 颜色工具 */
.text-orange {
  color: #FF6B00;
}

.text-blue {
  color: #00D9FF;
}

.text-warning {
  color: #FFFF00;
}

.text-danger {
  color: #FF006E;
}

.text-success {
  color: #00FF41;
}

.tag-orange {
  background: rgba(255, 107, 0, 0.12);
  color: #FF6B00;
}

.tag-blue {
  background: rgba(0, 217, 255, 0.12);
  color: #00D9FF;
}

.tag-red {
  background: rgba(255, 0, 110, 0.12);
  color: #FF006E;
}

.tag-green {
  background: rgba(0, 255, 65, 0.12);
  color: #00FF41;
}
</style>
