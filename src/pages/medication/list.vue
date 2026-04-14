<template>
  <view class="med-list-page">
    <!-- ═══ 赛博朋克导航栏 ═══ -->
    <view class="cyber-nav">
      <!-- 顶部扫描线 -->
      <view class="nav-scanline"></view>
      <view class="cyber-nav-inner">
        <!-- 左侧角标装饰 -->
        <view class="nav-corner nav-corner-left"></view>
        <text class="cyber-nav-title">● 药品库</text>
        <text class="cyber-nav-sub">// MEDICATION_DB</text>
        <view class="nav-corner nav-corner-right"></view>
      </view>
      <!-- 底部发光边条 -->
      <view class="nav-glow-bar"></view>
    </view>

    <view class="container">
      <!-- 搜索栏 -->
      <view class="search-bar">
        <input 
          class="search-input" 
          v-model="searchText" 
          placeholder="∇ 搜索药品名称" 
          placeholder-style="color: #BBB; font-size: 32rpx;"
        />
      </view>

      <!-- 药品列表 -->
      <view v-if="filteredMedications.length > 0">
        <view 
          v-for="med in filteredMedications" 
          :key="med.id" 
          class="card med-card"
          :class="{ inactive: !med.isActive }"
          @tap="goToDetail(med.id)"
        >
          <view class="med-header">
            <view class="med-info">
              <view class="med-name-row">
                <text class="med-name">{{ med.name }}</text>
                <view v-if="!med.isActive" class="tag tag-orange">已停用</view>
                <view v-if="isLowStock(med)" class="tag tag-red">库存不足</view>
              </view>
              <text class="med-spec text-muted text-small">{{ med.specification }} · 每次服 {{ med.dosage }}</text>
            </view>
            <view class="med-stock" :class="{ 'low-stock': isLowStock(med) }">
              <text class="stock-num">{{ med.stockCount }}</text>
              <text class="stock-label">片</text>
            </view>
          </view>

          <view class="med-footer">
            <view class="med-frequency">
              <text class="text-small text-muted">≡ {{ getFrequencyLabel(med.frequency) }}</text>
            </view>
            <view class="med-reminders">
              <text 
                v-for="(time, idx) in med.reminders" 
                :key="idx" 
                class="reminder-time-tag"
              >
                {{ time }}
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty-state">
        <view class="icon">●</view>
        <view class="text">
          <text v-if="searchText">未找到匹配的药品</text>
          <text v-else>还没有添加药品\n点击下方按钮添加您的第一种药品</text>
        </view>
      </view>

      <!-- 添加按钮 -->
      <view class="add-btn" @tap="goToAdd">
        <text class="add-icon">+</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useMedStore } from '../../stores/index';
import { getDailyDosage, calcDaysRemaining } from '../../utils';
import { FREQUENCY_LABELS } from '../../types';
import type { Medication, FrequencyType } from '../../types';

const store = useMedStore();
const searchText = ref('');

// 防抖搜索词：用户停止输入 300ms 后才触发列表过滤
const debouncedSearchText = ref('');
let searchTimer: ReturnType<typeof setTimeout> | null = null;

import { watch } from 'vue';
watch(searchText, (val) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    debouncedSearchText.value = val;
  }, 300);
});

const filteredMedications = computed(() => {
  if (!debouncedSearchText.value.trim()) {
    return store.medications;
  }
  const keyword = debouncedSearchText.value.trim().toLowerCase();
  return store.medications.filter(m => 
    m.name.toLowerCase().includes(keyword)
  );
});

onShow(() => {
  store.loadFromStorage();
});

function isLowStock(med: Medication): boolean {
  const dailyUsage = getDailyDosage(med.frequency, med.dosage);
  const days = calcDaysRemaining(med.stockCount, dailyUsage);
  return days <= 3;
}

function getFrequencyLabel(freq: string): string {
  return FREQUENCY_LABELS[freq as FrequencyType] || freq;
}

function goToAdd() {
  uni.navigateTo({ url: '/pages/medication/add' });
}

function goToDetail(id: string) {
  uni.navigateTo({ url: `/pages/medication/detail?id=${encodeURIComponent(id)}` });
}
</script>

<style scoped>
/* ═══ 赛博朋克药品列表页 ═══ */
.med-list-page {
  background: #0D1117;
  min-height: 100vh;
}

/* ── 赛博导航栏（HUD风格）── */
.cyber-nav {
  position: relative;
  background: linear-gradient(180deg, #0D1117 0%, #131A24 60%, #0D1117 100%);
  padding: 56rpx 32rpx 24rpx;
  padding-top: calc(var(--status-bar-height, 44rpx) + 20rpx);
  overflow: hidden;
  border-bottom: 1rpx solid rgba(0, 229, 255, 0.15);
}

/* 顶部扫描线动画 */
.nav-scanline {
  position: absolute;
  top: 0; left: 0; right: 0; height: 2rpx;
  background: linear-gradient(90deg,
    transparent 0%,
    #00E5FF 20%,
    #B000FF 50%,
    #00E5FF 80%,
    transparent 100%
  );
  box-shadow: 0 0 12rpx rgba(0, 229, 255, 0.6), 0 0 30rpx rgba(176, 0, 255, 0.3);
  animation: cyber-scan-h 3s ease-in-out infinite;
}

@keyframes cyber-scan-h {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.cyber-nav-inner {
  display: flex;
  align-items: center;
  gap: 16rpx;
  position: relative;
  z-index: 1;
}

/* 角标装饰 */
.nav-corner {
  width: 16rpx; height: 16rpx;
  flex-shrink: 0;
}
.nav-corner-left {
  border-top: 3rpx solid #00E5FF;
  border-left: 3rpx solid #00E5FF;
  box-shadow: -2rpx -2rpx 6rpx rgba(0, 229, 255, 0.4);
}
.nav-corner-right {
  margin-left: auto;
  border-bottom: 3rpx solid #B000FF;
  border-right: 3rpx solid #B000FF;
  box-shadow: 2rpx 2rpx 6rpx rgba(176, 0, 255, 0.4);
}

.cyber-nav-title {
  font-size: 40rpx;
  font-weight: 900;
  color: #00E5FF;
  text-transform: uppercase;
  letter-spacing: 4rpx;
  text-shadow:
    0 0 10rpx rgba(0, 229, 255, 0.6),
    0 0 30rpx rgba(0, 229, 255, 0.25),
    0 0 60rpx rgba(0, 229, 255, 0.1);
  font-family: 'Rajdhani', 'Orbitron', sans-serif;
}

.cyber-nav-sub {
  font-size: 20rpx;
  color: #B000FF;
  letter-spacing: 2rpx;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 8rpx rgba(176, 0, 255, 0.4);
  opacity: 0.85;
}

/* 底部霓虹发光条 */
.nav-glow-bar {
  position: absolute;
  bottom: 0; left: 10%; right: 10%;
  height: 2rpx;
  background: linear-gradient(90deg,
    transparent,
    #00E5FF 30%,
    #B000FF 70%,
    transparent
  );
  box-shadow: 0 0 10rpx rgba(0, 229, 255, 0.5), 0 -4rpx 15rpx rgba(176, 0, 255, 0.2);
}

.container {
  padding: 24rpx;
  padding-bottom: 140rpx;
}

/* ── 搜索栏（赛博HUD输入框）── */
.search-bar { margin-bottom: 24rpx; }

.search-input {
  background: rgba(0, 10, 20, 0.8);
  border-radius: 18rpx;
  padding: 22rpx 28rpx;
  font-size: 30rpx;
  color: #00E5FF;
  border: 1rpx solid rgba(0, 229, 255, 0.2);
  box-shadow:
    inset 0 0 15rpx rgba(0, 229, 255, 0.05),
    0 0 12rpx rgba(0, 229, 255, 0.08);
  font-family: 'Courier New', monospace;
  letter-spacing: 1rpx;
}

.search-input::placeholder { color: #3A4A5A; }

/* ── 药品卡片（赛博霓虹边条）── */
.med-card {
  padding: 26rpx;
  transition: all 200ms ease;
  position: relative;
  background: rgba(8, 14, 22, 0.85);
  border: 1rpx solid rgba(0, 229, 255, 0.1);
  border-radius: 9rpx;

  &::before {
    content: '';
    position: absolute;
    left: 0; top: 10%; height: 80%;
    width: 3rpx;
    background: linear-gradient(180deg,
      transparent,
      #00E5FF 25%,
      #B000FF 75%,
      transparent
    );
    box-shadow: 0 0 8rpx rgba(0, 229, 255, 0.5), 0 0 20rpx rgba(176, 0, 255, 0.2);
  }
}

.med-card.inactive { opacity: 0.4; }

.med-card:active {
  background: rgba(0, 229, 255, 0.04);
  border-color: rgba(0, 229, 255, 0.3);
  box-shadow:
    0 0 15rpx rgba(0, 229, 255, 0.1),
    inset 0 0 12rpx rgba(0, 229, 255, 0.03);
}

.med-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18rpx;
}

.med-info { flex: 1; }

.med-name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 6rpx;
}

.med-name {
  font-size: 34rpx;
  font-weight: 700;
  color: #E8EAED;
  letter-spacing: 1rpx;
}

.med-spec { font-size: 28rpx; color: #5C708A; }

/* ── 库存徽标（赛博数据块）── */
.med-stock {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 96rpx;
  padding: 12rpx 18rpx;
  background: rgba(0, 10, 20, 0.6);
  border-radius: 9rpx;
  border: 1rpx solid rgba(0, 229, 255, 0.15);
}

.med-stock.low-stock {
  background: rgba(255, 32, 96, 0.06);
  border-color: rgba(255, 32, 96, 0.3);
  animation: cyber-pulse-red 2s ease-in-out infinite;
}

@keyframes cyber-pulse-red {
  0%, 100% { box-shadow: 0 0 4rpx rgba(255, 32, 96, 0.2); }
  50% { box-shadow: 0 0 16rpx rgba(255, 32, 96, 0.5); }
}

.stock-num {
  font-size: 36rpx;
  font-weight: 900;
  color: #00E5FF;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 8rpx rgba(0, 229, 255, 0.4);
}

.low-stock .stock-num {
  color: #E57373;
}

.stock-label { font-size: 26rpx; color: #8892A0; }

/* ── 底部信息栏 ── */
.med-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 14rpx;
  border-top: 1rpx solid rgba(0, 229, 255, 0.08);
}

.reminder-time-tag {
  background: rgba(0, 229, 255, 0.08);
  color: #00E5FF;
  padding: 4rpx 14rpx;
  border-radius: 9rpx;
  font-size: 24rpx;
  font-weight: 600;
  border: 1rpx solid rgba(0, 229, 255, 0.15);
  font-family: 'Courier New', monospace;
  letter-spacing: 1rpx;
}

/* ── 悬浮添加按钮（赛博霓虹）── */
.add-btn {
  position: fixed;
  bottom: 190rpx;
  right: 36rpx;
  width: 108rpx;
  height: 108rpx;
  background: rgba(0, 10, 20, 0.85);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border: 2rpx solid #00E5FF;
  box-shadow:
    0 0 15rpx rgba(0, 229, 255, 0.4),
    0 0 40rpx rgba(0, 229, 255, 0.12),
    inset 0 0 10rpx rgba(0, 229, 255, 0.05);
  animation: cyber-btn-glow 2s ease-in-out infinite;
}

@keyframes cyber-btn-glow {
  0%, 100% { box-shadow: 0 0 15rpx rgba(0, 229, 255, 0.4), 0 0 40rpx rgba(0, 229, 255, 0.12); }
  50% { box-shadow: 0 0 25rpx rgba(0, 229, 255, 0.7), 0 0 60rpx rgba(176, 0, 255, 0.25); }
}

.add-btn:active {
  transform: scale(0.92);
  box-shadow: 0 0 30rpx rgba(0, 229, 255, 0.6);
}

.add-icon {
  color: #00E5FF;
  font-size: 52rpx;
  font-weight: 300;
  margin-top: -4rpx;
  text-shadow: 0 0 10rpx rgba(0, 229, 255, 0.6);
}
</style>
