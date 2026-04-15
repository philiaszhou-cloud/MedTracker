<template>
  <view class="home-page">
    <!-- 自定义导航栏 -->
    <view class="nav-bar">
      <view class="nav-bar-inner">
        <view class="nav-title-group">
          <text class="nav-title">●  Medtracker</text>
          <text class="nav-subtitle">{{ todayLabel }}</text>
        </view>
        <view class="nav-actions">
          <view class="lang-toggle-chip" @tap="toggleLanguage">
            <text class="lang-toggle-text">{{ languageToggleLabel }}</text>
          </view>
          <view v-if="hasUntakenToday" class="nav-warning-chip">
            <view class="nav-warning-dot"></view>
            <text class="nav-warning-text">{{ t('home.untakenChip') }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="container">
      <view v-if="hasUntakenToday" class="pending-alert-banner">
        <view class="pending-alert-icon">!</view>
        <view class="pending-alert-content">
          <text class="pending-alert-title">{{ t('home.pendingAlertTitle', { count: pendingReminderCount }) }}</text>
          <text class="pending-alert-desc">{{ pendingReminderHint }}</text>
        </view>
      </view>

      <!-- 今日概览卡片 -->
      <view class="overview-card card">
        <view class="overview-header">
          <text class="card-title">{{ t('home.todayMedication') }}</text>
          <view class="overview-stats">
            <text class="stats-text">{{ todayTakenCount }} / {{ todayTotalCount }}</text>
          </view>
        </view>
        <!-- 进度条 -->
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
        </view>
        <text class="progress-text text-muted text-small">
          {{ progressText }}
        </text>
      </view>

      <!-- 快捷操作 -->
      <view class="quick-actions">
        <view class="action-btn action-camera" @tap="goToRecognize">
          <view class="action-icon-box">◌</view>
          <text class="action-text">{{ t('home.cameraRecord') }}</text>
        </view>
        <view class="action-btn action-add" @tap="goToAddMedication">
          <view class="action-icon-box">＋</view>
          <text class="action-text">{{ t('home.addMedication') }}</text>
        </view>
        <view class="action-btn action-list" @tap="goToMedicationList">
          <view class="action-icon-box">☰</view>
          <text class="action-text">{{ t('home.medicationList') }}</text>
        </view>
      </view>

      <!-- 每日拍照功能开关 -->
      <view class="card daily-photo-setting-card">
        <view class="setting-header">
          <text class="card-title">{{ t('home.dailyPhotoRecord') }}</text>
          <view class="toggle-switch" :class="{ on: dailyPhotoConfig.enabled }" @tap="toggleDailyPhotoMode">
            <view class="toggle-knob"></view>
          </view>
        </view>
        
        <view v-if="!dailyPhotoConfig.enabled" class="setting-hint">
          <text>{{ t('home.dailyPhotoSettingHint') }}</text>
        </view>

        <view v-else class="setting-details">
          <view class="detail-item">
            <text class="detail-label">{{ t('home.requirePhoto') }}：</text>
            <text class="detail-value" :class="{ 'text-warning': dailyPhotoConfig.requireDaily }">
              {{ dailyPhotoConfig.requireDaily ? t('home.requirePhotoYes') : t('home.requirePhotoNo') }}
            </text>
          </view>
          <view class="detail-item">
            <text class="detail-label">{{ t('home.todayStatus') }}：</text>
            <text class="detail-value" :class="{ 'text-success': todayPhotoStatus, 'text-muted': !todayPhotoStatus }">
              {{ todayPhotoStatus ? t('home.photographed') : t('home.notPhotographed') }}
            </text>
          </view>
          <view class="toggle-row">
            <text class="toggle-label">{{ t('home.forceMode') }}</text>
            <view class="toggle-switch small" :class="{ on: dailyPhotoConfig.requireDaily }" @tap="toggleRequireDaily">
              <view class="toggle-knob"></view>
            </view>
          </view>
        </view>
      </view>

      <!-- 每日拍照记录卡片 -->
      <view v-if="dailyPhotoConfig.enabled" class="card daily-photo-card" :class="{ 'photo-completed': todayPhotoStatus && todayPhotoStatus.status === 'completed', 'photo-mismatch': todayPhotoStatus && todayPhotoStatus.status === 'mismatch' }">
        <view class="photo-header">
          <text class="card-title">{{ t('home.dailyPhotoValidation') }}</text>
        </view>
        
        <view v-if="!todayPhotoStatus" class="photo-pending">
          <text class="photo-status-text">{{ t('home.noPhotoToday') }}</text>
          <text class="photo-hint">{{ t('home.photoHint') }}</text>
          <view class="btn-photo-record" @tap="goToDailyPhotoRecord">
            <text>{{ t('home.takePhotoNow') }}</text>
          </view>
        </view>

        <view v-else class="photo-result">
          <view class="result-row">
            <text class="result-label">{{ t('home.expectedCount') }}：</text>
            <text class="result-value">{{ todayPhotoStatus.expectedCount }} {{ t('common.pillsUnit') }}</text>
          </view>
          <view class="result-row">
            <text class="result-label">{{ t('home.photographedCount') }}：</text>
            <text class="result-value" :class="{ 'text-success': todayPhotoStatus.status === 'completed', 'text-danger': todayPhotoStatus.status === 'mismatch' }">
              {{ todayPhotoStatus.pillCount }} {{ t('common.pillsUnit') }}
            </text>
          </view>
          <view class="status-badge" :class="'status-' + todayPhotoStatus.status">
            <text v-if="todayPhotoStatus.status === 'completed'">{{ t('home.validationSuccess') }}</text>
            <text v-else-if="todayPhotoStatus.status === 'mismatch'">{{ t('home.validationMismatch') }}</text>
          </view>
          <view class="btn-photo-retake" @tap="goToDailyPhotoRecord">
            <text>{{ t('home.retakePhoto') }}</text>
          </view>
        </view>
      </view>

      <!-- 库存预警 -->
      <view v-if="stockAlerts.length > 0" class="card alert-card">
        <view class="card-title text-danger">{{ t('home.stockAlert') }}</view>
        <view v-for="alert in stockAlerts" :key="alert.medicationId" class="alert-item">
          <text class="alert-name">{{ alert.medicationName }}</text>
          <text class="alert-info">{{ formatStockAlertInfo(alert.stockCount, alert.daysRemaining) }}</text>
        </view>
      </view>

      <!-- 今日待办提醒 -->
      <view class="card">
        <view class="card-title">{{ t('home.todayReminders') }}</view>
        <view v-if="todayReminders.length === 0" class="empty-state-mini">
          <text class="text-muted">{{ t('home.noReminders') }}</text>
        </view>
        <view v-for="(reminder, index) in todayReminders" :key="index" class="reminder-item" :class="{ done: reminder.status === 'done' }">
          <view class="reminder-left">
            <view class="reminder-time">
              <text class="time-text" :class="{ 'time-past': reminder.status === 'done' }">{{ reminder.scheduledTime }}</text>
            </view>
            <view class="reminder-info">
              <text class="reminder-name">{{ reminder.medicationName }}</text>
              <text class="reminder-dosage text-muted text-small">{{ reminder.dosage }}</text>
            </view>
          </view>
          <view class="reminder-right">
            <view v-if="reminder.status === 'done'" class="reminder-status taken">
              <text>✓</text>
            </view>
            <view v-else class="btn-take" @tap="confirmTake(reminder)">
              <text>{{ t('home.takeMedication') }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { useMedStore } from '../../stores/index';
import { formatTodayLabel, getAppLocale, setAppLocale } from '../../i18n';

const store = useMedStore();
const { t, locale } = useI18n();

const todayLabel = computed(() => {
  locale.value;
  return formatTodayLabel(getAppLocale());
});
const todayTakenCount = computed(() => store.todayTakenCount);
const todayTotalCount = computed(() => store.todayTotalCount);
const stockAlerts = computed(() => store.stockAlerts);
const todayReminders = computed(() => store.todayReminders);
const dailyPhotoConfig = computed(() => store.dailyPhotoConfig);
const todayPhotoStatus = computed(() => store.todayPhotoStatus);
const pendingReminders = computed(() =>
  todayReminders.value.filter(reminder => reminder.status === 'pending')
);
const pendingReminderCount = computed(() => pendingReminders.value.length);
const hasUntakenToday = computed(() => todayTotalCount.value > 0 && pendingReminderCount.value > 0);
const languageToggleLabel = computed(() => locale.value === 'en' ? '中文' : 'EN');
const pendingReminderHint = computed(() => {
  if (pendingReminders.value.length === 0) {
    return t('home.pendingAlertAllDone');
  }

  const nextReminder = pendingReminders.value[0];
  return t('home.pendingHint', {
    name: nextReminder.medicationName,
    time: nextReminder.scheduledTime,
  });
});

const progressPercent = computed(() => {
  if (todayTotalCount.value === 0) return 0;
  return Math.round((todayTakenCount.value / todayTotalCount.value) * 100);
});

const progressText = computed(() => {
  if (progressPercent.value === 100) {
    return t('home.progressDone');
  }

  return t('home.progressPending', {
    count: todayTotalCount.value - todayTakenCount.value,
  });
});

onShow(() => {
  // 每次页面显示时刷新数据
  store.loadFromStorage();
});

function toggleDailyPhotoMode() {
  store.updateDailyPhotoConfig({
    enabled: !dailyPhotoConfig.value.enabled,
  });
}

function toggleRequireDaily() {
  store.updateDailyPhotoConfig({
    requireDaily: !dailyPhotoConfig.value.requireDaily,
  });
}

function goToRecognize() {
  store.setRecognizeMode('default');
  uni.switchTab({ url: '/pages/recognize/index' });
}

function goToDailyPhotoRecord() {
  // 识别页在 tabBar 中，不能用 navigateTo 传 query；改为通过 store 传递临时模式
  store.setRecognizeMode('daily');
  uni.switchTab({ url: '/pages/recognize/index' });
}

function goToAddMedication() {
  uni.navigateTo({ url: '/pages/medication/add' });
}

function goToMedicationList() {
  uni.switchTab({ url: '/pages/medication/list' });
}

function toggleLanguage() {
  const nextLocale = locale.value === 'en' ? 'zh-Hans' : 'en';
  setAppLocale(nextLocale);
}

function formatStockAlertInfo(count: number, days: number) {
  if (locale.value === 'en') {
    return `${count} pills left, about ${days} days remaining`;
  }
  return `剩余 ${count} 片，约 ${days} 天`;
}

const confirmingMedId = ref('');

function confirmTake(reminder: { medicationId: string; medicationName: string; dosage: string; scheduledTime: string }) {
  if (confirmingMedId.value === reminder.medicationId) return;
  confirmingMedId.value = reminder.medicationId;
  // 如果启用了每日拍照模式，检查是否已完成拍照
  if (dailyPhotoConfig.value.enabled) {
    if (!todayPhotoStatus.value) {
      uni.showModal({
        title: t('home.needDailyPhotoTitle'),
        content: t('home.needDailyPhotoContent'),
        confirmText: t('home.goTakePhoto'),
        success: (res) => {
          if (res.confirm) {
            goToDailyPhotoRecord();
          }
          confirmingMedId.value = '';
        },
      });
      return;
    }
    
    // 如果拍照数量不符，提示但允许继续记录
    if (todayPhotoStatus.value.status === 'mismatch') {
      // 如果启用了强制拍照模式，则不允许继续记录，必须重新拍照
      if (dailyPhotoConfig.value.requireDaily) {
        uni.showModal({
          title: t('home.mismatchTitle'),
          content: t('home.mismatchForceContent', {
            expected: todayPhotoStatus.value.expectedCount,
            actual: todayPhotoStatus.value.pillCount,
          }),
          showCancel: false,
          confirmText: t('home.goTakePhoto'),
          success: (res) => {
            if (res.confirm) goToDailyPhotoRecord();
            confirmingMedId.value = '';
          },
        });
        return;
      }

      uni.showModal({
        title: t('home.mismatchTitle'),
        content: t('home.mismatchContinueContent', {
          expected: todayPhotoStatus.value.expectedCount,
          actual: todayPhotoStatus.value.pillCount,
        }),
        confirmText: t('common.continue'),
        cancelText: t('home.retakePhoto'),
        success: (res) => {
          if (res.confirm) {
            recordIntakeConfirmed(reminder);
          } else {
            goToDailyPhotoRecord();
          }
          confirmingMedId.value = '';
        },
      });
      return;
    }
  }

  recordIntakeConfirmed(reminder);
}

function recordIntakeConfirmed(reminder: { medicationId: string; medicationName: string; dosage: string; scheduledTime: string }) {
  uni.showModal({
    title: t('home.confirmTakeTitle'),
    content: t('home.confirmTakeContent', { name: reminder.medicationName, dosage: reminder.dosage }),
    confirmText: t('home.takenConfirm'),
    confirmColor: '#1976D2',
    cancelText: t('home.laterReminder'),
    success: (res) => {
      if (res.confirm) {
        store.recordIntake(reminder.medicationId, 'taken', reminder.scheduledTime);
        uni.showToast({ title: t('home.takenRecorded'), icon: 'success' });
        speakText(`已记录服用${reminder.medicationName}`);
      }
      confirmingMedId.value = '';
    },
    fail: () => {
      confirmingMedId.value = '';
    },
  });
}

function speakText(text: string) {
  // #ifdef APP-PLUS
  try {
    const TTS = (plus.speech as any).createSpeechListener(15000);
    TTS.startSpeech({ text, locale: 'zh-CN' });
  } catch (e) {
    // console.log('语音播报不可用');
  }
  // #endif
}
</script>

<style scoped>
.home-page {
  background: #080810;
  min-height: 100vh;
  background: linear-gradient(135deg, #080810 0%, #0d1020 50%, #080812 100%);
}

/* ── 赛博朋克导航栏 ── */
.nav-bar {
  background: linear-gradient(180deg, #080810 0%, #0d1020 60%, #080810 100%);
  padding: 56rpx 32rpx 32rpx;
  padding-top: calc(var(--status-bar-height, 44rpx) + 16rpx);
  position: relative;
  overflow: hidden;
  border-bottom: 2rpx solid rgba(0, 240, 255, 0.15);
}

.nav-bar::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, #00F0FF, transparent);
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);
}

.nav-bar-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 1;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.lang-toggle-chip {
  min-width: 76rpx;
  height: 44rpx;
  padding: 0 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  border: 1rpx solid rgba(0, 240, 255, 0.3);
  background: rgba(0, 240, 255, 0.08);
  box-shadow: 0 0 16rpx rgba(0, 240, 255, 0.08);
}

.lang-toggle-text {
  color: #00F0FF;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.nav-title-group {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.nav-title {
  color: #00F0FF;
  font-size: 44rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
  text-shadow: 0 0 20px rgba(0, 240, 255, 0.6);
  text-transform: uppercase;
  font-family: 'Courier New', monospace;
}

.nav-subtitle {
  color: #B0B8D4;
  font-size: 26rpx;
  letter-spacing: 1rpx;
  font-family: 'Courier New', monospace;
}

.nav-warning-chip {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  border: 2rpx solid rgba(255, 122, 89, 0.55);
  background: rgba(255, 94, 58, 0.14);
  box-shadow: 0 0 22rpx rgba(255, 94, 58, 0.18);
}

.nav-warning-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #FF6B57;
  box-shadow: 0 0 14rpx rgba(255, 107, 87, 0.75);
}

.nav-warning-text {
  color: #FFD2CC;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.container {
  padding: 24rpx;
  padding-bottom: 140rpx;
}

.pending-alert-banner {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-bottom: 24rpx;
  padding: 22rpx 20rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, rgba(255, 94, 58, 0.2) 0%, rgba(255, 153, 0, 0.12) 100%);
  border: 2rpx solid rgba(255, 122, 89, 0.45);
  box-shadow: 0 0 28rpx rgba(255, 94, 58, 0.16);
}

.pending-alert-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #FF5E3A;
  color: #FFF4EE;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  font-weight: 900;
  box-shadow: 0 0 22rpx rgba(255, 94, 58, 0.45);
}

.pending-alert-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.pending-alert-title {
  color: #FFE3DB;
  font-size: 30rpx;
  font-weight: 800;
}

.pending-alert-desc {
  color: #FFC5B8;
  font-size: 24rpx;
  line-height: 1.5;
}

/* ── 概览卡片 ── */
.overview-card {
  margin-top: 0;
  position: relative;
  z-index: 1;
  border-color: rgba(0, 240, 255, 0.25);
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.12);
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18rpx;
}

.overview-stats {
  background: rgba(0, 240, 255, 0.08);
  border-radius: 12rpx;
  padding: 8rpx 16rpx;
  border: 1.5rpx solid rgba(0, 240, 255, 0.25);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.15);
}

.stats-text {
  color: #00F0FF;
  font-size: 28rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
  font-family: 'Courier New', monospace;
}

.progress-bar {
  height: 12rpx;
  background: rgba(8, 12, 22, 0.8);
  border-radius: 12rpx;
  overflow: hidden;
  margin-bottom: 14rpx;
  border: 1.5rpx solid rgba(0, 240, 255, 0.15);
  box-shadow: inset 0 0 10px rgba(0, 240, 255, 0.08);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00FF88, #00F0FF);
  border-radius: 12rpx;
  transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 15px rgba(0, 255, 136, 0.5), 0 0 8px rgba(0, 240, 255, 0.35);
}

.progress-text {
  color: #B0B8D4 !important;
}

/* ── 快捷操作按钮（赛博霓虹）── */
.quick-actions {
  display: flex;
  gap: 14rpx;
  margin-bottom: 24rpx;
}

.action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(14, 18, 30, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 18rpx;
  padding: 24rpx 12rpx;
  border: 2rpx solid var(--btn-color, rgba(0, 240, 255, 0.15));
  transition: all 0.2s ease-out;
  position: relative;
  overflow: hidden;
}

.action-btn::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--btn-color, #00F0FF), transparent);
  opacity: 0;
  transition: opacity 0.2s ease-out;
}

.action-btn:active {
  transform: scale(0.95);
  background: rgba(var(--btn-rgb, 0, 240, 255), 0.12);
  border-color: var(--btn-color, #00F0FF);
  box-shadow: 0 0 20px var(--btn-glow, rgba(0, 240, 255, 0.35));
}

.action-btn:active::before {
  opacity: 1;
}

.action-camera {
  --btn-color: #00F0FF;
  --btn-rgb: 0, 240, 255;
  --btn-glow: rgba(0, 240, 255, 0.35);
}

.action-add {
  --btn-color: #FF00AA;
  --btn-rgb: 255, 0, 170;
  --btn-glow: rgba(255, 0, 170, 0.35);
}

.action-list {
  --btn-color: #FF00AA;
  --btn-rgb: 255, 0, 170;
  --btn-glow: rgba(255, 0, 170, 0.35);
}

.action-icon {
  font-size: 52rpx;
  margin-bottom: 8rpx;
  line-height: 1;
  font-weight: 700;
}

.action-icon-box {
  font-size: 52rpx;
  margin-bottom: 8rpx;
  line-height: 1;
  font-weight: 700;
  color: #00F0FF;
}

.action-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #B0BEC5;
}

/* ── 预警卡片（柔和珊瑚）── */
.alert-card {
  border-left: 5rpx solid #E57373 !important;
  background: rgba(229, 115, 115, 0.04) !important;
  border-color: rgba(229, 115, 115, 0.12) !important;
  box-shadow: 0 0 20rpx rgba(229, 115, 115, 0.03) !important;
}

.alert-card .card-title {
  color: #E57373;
}

.alert-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14rpx 0;
}

.alert-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #E8EAED;
}

.alert-info {
  font-size: 28rpx;
  color: #E57373;
}

/* ── 提醒列表（赛博朋克风格）── */
.empty-state-mini {
  padding: 40rpx 0;
  text-align: center;
  color: #5C708A;
}

.reminder-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22rpx 16rpx;
  border-bottom: 1rpx solid rgba(0, 240, 255, 0.06);
  transition: all 150ms ease;
  border-radius: 12rpx;
  margin-bottom: 6rpx;
}

.reminder-item:last-child { border-bottom: none; }

.reminder-item.done {
  opacity: 0.35;
}

.reminder-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.reminder-time {
  width: 120rpx;
  text-align: center;
}

.time-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #00F0FF;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.35);
  font-family: 'SF Mono', 'Courier New', monospace;
}

.time-past {
  color: #8892A0;
}

.reminder-info {
  margin-left: 18rpx;
}

.reminder-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #E8EAED;
  display: block;
}

.reminder-dosage {
  font-size: 26rpx;
  color: #8892A0;
}

.reminder-right {
  margin-left: 18rpx;
}

.btn-take {
  background: rgba(0, 255, 136, 0.1);
  color: #00FF88;
  padding: 12rpx 28rpx;
  border-radius: 27rpx;
  font-size: 28rpx;
  font-weight: 700;
  border: 1.5rpx solid rgba(0, 255, 136, 0.3);
  transition: all 200ms ease;
  box-shadow: 0 0 8px rgba(0, 255, 136, 0.1);
}

.btn-take:active {
  background: rgba(0, 255, 136, 0.22);
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
  transform: scale(0.95);
}

.reminder-status {
  font-size: 34rpx;
}

/* ── 每日拍照记录卡片 ── */
.daily-photo-card {
  background: rgba(14, 18, 30, 0.6);
  border: 2rpx solid rgba(0, 240, 255, 0.25);
  transition: all 0.3s ease-out;
}

/* ═══ 每日拍照功能开关卡片 ═══ */
.daily-photo-setting-card {
  background: linear-gradient(135deg, rgba(0, 240, 255, 0.06) 0%, rgba(255, 0, 170, 0.04) 100%);
  border: 2rpx solid rgba(0, 240, 255, 0.2);
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.08);
}

.setting-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.setting-header .card-title {
  flex: 1;
  margin: 0;
}

.toggle-switch {
  width: 60rpx;
  height: 32rpx;
  background: rgba(0, 240, 255, 0.1);
  border-radius: 16rpx;
  border: 1rpx solid rgba(0, 240, 255, 0.15);
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
}

.toggle-switch.on {
  background: rgba(0, 255, 136, 0.2);
  border-color: rgba(0, 255, 136, 0.4);
  box-shadow: 0 0 12px rgba(0, 255, 136, 0.3);
}

.toggle-knob {
  width: 28rpx;
  height: 28rpx;
  background: #00F0FF;
  border-radius: 50%;
  position: absolute;
  left: 2rpx;
  transition: all 0.3s ease;
  box-shadow: 0 0 6px rgba(0, 240, 255, 0.5);
}

.toggle-switch.on .toggle-knob {
  left: 30rpx;
  background: #00FF88;
  box-shadow: 0 0 8px rgba(0, 255, 136, 0.6);
}

.toggle-switch.small {
  width: 50rpx;
  height: 28rpx;
}

.toggle-switch.small .toggle-knob {
  width: 24rpx;
  height: 24rpx;
}

.toggle-switch.small.on .toggle-knob {
  left: 24rpx;
}

.setting-hint {
  font-size: 26rpx;
  color: #8892A0;
  line-height: 1.6;
}

.setting-details {
  margin-top: 12rpx;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10rpx 0;
  border-bottom: 1rpx solid rgba(0, 240, 255, 0.08);
  font-size: 24rpx;
}

.detail-item:last-of-type {
  border-bottom: none;
}

.detail-label {
  color: #5C708A;
  font-weight: 600;
}

.detail-value {
  color: #00F0FF;
  font-weight: 700;
  font-family: 'Courier New', monospace;
}

.detail-value.text-success {
  color: #00FF88;
  text-shadow: 0 0 8px rgba(0, 255, 136, 0.4);
}

.detail-value.text-warning {
  color: #FFB74D;
  text-shadow: 0 0 8px rgba(255, 183, 77, 0.3);
}

.detail-value.text-muted {
  color: #5C708A;
}

.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14rpx 0;
  margin-top: 8rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid rgba(0, 240, 255, 0.08);
}

.toggle-label {
  font-size: 26rpx;
  color: #8892A0;
  font-weight: 600;
}

.daily-photo-card {
  background: rgba(14, 18, 30, 0.6);
  border: 2rpx solid rgba(0, 240, 255, 0.25);
  transition: all 0.3s ease-out;
}

.daily-photo-card.photo-completed {
  border-color: rgba(0, 255, 136, 0.5);
  background: rgba(0, 255, 136, 0.08);
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.2);
}

.daily-photo-card.photo-mismatch {
  border-color: rgba(255, 183, 77, 0.5);
  background: rgba(255, 183, 77, 0.08);
  box-shadow: 0 0 20px rgba(255, 183, 77, 0.15);
}

.photo-header {
  margin-bottom: 16rpx;
}

.photo-pending {
  text-align: center;
  padding: 20rpx 0;
}

.photo-status-text {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #00F0FF;
  margin-bottom: 8rpx;
}

.photo-hint {
  display: block;
  font-size: 26rpx;
  color: #8892A0;
  margin-bottom: 16rpx;
}

.btn-photo-record {
  background: rgba(0, 240, 255, 0.1);
  border: 2rpx solid #00F0FF;
  color: #00F0FF;
  border-radius: 9rpx;
  padding: 14rpx 24rpx;
  font-size: 28rpx;
  font-weight: 700;
  text-align: center;
  display: inline-block;
  margin-top: 12rpx;
  transition: all 0.2s ease-out;
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.25);
}

.btn-photo-record:active {
  background: rgba(0, 240, 255, 0.22);
  box-shadow: 0 0 30px rgba(0, 240, 255, 0.55);
  transform: scale(0.95);
}

.photo-result {
  padding: 12rpx 0;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: 1rpx solid rgba(0, 240, 255, 0.08);
}

.result-row:last-child {
  border-bottom: none;
  margin-bottom: 12rpx;
}

.result-label {
  font-size: 26rpx;
  color: #B0B8D4;
  font-weight: 600;
}

.result-value {
  font-size: 30rpx;
  color: #00F0FF;
  font-weight: 700;
  font-family: 'Courier New', monospace;
}

.status-badge {
  background: rgba(0, 255, 136, 0.12);
  border: 1.5rpx solid #00FF88;
  color: #00FF88;
  border-radius: 9rpx;
  padding: 10rpx 16rpx;
  font-size: 26rpx;
  font-weight: 700;
  text-align: center;
  margin: 14rpx 0;
  box-shadow: 0 0 12px rgba(0, 255, 136, 0.2);
}

.status-badge.status-mismatch {
  background: rgba(255, 183, 77, 0.12);
  border-color: rgba(255, 183, 77, 0.8);
  color: rgba(255, 183, 77, 0.9);
  box-shadow: 0 0 12px rgba(255, 183, 77, 0.15);
}

.btn-photo-retake {
  background: rgba(255, 102, 0, 0.12);
  border: 2rpx solid #FF6600;
  color: #FF6600;
  border-radius: 9rpx;
  padding: 12rpx 20rpx;
  font-size: 26rpx;
  font-weight: 700;
  text-align: center;
  display: block;
  margin-top: 12rpx;
  transition: all 0.2s ease-out;
}

.btn-photo-retake:active {
  background: rgba(255, 102, 0, 0.2);
  box-shadow: 0 0 20px rgba(255, 102, 0, 0.4);
  transform: scale(0.95);
}
</style>
