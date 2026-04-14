<template>
  <view class="settings-page">
    <view class="container">
      <!-- 用户信息卡片 -->
      <view class="card profile-card">
        <view class="profile-info">
          <view class="avatar">⊙</view>
          <view class="profile-text">
            <text class="profile-name">用药助手用户</text>
            <text class="profile-desc">MedReminder AI v1.0</text>
          </view>
        </view>
      </view>

      <!-- 提醒设置 -->
      <view class="card">
        <text class="card-title">⌛ 提醒设置</text>

        <view class="setting-item">
          <text class="setting-label">用药提醒</text>
          <view class="toggle-switch" :class="{ on: reminderConfig.enabled }" @tap="toggle('enabled')">
            <view class="toggle-knob"></view>
          </view>
        </view>

        <view class="setting-item">
          <text class="setting-label">提醒声音</text>
          <view class="toggle-switch" :class="{ on: reminderConfig.soundEnabled }" @tap="toggle('soundEnabled')">
            <view class="toggle-knob"></view>
          </view>
        </view>

        <view class="setting-item">
          <text class="setting-label">震动提醒</text>
          <view class="toggle-switch" :class="{ on: reminderConfig.vibrateEnabled }" @tap="toggle('vibrateEnabled')">
            <view class="toggle-knob"></view>
          </view>
        </view>

        <view class="setting-item">
          <text class="setting-label">提前提醒</text>
          <view class="picker-value" @tap="pickAdvanceMinutes">
            <text>{{ reminderConfig.advanceMinutes }} 分钟</text>
            <text class="picker-arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 每日拍照记录设置 -->
      <view class="card">
        <text class="card-title">📸 每日拍照记录</text>
        <text class="setting-hint">启用后，每日拍照验证所有药片</text>

        <view class="setting-item">
          <text class="setting-label">启用每日拍照记录</text>
          <view class="toggle-switch" :class="{ on: dailyPhotoConfig.enabled }" @tap="togglePhotoMode">
            <view class="toggle-knob"></view>
          </view>
        </view>

        <view v-if="dailyPhotoConfig.enabled" class="nested-settings">
          <view class="setting-item indent">
            <text class="setting-label">强制完成拍照校验</text>
            <view class="toggle-switch" :class="{ on: dailyPhotoConfig.requireDaily }" @tap="toggleRequireDaily">
              <view class="toggle-knob"></view>
            </view>
          </view>

          <view class="photo-mode-info">
            <text class="info-text">🎯 {{ dailyPhotoConfig.requireDaily ? '强制模式' : '可选模式' }}：</text>
            <view v-if="!dailyPhotoConfig.requireDaily" class="info-section">
              <text class="info-item">• 每日拍照验证是可选的</text>
              <text class="info-item">• 可以不拍照直接记录服药</text>
              <text class="info-item">• 拍照时会进行数量对比</text>
            </view>
            <view v-else class="info-section">
              <text class="info-item">• 每日拍照验证是强制的</text>
              <text class="info-item">• 未拍照前无法记录服药</text>
              <text class="info-item">• 完成拍照并通过校验后才能继续</text>
              <text class="info-item">• 即使数量不符也可继续（有警告）</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 数据管理 -->
      <view class="card">
        <text class="card-title">💾 数据管理</text>

        <view class="setting-item" @tap="exportData">
          <text class="setting-label">导出数据</text>
          <text class="setting-arrow">›</text>
        </view>

        <view class="setting-item danger-item" @tap="clearAllData">
          <text class="setting-label text-danger">清除所有数据</text>
          <text class="setting-arrow">›</text>
        </view>
      </view>

      <!-- 关于 -->
      <view class="card">
        <text class="card-title">ℹ️ 关于</text>

        <view class="setting-item">
          <text class="setting-label">版本号</text>
          <text class="setting-value text-muted">1.0.0</text>
        </view>

        <view class="setting-item">
          <text class="setting-label">隐私说明</text>
          <text class="setting-arrow">›</text>
        </view>

        <view class="info-text mt-20">
          <text class="text-muted text-small">
            MedReminder AI 是一款本地化的用药管理应用。您的所有数据（包括药品信息、服药记录、拍照图像）均存储在本地设备上，不会上传至任何服务器。
          </text>
        </view>
      </view>

      <!-- 技术说明 -->
      <view class="card tech-card">
        <text class="card-title">🛠️ 技术说明</text>
        <view class="tech-item">
          <text class="tech-label">开发框架</text>
          <text class="tech-value">uni-app (Vue 3 + TypeScript)</text>
        </view>
        <view class="tech-item">
          <text class="tech-label">状态管理</text>
          <text class="tech-value">Pinia</text>
        </view>
        <view class="tech-item">
          <text class="tech-label">数据存储</text>
          <text class="tech-value">本地 Storage (离线优先)</text>
        </view>
        <view class="tech-item">
          <text class="tech-label">AI 识别</text>
          <text class="tech-value">本地模型推理 (TFLite/TF.js)</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useMedStore } from '../../stores/index';
import { clearAllImageData } from '../../utils/imageStorage';

const store = useMedStore();
const reminderConfig = computed(() => store.reminderConfig);
const dailyPhotoConfig = computed(() => store.dailyPhotoConfig);

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
  const options = ['0 分钟', '5 分钟', '10 分钟', '15 分钟', '30 分钟'];
  uni.showActionSheet({
    itemList: options,
    success: (res) => {
      store.updateReminderConfig({
        advanceMinutes: parseInt(options[res.tapIndex]),
      });
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
            uni.showToast({ title: '导出成功', icon: 'success' });
          };
          writer.write(content);
        });
      },
      () => {
        uni.showToast({ title: '导出失败', icon: 'none' });
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
    uni.showToast({ title: '导出成功', icon: 'success' });
    // #endif
  } catch (e) {
    uni.showToast({ title: '导出失败', icon: 'none' });
  }
}

function clearAllData() {
  uni.showModal({
    title: '⚠️ 确认清除',
    content: '这将删除所有药品信息、服药记录、照片和设置。此操作不可恢复！',
    confirmText: '确认清除',
    confirmColor: '#D32F2F',
    success: async (res) => {
      if (res.confirm) {
        uni.clearStorageSync();
        await clearAllImageData();
        store.loadFromStorage();
        uni.showToast({ title: '数据已清除', icon: 'success' });
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
