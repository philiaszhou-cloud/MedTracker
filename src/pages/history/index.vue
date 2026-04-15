<template>
  <view class="history-page">
    <!-- ═══ 赛博终端导航栏（数据记录模式）═══ -->
    <view class="cyber-nav-terminal">
      <view class="terminal-scanline"></view>
      <view class="cyber-nav-terminal-inner">
        <view class="term-bracket term-left">[</view>
        <view class="term-title-wrap">
          <text class="cyber-nav-term-title">{{ t('history.navTitle') }}</text>
          <text class="cyber-nav-term-sub">{{ t('history.navSub') }}</text>
        </view>
        <view class="term-bracket term-right">]</view>
      </view>
      <view class="term-glow-line"></view>
    </view>

    <view class="container">
      <!-- 日期筛选 -->
      <view class="filter-bar">
        <view 
          v-for="(filter, idx) in dateFilters" 
          :key="idx"
          class="filter-chip"
          :class="{ active: activeFilter === filter.value }"
          @tap="setFilter(filter.value)"
        >
          <text>{{ filter.label }}</text>
        </view>
      </view>

      <!-- 统计摘要 -->
      <view class="card stats-card">
        <view class="stat-item">
          <text class="stat-num text-success">{{ stats.taken }}</text>
          <text class="stat-label">{{ t('history.taken') }}</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num text-warning">{{ stats.skipped }}</text>
          <text class="stat-label">{{ t('history.skipped') }}</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num text-danger">{{ stats.missed }}</text>
          <text class="stat-label">{{ t('history.missed') }}</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num text-primary">{{ complianceRate }}%</text>
          <text class="stat-label">{{ t('history.complianceRate') }}</text>
        </view>
      </view>

      <!-- 拍照记录摘要（按筛选范围） -->
      <view v-if="photoStats.total > 0" class="card photo-stats-card">
        <view class="photo-stats-header">
          <text class="photo-stats-title">{{ t('history.dailyPhotoRecord') }}</text>
          <text class="photo-stats-sub">{{ formatTotalDays(photoStats.total) }}</text>
        </view>
        <view class="photo-stats-row">
          <view class="photo-stat-item">
            <text class="photo-stat-num text-success">{{ photoStats.completed }}</text>
            <text class="photo-stat-label">{{ t('history.countCorrect') }}</text>
          </view>
          <view class="photo-stat-divider"></view>
          <view class="photo-stat-item">
            <text class="photo-stat-num text-danger">{{ photoStats.mismatch }}</text>
            <text class="photo-stat-label">{{ t('history.countMismatch') }}</text>
          </view>
          <view class="photo-stat-divider"></view>
          <view class="photo-stat-item">
            <text class="photo-stat-num text-muted">{{ photoStats.missed }}</text>
            <text class="photo-stat-label">{{ t('history.countPending') }}</text>
          </view>
        </view>
      </view>

      <!-- 拍照记录列表 -->
      <view v-if="groupedPhotoLogs.length > 0" class="photo-section">
        <view v-for="group in groupedPhotoLogs" :key="group.date" class="date-group">
          <view class="date-header">
            <text class="date-text">{{ group.dateLabel }}</text>
            <view class="photo-badge" :class="'badge-' + group.photoStatus">
              <text>{{ photoStatusLabel(group.photoStatus) }}</text>
            </view>
          </view>
          <view class="card photo-log-card">
            <view class="photo-log-content">
              <view class="photo-count-display">
                <text class="photo-count-num">{{ group.pillCount }}</text>
                <text class="photo-count-sep">/</text>
                <text class="photo-count-expected">{{ group.expectedCount }}</text>
                <text class="photo-count-unit">{{ t('common.pillsUnit') }}</text>
              </view>
              <view class="photo-log-info">
                <text class="photo-log-time text-small text-muted">{{ formatPhotoTime(group.timestamp) }}</text>
                <text class="photo-log-status text-small" :class="'status-' + group.photoStatus">
                  {{ photoStatusText(group.photoStatus) }}
                </text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 服药记录标题 -->
      <view v-if="groupedLogs.length > 0" class="section-header">
        <text class="section-title">{{ t('history.medicationRecords') }}</text>
      </view>

      <!-- 日期分组记录 -->
      <view v-if="groupedLogs.length > 0">
        <view v-for="group in groupedLogs" :key="group.date" class="date-group">
          <view class="date-header">
            <text class="date-text">{{ group.dateLabel }}</text>
            <text class="date-count text-muted text-small">{{ formatRecordCount(group.logs.length) }}</text>
          </view>

          <view class="card">
            <view v-for="log in group.logs" :key="log.id" class="log-entry">
              <view class="log-status-icon" :class="log.status">
                <text>{{ statusEmoji(log.status) }}</text>
              </view>
              <view class="log-content">
                <view class="log-main">
                  <text class="log-med-name">{{ log.medicationName }}</text>
                  <text class="log-scheduled text-muted text-small">{{ formatPlannedTime(log.scheduledTime) }}</text>
                </view>
                <text class="log-time text-small text-muted">{{ formatTimeOnly(log.timestamp) }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="groupedLogs.length === 0 && groupedPhotoLogs.length === 0" class="empty-state">
        <view class="icon">📋</view>
        <view class="text">{{ t('history.empty') }}</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useI18n } from 'vue-i18n';
import { useMedStore } from '../../stores/index';
import { formatDate, formatTime } from '../../utils';
import { formatHistoryDateLabel } from '../../i18n';

const store = useMedStore();
const { t, locale } = useI18n();

const activeFilter = ref('today');

const dateFilters = computed(() => [
  { label: t('history.filterToday'), value: 'today' },
  { label: t('history.filterWeek'), value: 'week' },
  { label: t('history.filterMonth'), value: 'month' },
  { label: t('history.filterAll'), value: 'all' },
]);

interface LogGroup {
  date: string;
  dateLabel: string;
  logs: typeof store.intakeLogs;
}

const filteredLogs = computed(() => {
  const now = new Date();
  let startTime = 0;

  switch (activeFilter.value) {
    case 'today': {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startTime = today.getTime();
      break;
    }
    case 'week': {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startTime = weekAgo.getTime();
      break;
    }
    case 'month': {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startTime = monthAgo.getTime();
      break;
    }
    case 'all':
    default:
      startTime = 0;
  }

  return store.intakeLogs.filter(log => log.timestamp >= startTime);
});

const stats = computed(() => {
  const logs = filteredLogs.value;
  return {
    taken: logs.filter(l => l.status === 'taken').length,
    skipped: logs.filter(l => l.status === 'skipped').length,
    missed: logs.filter(l => l.status === 'missed').length,
  };
});

const complianceRate = computed(() => {
  const total = stats.value.taken + stats.value.skipped + stats.value.missed;
  if (total === 0) return 100;
  return Math.round((stats.value.taken / total) * 100);
});

// ── 拍照记录相关 ──
const filteredPhotoLogs = computed(() => {
  const now = new Date();
  let startTime = 0;

  switch (activeFilter.value) {
    case 'today': {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startTime = today.getTime();
      break;
    }
    case 'week': {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startTime = weekAgo.getTime();
      break;
    }
    case 'month': {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startTime = monthAgo.getTime();
      break;
    }
    case 'all':
    default:
      startTime = 0;
  }

  return store.dailyPhotoLogs.filter(log => log.timestamp >= startTime);
});

const photoStats = computed(() => {
  const logs = filteredPhotoLogs.value;
  return {
    total: logs.length,
    completed: logs.filter(l => l.status === 'completed').length,
    mismatch: logs.filter(l => l.status === 'mismatch').length,
    missed: logs.filter(l => l.status === 'pending').length,
  };
});

const groupedPhotoLogs = computed(() => {
  const now = new Date();

  return filteredPhotoLogs.value
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(log => {
      const date = log.date;

      return {
        date,
        dateLabel: formatHistoryDateLabel(log.timestamp, locale.value === 'en' ? 'en' : 'zh-Hans'),
        pillCount: log.pillCount,
        expectedCount: log.expectedCount,
        photoStatus: log.status,
        timestamp: log.timestamp,
      };
    });
});

const groupedLogs = computed((): LogGroup[] => {
  const groups: Map<string, typeof store.intakeLogs> = new Map();
  
  filteredLogs.value.forEach(log => {
    const date = formatDate(log.timestamp);
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(log);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, logs]) => {
      return { date, dateLabel: formatHistoryDateLabel(logs[0].timestamp, locale.value === 'en' ? 'en' : 'zh-Hans'), logs };
    });
});

onShow(() => {
  store.loadFromStorage();
});

function setFilter(value: string) {
  activeFilter.value = value;
}

function statusEmoji(status: string): string {
  const map: Record<string, string> = { taken: '✅', skipped: '⏭️', missed: '❌' };
  return map[status] || '❓';
}

function formatTimeOnly(ts: number): string {
  return formatTime(ts);
}

function formatPhotoTime(ts: number): string {
  return formatTime(ts);
}

function formatTotalDays(count: number): string {
  if (locale.value === 'en') {
    return `${count} day records`;
  }
  return `${count} 天记录`;
}

function formatRecordCount(count: number): string {
  if (locale.value === 'en') {
    return `${count} records`;
  }
  return `${count} 条记录`;
}

function formatPlannedTime(time: string): string {
  if (locale.value === 'en') {
    return `Scheduled ${time}`;
  }
  return `计划 ${time}`;
}

function photoStatusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: t('history.correctShort'),
    mismatch: t('history.mismatchShort'),
    pending: t('history.pendingShort'),
  };
  return map[status] || status;
}

function photoStatusText(status: string): string {
  const map: Record<string, string> = {
    completed: t('history.photoMatch'),
    mismatch: t('history.photoMismatch'),
    pending: t('history.photoPending'),
  };
  return map[status] || '';
}
</script>

<style scoped>
/* ═══ 历史记录页 — 赛博数据终端风格 ═══ */

.history-page { background: #0D1117; min-height: 100vh; }

/* ═══ 赛博终端导航栏 ═══ */
.cyber-nav-terminal {
  position: relative;
  background: linear-gradient(180deg, #0A0E14, #0D1117);
  padding: 52rpx 32rpx 22rpx;
  padding-top: calc(var(--status-bar-height, 44rpx) + 18rpx);
  border-bottom: 1rpx solid rgba(176, 0, 255, 0.15);
  overflow: hidden;
}

.terminal-scanline {
  position: absolute;
  top: 0; left: 0; right: 0; height: 2rpx;
  background: linear-gradient(90deg,
    transparent 0%,
    #B000FF 20%,
    #00E5FF 50%,
    #B000FF 80%,
    transparent 100%
  );
  box-shadow:
    0 0 12rpx rgba(176, 0, 255, 0.6),
    0 0 30rpx rgba(0, 229, 255, 0.3);
  animation: term-scan-pulse 3s ease-in-out infinite;
}
@keyframes term-scan-pulse {
  0%,100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.cyber-nav-terminal-inner {
  display: flex;
  align-items: center;
  gap: 10rpx;
  position: relative;
  z-index: 1;
}

.term-bracket {
  font-size: 52rpx;
  font-weight: 900;
  color: rgba(176, 0, 255, 0.4);
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 8rpx rgba(176, 0, 255, 0.3);
}
.term-left { transform: scaleY(1.4); }
.term-right { margin-left: auto; transform: scaleY(1.4); }

.term-title-wrap { display: flex; flex-direction: column; gap: 2rpx; }

.cyber-nav-term-title {
  font-size: 38rpx;
  font-weight: 900;
  color: #B000FF;
  letter-spacing: 4rpx;
  text-transform: uppercase;
  text-shadow:
    0 0 10rpx rgba(176, 0, 255, 0.5),
    0 0 25rpx rgba(176, 0, 255, 0.2),
    0 0 50rpx rgba(0, 229, 255, 0.1);
  font-family: 'Rajdhani', sans-serif;
}

.cyber-nav-term-sub {
  font-size: 18rpx;
  color: #00E5FF;
  font-family: 'Courier New', monospace;
  letter-spacing: 3rpx;
  opacity: 0.75;
  text-shadow: 0 0 6rpx rgba(0, 229, 255, 0.3);
}

.term-glow-line {
  position: absolute;
  bottom: 0; left: 15%; right: 15%;
  height: 1rpx;
  background: linear-gradient(90deg, transparent, #B000FF 50%, transparent);
  box-shadow: 0 0 10rpx rgba(176, 0, 255, 0.4), 0 -3rpx 12rpx rgba(176, 0, 255, 0.1);
}

.container {
  padding: 24rpx;
  padding-bottom: 140rpx;
}

/* ── 筛选栏（赛博数据标签）── */
.filter-bar { display: flex; gap: 16rpx; margin-bottom: 22rpx; }

.filter-chip {
  padding: 12rpx 24rpx;
  background: rgba(8, 12, 20, 0.7);
  border-radius: 9rpx;
  font-size: 24rpx; color: #4A5568; white-space: nowrap;
  border: 1rpx solid rgba(176, 0, 255, 0.1);
  transition: all 200ms ease;
  font-family: 'Courier New', monospace;
  letter-spacing: 1rpx;
}

.filter-chip.active {
  background: rgba(176, 0, 255, 0.08);
  color: #B000FF;
  border-color: rgba(176, 0, 255, 0.4);
  font-weight: 700;
  box-shadow:
    0 0 10rpx rgba(176, 0, 255, 0.15),
    inset 0 0 8rpx rgba(176, 0, 255, 0.05);
  text-shadow: 0 0 8rpx rgba(176, 0, 255, 0.4);
}

.filter-chip:active { opacity: 0.85; }

/* ── 统计卡片（赛博数据面板）── */
.stats-card {
  display: flex; justify-content: space-around; align-items: center;
  padding: 28rpx 18rpx;
  border-color: rgba(176, 0, 255, 0.12);
  background: rgba(8, 12, 20, 0.85);
  position: relative;

  &::after {
    content: '';
    position: absolute; bottom: 0; left: 15%; right: 15%;
    height: 1rpx;
    background: linear-gradient(90deg, transparent, #B000FF, transparent);
    box-shadow: 0 0 10rpx rgba(176, 0, 255, 0.4);
  }
}

.stat-item { display: flex; flex-direction: column; align-items: center; flex: 1; }

.stat-num {
  font-size: 40rpx; font-weight: 900; margin-bottom: 4rpx;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 8rpx currentColor;
}
.stat-num.text-success { color: #00FF88; text-shadow: 0 0 10rpx rgba(0,255,136,0.5); }
.stat-num.text-warning { color: #FF9500; text-shadow: 0 0 10rpx rgba(255,149,0,0.4); }
.stat-num.text-danger { color: #FF2060; text-shadow: 0 0 10rpx rgba(255,32,96,0.5); animation: cyber-pulse-red 2s ease-in-out infinite; }
.stat-num.text-primary { color: #00E5FF; text-shadow: 0 0 10rpx rgba(0,229,255,0.5); }

@keyframes cyber-pulse-red {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.65; }
}

.stat-label { font-size: 26rpx; color: #3A4A5A; }

.stat-divider { width: 1rpx; height: 56rpx; background: linear-gradient(180deg, transparent, rgba(176,0,255,0.2), transparent); }

/* ── 日期分组 ── */
.date-group { margin-bottom: 22rpx; }

.date-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; padding-left: 6rpx; }

.date-text { font-size: 28rpx; font-weight: 900; color: #B000FF; letter-spacing: 2rpx; text-shadow: 0 0 8rpx rgba(176,0,255,0.3); }
.date-count { font-size: 26rpx; color: #4A5568; }

/* ── 记录条目 ── */
.log-entry { display: flex; align-items: center; gap: 18rpx; padding: 18rpx 0; border-bottom: 1rpx solid rgba(176,0,255,0.05); transition: all 150ms ease; }
.log-entry:last-child { border-bottom: none; }
.log-entry:active { background: rgba(176,0,255,0.03); }

.log-status-icon { font-size: 36rpx; width: 52rpx; text-align: center; }
.log-status-icon.taken { color: #00FF88; filter: drop-shadow(0 0 4rpx rgba(0,255,136,0.5)); }
.log-status-icon.skipped { color: #FF9500; }
.log-status-icon.missed { color: #FF2060; animation: cyber-pulse-red 1.8s ease-in-out infinite; }

.log-content { flex: 1; display: flex; justify-content: space-between; align-items: center; }
.log-main { display: flex; flex-direction: column; }
.log-med-name { font-size: 30rpx; font-weight: 700; color: #E8EAED; letter-spacing: 0.5rpx; }
.log-scheduled { font-size: 24rpx; color: #3A4A5A; }
.log-time { font-size: 24rpx; color: #3A4A5A; font-family: 'Courier New', monospace; }

/* ── 拍照记录区域 ── */
.section-header { margin-bottom: 16rpx; margin-top: 8rpx; }
.section-title { font-size: 26rpx; font-weight: 700; color: #B000FF; letter-spacing: 2rpx; text-shadow: 0 0 6rpx rgba(176,0,255,0.3); }

.photo-stats-card {
  margin-bottom: 22rpx;
  border-color: rgba(0, 229, 255, 0.15);
  background: rgba(0, 10, 20, 0.85);
  position: relative;
  overflow: hidden;
}
.photo-stats-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 1rpx;
  background: linear-gradient(90deg, transparent, #00E5FF 50%, transparent);
  box-shadow: 0 0 8rpx rgba(0,229,255,0.4);
}

.photo-stats-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18rpx; }
.photo-stats-title { font-size: 28rpx; font-weight: 800; color: #00E5FF; letter-spacing: 1rpx; text-shadow: 0 0 6rpx rgba(0,229,255,0.3); }
.photo-stats-sub { font-size: 22rpx; color: #3A4A5A; font-family: 'Courier New', monospace; }

.photo-stats-row { display: flex; justify-content: space-around; align-items: center; }
.photo-stat-item { display: flex; flex-direction: column; align-items: center; flex: 1; }
.photo-stat-num { font-size: 36rpx; font-weight: 900; font-family: 'Courier New', monospace; text-shadow: 0 0 8rpx currentColor; }
.photo-stat-num.text-success { color: #00FF88; }
.photo-stat-num.text-danger { color: #FF2060; }
.photo-stat-num.text-muted { color: #4A5568; }
.photo-stat-label { font-size: 24rpx; color: #3A4A5A; margin-top: 4rpx; }
.photo-stat-divider { width: 1rpx; height: 48rpx; background: linear-gradient(180deg, transparent, rgba(0,229,255,0.15), transparent); }

/* 拍照状态徽章 */
.photo-badge {
  font-size: 20rpx; font-weight: 700; padding: 4rpx 12rpx; border-radius: 9rpx;
  font-family: 'Courier New', monospace; letter-spacing: 1rpx;
}
.photo-badge.badge-completed { background: rgba(0,255,136,0.12); color: #00FF88; border: 1rpx solid rgba(0,255,136,0.3); }
.photo-badge.badge-mismatch { background: rgba(255,32,96,0.12); color: #FF2060; border: 1rpx solid rgba(255,32,96,0.3); }
.photo-badge.badge-pending { background: rgba(74,85,104,0.15); color: #4A5568; border: 1rpx solid rgba(74,85,104,0.3); }

/* 拍照记录卡片 */
.photo-log-card {
  border-color: rgba(0, 229, 255, 0.1);
  background: rgba(0, 10, 20, 0.7);
}
.photo-log-content { display: flex; justify-content: space-between; align-items: center; padding: 8rpx 0; }
.photo-count-display { display: flex; align-items: baseline; gap: 4rpx; }
.photo-count-num { font-size: 44rpx; font-weight: 900; color: #00E5FF; font-family: 'Courier New', monospace; text-shadow: 0 0 10rpx rgba(0,229,255,0.5); }
.photo-count-sep { font-size: 32rpx; color: #3A4A5A; font-family: 'Courier New', monospace; margin: 0 4rpx; }
.photo-count-expected { font-size: 32rpx; font-weight: 700; color: #4A5568; font-family: 'Courier New', monospace; }
.photo-count-unit { font-size: 24rpx; color: #3A4A5A; margin-left: 6rpx; }
.photo-log-info { display: flex; flex-direction: column; align-items: flex-end; gap: 4rpx; }
.photo-log-status { font-family: 'Courier New', monospace; letter-spacing: 0.5rpx; }
.status-completed { color: #00FF88; }
.status-mismatch { color: #FF2060; }
.status-pending { color: #4A5568; }
</style>
