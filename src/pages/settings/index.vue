<template>
  <view class="settings-page">
    <view class="container">
      <!-- 用户信息卡片 -->
      <view class="card profile-card">
        <view class="profile-info">
          <view class="avatar">⊙</view>
          <view class="profile-text">
            <text class="profile-name">{{ t('settings.profileName') }}</text>
            <text class="profile-desc">{{ t('settings.profileDesc') }}</text>
          </view>
        </view>
      </view>

      <!-- 提醒设置 -->
      <view class="card">
        <text class="card-title">{{ t('settings.reminderSettings') }}</text>

        <view class="setting-item">
          <text class="setting-label">{{ t('settings.medicationReminder') }}</text>
          <view class="toggle-switch" :class="{ on: reminderConfig.enabled }" @tap="toggle('enabled')">
            <view class="toggle-knob"></view>
          </view>
        </view>

        <view class="setting-item">
          <text class="setting-label">{{ t('settings.reminderSound') }}</text>
          <view class="toggle-switch" :class="{ on: reminderConfig.soundEnabled }" @tap="toggle('soundEnabled')">
            <view class="toggle-knob"></view>
          </view>
        </view>

        <view class="setting-item">
          <text class="setting-label">{{ t('settings.vibrateReminder') }}</text>
          <view class="toggle-switch" :class="{ on: reminderConfig.vibrateEnabled }" @tap="toggle('vibrateEnabled')">
            <view class="toggle-knob"></view>
          </view>
        </view>

        <view class="setting-item">
          <text class="setting-label">{{ t('settings.advanceReminder') }}</text>
          <view class="picker-value" @tap="pickAdvanceMinutes">
            <text>{{ t('settings.minutesOption', { count: reminderConfig.advanceMinutes }) }}</text>
            <text class="picker-arrow">›</text>
          </view>
        </view>

        <view class="setting-item" @tap="pickLanguage">
          <text class="setting-label">{{ t('settings.language') }}</text>
          <view class="picker-value">
            <text>{{ currentLanguageLabel }}</text>
            <text class="picker-arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 每日拍照记录设置 -->
      <view class="card">
        <text class="card-title">{{ t('settings.dailyPhotoRecord') }}</text>
        <text class="setting-hint">{{ t('settings.dailyPhotoHint') }}</text>

        <view class="setting-item">
          <text class="setting-label">{{ t('settings.enableDailyPhotoRecord') }}</text>
          <view class="toggle-switch" :class="{ on: dailyPhotoConfig.enabled }" @tap="togglePhotoMode">
            <view class="toggle-knob"></view>
          </view>
        </view>

        <view v-if="dailyPhotoConfig.enabled" class="nested-settings">
          <view class="setting-item indent">
            <text class="setting-label">{{ t('settings.requireDailyValidation') }}</text>
            <view class="toggle-switch" :class="{ on: dailyPhotoConfig.requireDaily }" @tap="toggleRequireDaily">
              <view class="toggle-knob"></view>
            </view>
          </view>

          <view class="photo-mode-info">
            <text class="info-text">🎯 {{ dailyPhotoConfig.requireDaily ? t('settings.requiredMode') : t('settings.optionalMode') }}：</text>
            <view v-if="!dailyPhotoConfig.requireDaily" class="info-section">
              <text class="info-item">{{ t('settings.optionalItem1') }}</text>
              <text class="info-item">{{ t('settings.optionalItem2') }}</text>
              <text class="info-item">{{ t('settings.optionalItem3') }}</text>
            </view>
            <view v-else class="info-section">
              <text class="info-item">{{ t('settings.requiredItem1') }}</text>
              <text class="info-item">{{ t('settings.requiredItem2') }}</text>
              <text class="info-item">{{ t('settings.requiredItem3') }}</text>
              <text class="info-item">{{ t('settings.requiredItem4') }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 数据管理 -->
      <view class="card">
        <text class="card-title">{{ t('settings.dataManagement') }}</text>

        <view class="setting-item" @tap="exportData">
          <text class="setting-label">{{ t('settings.exportData') }}</text>
          <text class="setting-arrow">›</text>
        </view>

        <view class="setting-item danger-item" @tap="clearAllData">
          <text class="setting-label text-danger">{{ t('settings.clearAllData') }}</text>
          <text class="setting-arrow">›</text>
        </view>
      </view>

      <!-- 关于 -->
      <view class="card">
        <text class="card-title">{{ t('settings.about') }}</text>

        <view class="setting-item">
          <text class="setting-label">{{ t('settings.version') }}</text>
          <text class="setting-value text-muted">1.0.0</text>
        </view>

        <view class="setting-item">
          <text class="setting-label">{{ t('settings.privacy') }}</text>
          <text class="setting-arrow">›</text>
        </view>

        <view class="info-text mt-20">
          <text class="text-muted text-small">
            {{ t('settings.privacyBody') }}
          </text>
        </view>
      </view>

      <!-- 技术说明 -->
      <view class="card tech-card">
        <text class="card-title">{{ t('settings.techInfo') }}</text>
        <view class="tech-item">
          <text class="tech-label">{{ t('settings.framework') }}</text>
          <text class="tech-value">uni-app (Vue 3 + TypeScript)</text>
        </view>
        <view class="tech-item">
          <text class="tech-label">{{ t('settings.stateManagement') }}</text>
          <text class="tech-value">Pinia</text>
        </view>
        <view class="tech-item">
          <text class="tech-label">{{ t('settings.dataStorage') }}</text>
          <text class="tech-value">{{ t('settings.offlineFirst') }}</text>
        </view>
        <view class="tech-item">
          <text class="tech-label">{{ t('settings.aiRecognition') }}</text>
          <text class="tech-value">{{ t('settings.localInference') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { useMedStore } from '../../stores/index';
import { getAppLocale, setAppLocale } from '../../i18n';
import { clearAllImageData } from '../../utils/imageStorage';

const store = useMedStore();
const { t, locale } = useI18n();
const reminderConfig = computed(() => store.reminderConfig);
const dailyPhotoConfig = computed(() => store.dailyPhotoConfig);
const currentLanguageLabel = computed(() => locale.value === 'en' ? t('settings.english') : t('settings.simplifiedChinese'));

const advanceMinuteOptions = [0, 5, 10, 15, 30];

function syncNavigationTitle() {
  uni.setNavigationBarTitle({ title: t('nav.settings') });
}

onShow(() => {
  syncNavigationTitle();
});

watch(() => locale.value, () => {
  syncNavigationTitle();
}, { immediate: true });

function toggle(key: 'enabled' | 'soundEnabled' | 'vibrateEnabled') {
  const updates: Record<string, boolean> = {};
  updates[key] = !reminderConfig.value[key];
  store.updateReminderConfig(updates);
}

function togglePhotoMode() {
  store.updateDailyPhotoConfig({
    enabled: !dailyPhotoConfig.value.enabled,
  });
}

function toggleRequireDaily() {
  store.updateDailyPhotoConfig({
    requireDaily: !dailyPhotoConfig.value.requireDaily,
  });
}

function pickAdvanceMinutes() {
  uni.showActionSheet({
    itemList: advanceMinuteOptions.map((value) => t('settings.minutesOption', { count: value })),
    success: (res) => {
      store.updateReminderConfig({
        advanceMinutes: advanceMinuteOptions[res.tapIndex],
      });
    },
  });
}

function pickLanguage() {
  const options = [
    { label: t('settings.simplifiedChinese'), value: 'zh-Hans' as const },
    { label: t('settings.english'), value: 'en' as const },
  ];

  uni.showActionSheet({
    itemList: options.map(option => option.label),
    success: (res) => {
      const selected = options[res.tapIndex];
      if (!selected || selected.value === getAppLocale()) return;
      setAppLocale(selected.value);
      syncNavigationTitle();
      uni.showToast({ title: t('settings.languageChanged'), icon: 'success' });
    },
  });
}

function exportData() {
  try {
    const data = {
      medications: store.medications,
      intakeLogs: store.intakeLogs,
      reminderConfig: store.reminderConfig,
      dailyPhotoConfig: store.dailyPhotoConfig,
      dailyPhotoLogs: store.dailyPhotoLogs,
      exportDate: new Date().toISOString(),
    };
    const content = JSON.stringify(data, null, 2);

    // #ifdef APP-PLUS
    const fileName = `medreminder_backup_${Date.now()}.json`;
    const filePath = `_documents/${fileName}`;
    plus.io.resolveLocalFileSystemURL(
      filePath,
      (entry: any) => {
        (entry as any).createWriter((writer: any) => {
          writer.onwrite = () => {
            uni.showToast({ title: t('settings.exportSuccess'), icon: 'success' });
          };
          writer.write(content);
        });
      },
      () => {
        uni.showToast({ title: t('settings.exportFailed'), icon: 'none' });
      }
    );
    // #endif

    // #ifdef H5
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medreminder_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    uni.showToast({ title: t('settings.exportSuccess'), icon: 'success' });
    // #endif
  } catch (e) {
    uni.showToast({ title: t('settings.exportFailed'), icon: 'none' });
  }
}

function clearAllData() {
  uni.showModal({
    title: t('settings.clearConfirmTitle'),
    content: t('settings.clearConfirmContent'),
    confirmText: t('settings.clearConfirmAction'),
    confirmColor: '#D32F2F',
    success: async (res) => {
      if (res.confirm) {
        uni.clearStorageSync();
        await clearAllImageData();
        store.loadFromStorage();
        uni.showToast({ title: t('settings.dataCleared'), icon: 'success' });
      }
    },
  });
}
</script>

<style scoped>
/* ═══ 设置页 — 北欧极简风格 ═══ */

.settings-page { background: #161B22; min-height: 100vh; }
.container { padding: 24rpx; padding-bottom: 100rpx; }

/* ── 用户卡片（赛博朋克渐变）── */
.profile-card {
  background: linear-gradient(135deg, #0A0E27 0%, #1a1f3a 50%, #0f1535 100%);
  border: 2rpx solid rgba(0, 217, 255, 0.2);
  box-shadow: 0 0 20px rgba(0, 217, 255, 0.15);
  position: relative;
  overflow: hidden;
}

.profile-info { display: flex; align-items: center; gap: 24rpx; position: relative; z-index: 1; }

.avatar {
  width: 96rpx; height: 96rpx; border-radius: 50%;
  background: rgba(0, 217, 255, 0.12); border: 2rpx solid #00D9FF;
  display: flex; align-items: center; justify-content: center; font-size: 46rpx;
  box-shadow: 0 0 15px rgba(0, 217, 255, 0.3);
}
.profile-name { color: #00D9FF; font-size: 34rpx; font-weight: 900; display: block; letter-spacing: 1rpx; text-transform: uppercase; font-family: 'Courier New', monospace; }
.profile-desc { color: #B0B8D4; font-size: 24rpx; }

/* ── 设置项 ── */
.setting-item { display: flex; justify-content: space-between; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid rgba(0, 217, 255, 0.1); transition: all 0.2s ease-out; }
.setting-item:last-child { border-bottom: none; }
.setting-item:active { background: rgba(0, 217, 255, 0.05); }
.setting-label { font-size: 30rpx; color: #FFFFFF; }
.setting-value { font-size: 26rpx; color: #B0B8D4; }
.setting-arrow { font-size: 34rpx; color: #00D9FF; }
.danger-item { padding-top: 16rpx; border-top: 1rpx solid rgba(255, 0, 110, 0.2); }

/* ── 开关 — 赛博切换 ── */
.toggle-switch {
  width: 76rpx; height: 44rpx; border-radius: 33rpx;
  background: rgba(15, 21, 53, 0.8); border: 2rpx solid rgba(0, 217, 255, 0.2);
  padding: 3rpx; position: relative; transition: all 0.3s ease-out;
}
.toggle-switch.on {
  background: rgba(0, 255, 65, 0.15); border-color: #00FF41;
  box-shadow: 0 0 15px rgba(0, 255, 65, 0.3);
}
.toggle-knob {
  width: 36rpx; height: 36rpx; border-radius: 50%;
  background: #B0B8D4; transition: all 0.3s ease-out;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
}
.toggle-switch.on .toggle-knob {
  transform: translateX(32rpx);
  background: #00FF41;
  box-shadow: 0 0 12px rgba(0, 255, 65, 0.5);
}

/* ── 选择器 ── */
.picker-value { display: flex; align-items: center; gap: 10rpx; color: #00D9FF; font-size: 28rpx; font-weight: 700; font-family: 'Courier New', monospace; }

/* ── 每日拍照设置 ── */
.setting-hint {
  color: #8892A0;
  font-size: 24rpx;
  display: block;
  margin-bottom: 16rpx;
  line-height: 1.6;
}

.photo-mode-info {
  background: rgba(0, 217, 255, 0.08);
  border: 1rpx solid rgba(0, 217, 255, 0.2);
  border-radius: 9rpx;
  padding: 16rpx;
  margin-top: 16rpx;
  color: #B0B8D4;
}

.info-text {
  font-size: 26rpx;
  font-weight: 700;
  color: #00D9FF;
  display: block;
  margin-bottom: 10rpx;
}

.info-item {
  font-size: 24rpx;
  color: #8892A0;
  display: block;
  line-height: 1.8;
  margin-left: 4rpx;
}

/* ── 嵌套设置（缩进） ── */
.nested-settings {
  margin-top: 12rpx;
  padding-left: 0;
}

.setting-item.indent {
  padding-left: 28rpx;
  border-left: 2rpx solid rgba(0, 217, 255, 0.15);
}

.info-section {
  margin-top: 10rpx;
}

.picker-arrow { font-size: 34rpx; color: #FF006E; }

/* ── 技术卡片（等宽标签）── */
.tech-card {
  background: rgba(20, 28, 60, 0.6);
  border-color: rgba(0, 217, 255, 0.2);
}
.tech-item { display: flex; justify-content: space-between; padding: 16rpx 0; border-bottom: 1rpx solid rgba(0, 217, 255, 0.1); }
.tech-item:last-child { border-bottom: none; }
.tech-label { font-size: 26rpx; color: #B0B8D4; font-family: 'Courier New', monospace; }
.tech-value { font-size: 26rpx; color: #00D9FF; font-weight: 700; font-family: 'Courier New', monospace; }
</style>
