<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { nextTick } from 'vue';
import { applyTabBarLocale } from './i18n';
import { useMedStore } from "./stores/index";
import { createNotificationChannel, scheduleAllReminders, requestNotificationPermission, checkAndFirePendingReminder, restoreRegisteredAlarmCodes, ensureAlarmReceiverRegistered } from "./utils/notification";

// 防止 onLaunch 和 onShow 首次启动时重复注册闹钟
let hasInitialized = false;

onLaunch(() => {
  // ★ 安全兜底：确保 splash 屏幕在 5 秒内一定关闭（防 JS 异常导致永远卡在加载）
  // #ifdef APP-PLUS
  const _splashTimer = setTimeout(() => {
    try { plus.navigator.closeSplashscreen(); } catch(e) { /* ignore */ }
  }, 5000);
  // #endif

  // 加载本地数据
  const store = useMedStore();
  store.loadFromStorage();
  applyTabBarLocale();

  // ★ v14: 恢复已注册的闹钟 requestCode 列表（防重启丢失）
  restoreRegisteredAlarmCodes();

  // 初始化通知系统（延迟 2 秒确保 plus.android 完全就绪）
  setTimeout(() => {
    nextTick(async () => {
      try {
        await initNotifications(store.medications, store.reminderConfig);
        // ★ 检查是否由闹钟触发启动
        checkAndFirePendingReminder();
      } catch(e) {
        console.error('[App] 通知初始化失败:', e);
      }
      hasInitialized = true;
    });
  }, 2000);

  // ★ v9: 监听 plus.push 点击事件（仅在 Push 模块可用时）
  // #ifdef APP-PLUS
  try {
    if (plus.push && plus.push.addEventListener) {
      // 点击通知栏消息时触发
      plus.push.addEventListener('click', (msg: any) => {
        console.log('[App] 通知被点击:', msg?.payload);
      }, false);

      // 收到透传消息时触发
      plus.push.addEventListener('receive', (msg: any) => {
        console.log('[App] 收到推送消息:', msg?.content);
      }, false);
    }
  } catch (e) {
    console.warn('[App] plus.push 不可用（可能未添加Push模块），通知将仅使用 AlarmManager + NotificationCompat');
  }
  // #endif
});

let _lastShowLoadTime = 0;
const SHOW_DEBOUNCE_MS = 500;

onShow(() => {
  const now = Date.now();
  if (now - _lastShowLoadTime < SHOW_DEBOUNCE_MS) return; // ★ 防抖：避免与 onLaunch 重复加载
  _lastShowLoadTime = now;

  // console.log("App Show");
  // 每次回到前台时检查是否有待处理的提醒通知
  const store = useMedStore();
  store.loadFromStorage();
  applyTabBarLocale();

  // 延迟 300ms 后执行（避免 plus.android 未就绪）
  setTimeout(() => {
    // ★ 先检查是否有待处理的闹钟触发
    const fired = checkAndFirePendingReminder();
    if (fired) {
      // console.log('[App] 检测到由闹钟触发，已发送通知');
    }

    // 仅在非首次启动时重新注册（避免与 onLaunch 重复）
    if (hasInitialized) {
      scheduleAllReminders(store.medications, store.reminderConfig);
    }
  }, 300);
});

onHide(() => {
  // console.log("App Hide");
});

async function initNotifications(medications: any[], reminderConfig: any) {
  // #ifdef APP-PLUS
  // 创建通知渠道
  createNotificationChannel();
  ensureAlarmReceiverRegistered();

  // 请求通知权限（含精确闹钟权限）
  const permissionGranted = await requestNotificationPermission();
  if (!permissionGranted) {
    console.warn('[App] 通知权限未授予，提醒可能无法正常展示');
  }
  // #endif

  // 注册所有提醒
  scheduleAllReminders(medications, reminderConfig);
}
</script>

<style>
/* ═══════════════════════════════════════════════
   CYBERPUNK — MedTracker Global Styles
   赛博朋克视觉系统 v2.0 (Icon System Aligned)
   色彩令牌：Cyan / Magenta / Blue / Green / Orange
   ═══════════════════════════════════════════════ */

/* ── 设计令牌（与图标系统统一） ── */
:root {
  --color-cyan: #00F0FF;
  --color-magenta: #FF00AA;
  --color-blue: #00AAFF;
  --color-green: #00FF88;
  --color-orange: #FF6600;
  --color-yellow: #FFEE00;
  --bg-deep: #080810;
  --bg-card: rgba(16, 18, 30, 0.7);
}

/* ── 页面背景 ── */
page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 36rpx;
  color: #FFFFFF;
  background-color: var(--bg-deep);
  line-height: 1.8;
  background: linear-gradient(135deg, #080810 0%, #0d1020 50%, #080812 100%);
}

/* 扫描线效果 */
page::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  background: repeating-linear-gradient(0deg,
    rgba(255, 255, 255, 0.02) 0px,
    rgba(255, 255, 255, 0.02) 1px,
    transparent 1px,
    transparent 2px
  );
  animation: scan-line 8s linear infinite;
  z-index: 1;
}

/* ─── 容器 ─── */
.container {
  padding: 32rpx;
  min-height: 100vh;
  position: relative;
  z-index: 2;
}

/* ═══ 卡片（玻璃拟态 + 霓虹边框） ═══ */
.card {
  background: var(--bg-card);
  backdrop-filter: blur(10px);
  border: 2rpx solid rgba(0, 240, 255, 0.25);
  border-radius: 27rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.12), 0 8px 32px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.card:hover {
  border-color: rgba(0, 240, 255, 0.5);
  box-shadow: 0 0 30px rgba(0, 240, 255, 0.25), 0 8px 32px rgba(0, 0, 0, 0.5);
  transform: translateY(-4rpx);
}

.card-title {
  font-size: 38rpx;
  font-weight: 900;
  color: #00F0FF;
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
  margin-bottom: 16rpx;
  letter-spacing: 1.5rpx;
  text-transform: uppercase;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

/* ═══ 按钮系统 ═══ */
.btn-primary {
  background: rgba(0, 240, 255, 0.1);
  border: 2rpx solid #00F0FF;
  color: #00F0FF;
  border-radius: 12rpx;
  padding: 18rpx 36rpx;
  font-size: 32rpx;
  font-weight: 700;
  letter-spacing: 1.5rpx;
  text-transform: uppercase;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.25), inset 0 0 10px rgba(0, 240, 255, 0.08);
  transition: all 0.2s ease-out;
  cursor: pointer;
  font-family: 'Courier New', monospace;
}

.btn-primary:active {
  background: rgba(0, 240, 255, 0.22);
  box-shadow: 0 0 30px rgba(0, 240, 255, 0.55), inset 0 0 20px rgba(0, 240, 255, 0.15);
  transform: scale(0.95);
}

.btn-secondary {
  background: rgba(255, 0, 170, 0.12);
  border: 2rpx solid #FF00AA;
  color: #FF00AA;
  border-radius: 12rpx;
  padding: 16rpx 32rpx;
  font-size: 30rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  text-transform: uppercase;
  box-shadow: 0 0 12px rgba(255, 0, 170, 0.25), inset 0 0 8px rgba(255, 0, 170, 0.08);
  transition: all 0.2s ease-out;
  font-family: 'Courier New', monospace;
}

.btn-secondary:active {
  background: rgba(255, 0, 170, 0.2);
  box-shadow: 0 0 25px rgba(255, 0, 170, 0.5), inset 0 0 15px rgba(255, 0, 170, 0.15);
  transform: scale(0.95);
}

.btn-success {
  background: rgba(0, 255, 136, 0.12);
  border: 2rpx solid #00FF88;
  color: #00FF88;
  border-radius: 12rpx;
  padding: 16rpx 32rpx;
  font-size: 30rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  text-transform: uppercase;
  box-shadow: 0 0 12px rgba(0, 255, 136, 0.3), inset 0 0 8px rgba(0, 255, 136, 0.1);
  transition: all 0.2s ease-out;
  font-family: 'Courier New', monospace;
}

.btn-success:active {
  background: rgba(0, 255, 136, 0.2);
  box-shadow: 0 0 25px rgba(0, 255, 136, 0.6), inset 0 0 15px rgba(0, 255, 136, 0.2);
  transform: scale(0.95);
}

.btn-danger {
  background: rgba(255, 102, 0, 0.12);
  border: 2rpx solid #FF6600;
  color: #FF6600;
  border-radius: 12rpx;
  padding: 16rpx 32rpx;
  font-size: 30rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  text-transform: uppercase;
  box-shadow: 0 0 12px rgba(255, 102, 0, 0.25), inset 0 0 8px rgba(255, 102, 0, 0.08);
  transition: all 0.2s ease-out;
  font-family: 'Courier New', monospace;
}

.btn-danger:active {
  background: rgba(255, 102, 0, 0.2);
  box-shadow: 0 0 25px rgba(255, 102, 0, 0.5), inset 0 0 15px rgba(255, 102, 0, 0.15);
  transform: scale(0.95);
}

/* ═══ 表单元素 ═══ */
.form-group {
  margin-bottom: 20rpx;
}

.form-label {
  font-size: 30rpx;
  font-weight: 700;
  color: #B0B8D4;
  margin-bottom: 10rpx;
  text-transform: uppercase;
  letter-spacing: 1rpx;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.form-input {
  border: 2rpx solid rgba(0, 240, 255, 0.18);
  border-radius: 12rpx;
  padding: 18rpx;
  font-size: 32rpx;
  background: rgba(8, 12, 22, 0.7);
  color: #FFFFFF;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.2s ease-out;
  font-family: 'Courier New', monospace;
}

.form-input:focus {
  border-color: #00F0FF;
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.35), inset 0 0 10px rgba(0, 240, 255, 0.05);
  background: rgba(20, 28, 60, 0.8);
}

/* ═══ 标签和徽章 ═══ */
.tag {
  display: inline-block;
  padding: 6rpx 14rpx;
  border-radius: 9rpx;
  font-size: 22rpx;
  font-weight: 700;
  margin-right: 8rpx;
  margin-bottom: 8rpx;
  border: 1.5rpx solid;
  text-transform: uppercase;
  letter-spacing: 1rpx;
  font-family: 'Courier New', monospace;
  transition: all 0.2s ease-out;
}

.tag-red {
  background: rgba(255, 0, 170, 0.15);
  color: #FF00AA;
  border-color: #FF00AA;
  box-shadow: 0 0 10px rgba(255, 0, 170, 0.2);
}

.tag-blue {
  background: rgba(0, 240, 255, 0.12);
  color: #00F0FF;
  border-color: #00F0FF;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
}

.tag-pink {
  background: rgba(255, 0, 170, 0.15);
  color: #FF00AA;
  border-color: #FF00AA;
  box-shadow: 0 0 10px rgba(255, 0, 170, 0.2);
}

.tag-purple {
  background: rgba(143, 0, 255, 0.15);
  color: #8F00FF;
  border-color: #8F00FF;
  box-shadow: 0 0 10px rgba(143, 0, 255, 0.2);
}

.tag-green {
  background: rgba(0, 255, 136, 0.15);
  color: #00FF88;
  border-color: #00FF88;
  box-shadow: 0 0 10px rgba(0, 255, 136, 0.2);
}

.tag-orange {
  background: rgba(255, 102, 0, 0.15);
  color: #FF6600;
  border-color: #FF6600;
  box-shadow: 0 0 10px rgba(255, 102, 0, 0.15);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: rgba(255, 0, 170, 0.2);
  color: #FF00AA;
  font-size: 22rpx;
  font-weight: 900;
  box-shadow: 0 0 15px rgba(255, 0, 170, 0.3);
  text-transform: uppercase;
  font-family: 'Courier New', monospace;
}

/* ═══ 文字颜色工具类 ═══ */
.text-neon-blue {
  color: #00F0FF;
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
}

.text-neon-pink {
  color: #FF00AA;
  text-shadow: 0 0 10px rgba(255, 0, 170, 0.4);
}

.text-neon-purple {
  color: #8F00FF;
  text-shadow: 0 0 10px rgba(143, 0, 255, 0.4);
}

.text-neon-green {
  color: #00FF88;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.4);
}

.text-neon-yellow {
  color: #FFFF00;
  text-shadow: 0 0 10px rgba(255, 255, 0, 0.3);
}

.text-muted {
  color: #B0B8D4;
}

/* ═══ 列表项 ═══ */
.list-item {
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(0, 240, 255, 0.1);
  transition: all 0.2s ease-out;
}

.list-item:hover {
  background: rgba(0, 240, 255, 0.04);
  border-color: rgba(0, 240, 255, 0.25);
  padding-left: 8rpx;
}

.list-item:last-child {
  border-bottom: none;
}

/* ═══ 工具类 ═══ */
.flex { display: flex; }
.flex-1 { flex: 1; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.justify-center { justify-content: center; }
.text-center { text-align: center; }

.mt-20 { margin-top: 20rpx; }
.mb-20 { margin-bottom: 20rpx; }
.mb-30 { margin-bottom: 30rpx; }

/* ═══ 分割线 ═══ */
.divider {
  height: 1rpx;
  background: linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.25), transparent);
  margin: 20rpx 0;
}

/* ═══ 空状态 ═══ */
.empty-state {
  text-align: center;
  padding: 80rpx 40rpx;
  color: #B0B8D4;
}

.empty-state .icon {
  font-size: 100rpx;
  margin-bottom: 20rpx;
  opacity: 0.6;
}

/* ═══ 动画关键帧 ═══ */
@keyframes scan-line {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(0, 240, 255, 0.25); }
  50% { box-shadow: 0 0 40px rgba(0, 240, 255, 0.5); }
}

@keyframes flicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
  20%, 24%, 55% { opacity: 0.8; }
}

@keyframes glow-shift {
  0% { box-shadow: 0 0 20px rgba(0, 240, 255, 0.35); }
  50% { box-shadow: 0 0 30px rgba(255, 0, 170, 0.35); }
  100% { box-shadow: 0 0 20px rgba(0, 240, 255, 0.35); }
}

/* ═══ 自定义导航栏 (H5 版本) ═══ */
/* tabBar 样式优化 */
uni-tabbar {
  height: 120rpx !important;
  background: #080810 !important;
  border-top: 1rpx solid rgba(0, 240, 255, 0.1) !important;
  padding-bottom: env(safe-area-inset-bottom) !important;
}

uni-tabbar-item {
  font-size: 22rpx !important;
}

uni-tabbar-item .uni-tabbar__icon {
  width: 52rpx !important;
  height: 52rpx !important;
}

uni-tabbar-item .uni-tabbar__icon img,
uni-tabbar-item .uni-tabbar__icon svg {
  width: 52rpx !important;
  height: 52rpx !important;
  display: block !important;
}

/* tabBar 文字 — 确保可见 */
uni-tabbar-item .uni-tabbar__text {
  font-size: 22rpx !important;
  font-weight: 600 !important;
  color: #4A5568 !important;
  line-height: 1 !important;
  margin-top: 2rpx !important;
}

/* 选中态文字 — 赛博青 */
uni-tabbar-item.uni-tabbar__item--active .uni-tabbar__text {
  color: #00F0FF !important;
  text-shadow: 0 0 8rpx rgba(0, 240, 255, 0.6) !important;
}

/* 选中态图标容器 */
uni-tabbar-item.uni-tabbar__item--active .uni-tabbar__icon {
  filter: drop-shadow(0 0 6rpx rgba(0, 240, 255, 0.5));
}
</style>

