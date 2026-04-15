/**
 * MedReminderAI - 本地通知工具 v9
 *
 * ★ v9 核心改变（2026-04-13）：
 *
 *   双通道方案：plus.push 本地推送 + AlarmManager 精确闹钟
 *
 *   通道 1 — plus.push.createMessage（主要）：
 *     - 直接在通知栏推送消息，App 在后台/锁屏时均有效
 *     - 使用 delay 参数实现定时推送
 *     - 用户体验最佳：无需打开 App 即可看到通知
 *
 *   通道 2 — AlarmManager（备用）：
 *     - 精确唤醒设备并启动 Activity
 *     - onShow 时检查 Intent extra 并补发通知
 *     - 作为 plus.push 的补充保障
 *
 * H5 端：Web Notification API + setInterval 30 秒轮询（仅在线时有效）
 */

import type { Medication, ReminderConfig } from '../types';
import { getDailyDosage, calcDaysRemaining } from './index';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const NOTIFICATION_CHANNEL_ID = 'med_reminder';
const NOTIFICATION_CHANNEL_NAME = '用药提醒';
const REMINDER_BROADCAST_ACTION = 'com.medtracker.REMINDER_ALARM';

/** Intent extra key：用于标识这是由闹钟触发的 */
const EXTRA_REMINDER_KEY = 'med_reminder';

/** 通知 id extra key：用于确保同一提醒有稳定通知 id */
const EXTRA_NOTIFICATION_ID = 'med_reminder_notification_id';

/** 已注册的 requestCode 列表（用于清除） */
let registeredRequestCodes: number[] = [];
let alarmReminderReceiver: any = null;
let alarmReceiverRegistered = false;

/** 存储 key：持久化 requestCode 列表，防止重启/热更新丢失 */
const ALARM_CODES_KEY = 'medreminder_registered_alarm_codes';

/** 从本地存储恢复 requestCode 列表（App 启动时调用） */
export function restoreRegisteredAlarmCodes(): void {
  try {
    const data = uni.getStorageSync(ALARM_CODES_KEY);
    if (data && typeof data === 'string') {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        registeredRequestCodes = parsed;
        console.log(`[Notification] 已恢复 ${registeredRequestCodes.length} 个闹钟 requestCode`);
      }
    }
  } catch {
    // 首次启动或数据损坏，忽略
  }
}

/** 持久化requestCode列表到storage */
function persistAlarmCodes(): void {
  try {
    uni.setStorageSync(ALARM_CODES_KEY, JSON.stringify(registeredRequestCodes));
  } catch (e) {
    console.warn('[Notification] 持久化 alarmCodes 失败:', e);
  }
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/**
 * 计算今天（或明天）指定时间点的 Date 对象
 * advanceMinutes > 0 时提前触发
 */
function getNextTriggerDate(timeStr: string, advanceMinutes: number = 0): Date {
  const [hour, minute] = timeStr.split(':').map(Number);
  const now = new Date();
  const trigger = new Date();
  trigger.setHours(hour, minute, 0, 0);

  if (advanceMinutes > 0) {
    trigger.setTime(trigger.getTime() - advanceMinutes * 60 * 1000);
  }

  // 如果已经过了今天的触发时间，设为明天
  if (trigger.getTime() <= now.getTime()) {
    trigger.setDate(trigger.getDate() + 1);
  }

  return trigger;
}

/**
 * 为药品+时间生成稳定的 requestCode
 * ★ 使用 medId（而非 medName）作为 key，避免同名药品在相同提醒时间产生碰撞
 */
function generateRequestCode(medId: string, timeStr: string): number {
  const str = medId + '_' + timeStr;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // 转为32位整数
  }
  return Math.abs(hash) % 2000000000; // 避免超出 int 范围
}

// ─────────────────────────────────────────────
// 权限请求
// ─────────────────────────────────────────────

export function requestNotificationPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    // #ifdef APP-PLUS
    try {
      const main = (plus.android as any).runtimeMainActivity();
      const Build = plus.android.importClass('android.os.Build');
      const sdkInt = plus.android.invoke(Build, 'VERSION.SDK_INT') as number;

      const isNotificationEnabled = (): boolean => {
        try {
          if (sdkInt < 24) return true;
          const Context = plus.android.importClass('android.content.Context');
          const nm = main.getSystemService((Context as any).NOTIFICATION_SERVICE) as any;
          return nm ? !!nm.areNotificationsEnabled() : true;
        } catch (e) {
          console.warn('[Notification] 读取通知权限状态失败:', e);
          return true;
        }
      };

      const ensureExactAlarmPermission = (): void => {
        if (sdkInt < 31) return;
        try {
          const Context = plus.android.importClass('android.content.Context');
          const Settings = plus.android.importClass('android.provider.Settings');
          const Intent = plus.android.importClass('android.content.Intent');
          const Uri = plus.android.importClass('android.net.Uri');
          const alarmManager = main.getSystemService((Context as any).ALARM_SERVICE) as any;
          const canSchedule = alarmManager?.canScheduleExactAlarms ? !!alarmManager.canScheduleExactAlarms() : true;
          if (canSchedule) return;

          const intent = new (Intent as any)((Settings as any).ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
          const packageUri = (Uri as any).parse(`package:${main.getPackageName()}`);
          intent.setData(packageUri);
          intent.addFlags((Intent as any).FLAG_ACTIVITY_NEW_TASK);
          main.startActivity(intent);
          console.warn('[Notification] 未授予精确闹钟权限，已打开系统设置页');
        } catch (e) {
          console.warn('[Notification] 请求精确闹钟权限失败:', e);
        }
      };

      ensureExactAlarmPermission();

      if (sdkInt >= 33 && !isNotificationEnabled()) {
        try {
          plus.android.requestPermissions(
            ['android.permission.POST_NOTIFICATIONS'],
            (_result: any) => resolve(isNotificationEnabled()),
            (err: any) => {
              console.warn('[Notification] POST_NOTIFICATIONS 请求失败:', err);
              resolve(isNotificationEnabled());
            },
          );
          return;
        } catch (e) {
          console.warn('[Notification] POST_NOTIFICATIONS 请求失败:', e);
        }
      }

      resolve(isNotificationEnabled());
    } catch (e) {
      console.warn('[Notification] 权限异常:', e);
      resolve(false);
    }
    // #endif

    // #ifndef APP-PLUS
    resolve(true);
    // #endif
  });
}

function getReminderBroadcastAction(main: any): string {
  try {
    const packageName = main?.getPackageName ? main.getPackageName() : '';
    return packageName ? `${packageName}.${REMINDER_BROADCAST_ACTION}` : REMINDER_BROADCAST_ACTION;
  } catch {
    return REMINDER_BROADCAST_ACTION;
  }
}

function buildReminderPayload(
  medName: string,
  dosage: number | string,
  timeStr: string,
): { title: string; content: string; medName: string; timeStr: string; timestamp: number } {
  return {
    title: '💊 用药提醒',
    content: `${timeStr} 该服用 ${medName} 了，剂量 ${dosage}`,
    medName,
    timeStr,
    timestamp: Date.now(),
  };
}

function sendSystemNotification(title: string, content: string, notifId?: number): void {
  try {
    const main = (plus.android as any).runtimeMainActivity();
    const Context = plus.android.importClass('android.content.Context');
    const NotificationCompat = plus.android.importClass('androidx.core.app.NotificationCompat');
    const nm = main.getSystemService((Context as any).NOTIFICATION_SERVICE) as any;

    const id = notifId ?? Math.floor(Math.random() * 100000);
    const builder = new (NotificationCompat as any).Builder(main, NOTIFICATION_CHANNEL_ID);
    builder.setContentTitle(title);
    builder.setContentText(content);
    builder.setSmallIcon(17301651);
    builder.setAutoCancel(true);
    builder.setPriority((NotificationCompat as any).PRIORITY_HIGH);
    builder.setDefaults((NotificationCompat as any).DEFAULT_ALL);

    try {
      const PendingIntent = plus.android.importClass('android.app.PendingIntent');
      const Intent = plus.android.importClass('android.content.Intent');
      const launchIntent = main.getPackageManager().getLaunchIntentForPackage(main.getPackageName());
      if (launchIntent) {
        launchIntent.addFlags((Intent as any).FLAG_ACTIVITY_NEW_TASK | (Intent as any).FLAG_ACTIVITY_CLEAR_TOP);
        const pi = (PendingIntent as any).getActivity(
          main,
          id,
          launchIntent,
          (PendingIntent as any).FLAG_UPDATE_CURRENT | (PendingIntent as any).FLAG_IMMUTABLE,
        );
        builder.setContentIntent(pi);
      }
    } catch {}

    nm.notify(id, builder.build());
    console.log(`[Notification] NotificationCompat 已推送: ${title}`);
  } catch (e) {
    console.error('[Notification] NotificationCompat 发送失败:', e);
  }
}

function registerAlarmReceiver(): boolean {
  // #ifdef APP-PLUS
  if (alarmReceiverRegistered && alarmReminderReceiver) {
    return true;
  }

  try {
    const main = (plus.android as any).runtimeMainActivity();
    const context = main.getApplicationContext ? main.getApplicationContext() : main;
    const IntentFilter = plus.android.importClass('android.content.IntentFilter');
    const filter = new (IntentFilter as any)();
    filter.addAction(getReminderBroadcastAction(main));

    alarmReminderReceiver = plus.android.implements('android.content.BroadcastReceiver', {
      onReceive: (_context: any, intent: any) => {
        try {
          const reminderJson = intent?.getStringExtra ? intent.getStringExtra(EXTRA_REMINDER_KEY) : '';
          if (!reminderJson) return;

          const reminderData = JSON.parse(reminderJson) as { title: string; content: string };
          let notifId = 0;
          try {
            notifId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0);
          } catch {}

          sendSystemNotification(reminderData.title, reminderData.content, notifId || undefined);
        } catch (e) {
          console.error('[Notification] BroadcastReceiver 处理提醒失败:', e);
        }
      },
    });

    context.registerReceiver(alarmReminderReceiver, filter);
    alarmReceiverRegistered = true;
    console.log('[Notification] 原生 BroadcastReceiver 已注册');
    return true;
  } catch (e) {
    alarmReminderReceiver = null;
    alarmReceiverRegistered = false;
    console.error('[Notification] 注册 BroadcastReceiver 失败，将回退旧链路:', e);
    return false;
  }
  // #endif

  return false;
}

export function ensureAlarmReceiverRegistered(): boolean {
  return registerAlarmReceiver();
}

// ─────────────────────────────────────────────
// 创建通知渠道
// ─────────────────────────────────────────────

export function createNotificationChannel(): void {
  // #ifdef APP-PLUS
  try {
    const main = (plus.android as any).runtimeMainActivity();
    const Build = plus.android.importClass('android.os.Build');
    const sdkInt = plus.android.invoke(Build, 'VERSION.SDK_INT') as number;

    if (sdkInt >= 26) {
      const NotificationChannel = plus.android.importClass('android.app.NotificationChannel');
      const Context = plus.android.importClass('android.content.Context');
      const nm = main.getSystemService((Context as any).NOTIFICATION_SERVICE) as any;

      if (nm.getNotificationChannel(NOTIFICATION_CHANNEL_ID)) {
        // console.log('[Notification] 渠道已存在');
        return;
      }

      const channel = new (NotificationChannel as any)(
        NOTIFICATION_CHANNEL_ID,
        NOTIFICATION_CHANNEL_NAME,
        4, // IMPORTANCE_HIGH
      );
      channel.setDescription('每日用药定时提醒');
      channel.enableLights(true);
      channel.enableVibration(true);
      channel.setBypassDnd(true);
      nm.createNotificationChannel(channel);

      // console.log('[Notification] 渠道已创建');
    }
  } catch (e) {
    console.error('[Notification] 创建渠道失败:', e);
  }
  // #endif
}

// ─────────────────────────────────────────────
// 发送即时通知（双通道）
// ─────────────────────────────────────────────

/** 检测 plus.push 是否可用 */
function isPushAvailable(): boolean {
  // #ifdef APP-PLUS
  try {
    return !!(plus.push && plus.push.createMessage);
  } catch {
    return false;
  }
  // #endif
  return false;
}

export function sendLocalNotification(title: string, content: string, notifId?: number): void {
  // #ifdef APP-PLUS
  // 通道 1：plus.push 本地推送 — 直接出现在通知栏（需要 Push 模块）
  if (isPushAvailable()) {
    try {
      plus.push.createMessage(content, JSON.stringify({ type: 'reminder', title }), {
        title,
        cover: false,
      } as any);
      console.log(`[Notification] plus.push 已推送: ${title}`);
    } catch (e) {
      console.warn('[Notification] plus.push 推送失败:', e);
    }
  }

  // 通道 2：NotificationCompat — 始终执行，不依赖 Push 模块
  sendSystemNotification(title, content, notifId);
  // #endif

  // #ifdef H5
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body: content });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') new Notification(title, { body: content });
      });
    }
  }
  // #endif
}

// ─────────────────────────────────────────────
// 定时推送（多策略）
// ─────────────────────────────────────────────

/**
 * 策略 1：plus.push.createMessage + delay（需要 Push 模块）
 * 在通知栏定时弹出，App在后台/锁屏均可收到
 */
function schedulePushNotification(
  medName: string,
  dosage: number | string,
  timeStr: string,
  advanceMinutes: number = 0,
): boolean {
  // #ifdef APP-PLUS
  if (!isPushAvailable()) return false;

  try {
    const triggerDate = getNextTriggerDate(timeStr, advanceMinutes);
    const now = Date.now();
    const delaySeconds = Math.max(1, Math.floor((triggerDate.getTime() - now) / 1000));

    const title = '💊 用药提醒';
    const content = `${timeStr} 该服用 ${medName} 了，剂量 ${dosage}`;
    const payload = JSON.stringify({
      type: 'med_reminder',
      medName,
      timeStr,
      timestamp: now,
    });

    plus.push.createMessage(content, payload, {
      title,
      delay: delaySeconds,
      cover: false,
      when: triggerDate as any,
    } as any);

    const displayTime = advanceMinutes > 0 ? `${timeStr}（提前${advanceMinutes}分钟）` : timeStr;
    console.log(`[Notification] plus.push 定时推送: ${medName} ${displayTime}, ${delaySeconds}s后`);
    return true;
  } catch (e) {
    console.error('[Notification] plus.push 定时推送失败:', e);
    return false;
  }
  // #endif

  return false;
}

/**
 * 策略 2：AlarmManager + PendingIntent(getBroadcast) → BroadcastReceiver → NotificationCompat
 *
 * 不依赖 Push 模块！闹钟触发时通过动态注册的 BroadcastReceiver 直接发送通知栏通知。
 * 优势：App 在后台时也能弹出通知，不需要启动 Activity。
 */
function scheduleAlarmWithNotification(
  medId: string,
  medName: string,
  dosage: number | string,
  timeStr: string,
  advanceMinutes: number = 0,
): boolean {
  // #ifdef APP-PLUS
  try {
    const main = (plus.android as any).runtimeMainActivity();
    const context = main.getApplicationContext ? main.getApplicationContext() : main;
    const Context = plus.android.importClass('android.content.Context');
    const AlarmManager = plus.android.importClass('android.app.AlarmManager');
    const PendingIntent = plus.android.importClass('android.app.PendingIntent');
    const Intent = plus.android.importClass('android.content.Intent');

    const triggerDate = getNextTriggerDate(timeStr, advanceMinutes);
    const requestCode = generateRequestCode(medId, timeStr);
    const triggerTime = triggerDate.getTime();

    const receiverReady = registerAlarmReceiver();
    if (!receiverReady) {
      console.error('[Notification] BroadcastReceiver 未就绪，无法设置原生广播提醒');
      return false;
    }

    const payload = buildReminderPayload(medName, dosage, timeStr);

    const alarmIntent = new (Intent as any)(getReminderBroadcastAction(main));
    alarmIntent.setPackage(main.getPackageName());
    alarmIntent.putExtra(EXTRA_REMINDER_KEY, JSON.stringify(payload));
    alarmIntent.putExtra(EXTRA_NOTIFICATION_ID, requestCode);

    const pendingIntent = (PendingIntent as any).getBroadcast(
      context,
      requestCode,
      alarmIntent,
      (PendingIntent as any).FLAG_UPDATE_CURRENT | (PendingIntent as any).FLAG_IMMUTABLE,
    );

    // 设置闹钟
    const alarmManager = main.getSystemService((Context as any).ALARM_SERVICE) as any;
    const canScheduleExact = alarmManager?.canScheduleExactAlarms ? !!alarmManager.canScheduleExactAlarms() : true;

    try {
      if (canScheduleExact && alarmManager.setExactAndAllowWhileIdle) {
        alarmManager.setExactAndAllowWhileIdle((AlarmManager as any).RTC_WAKEUP, triggerTime, pendingIntent);
      } else if (canScheduleExact && alarmManager.setExact) {
        alarmManager.setExact((AlarmManager as any).RTC_WAKEUP, triggerTime, pendingIntent);
      } else {
        if (!canScheduleExact) {
          console.warn('[Notification] 精确闹钟权限缺失，当前提醒将降级为普通闹钟');
        }
        alarmManager.set((AlarmManager as any).RTC_WAKEUP, triggerTime, pendingIntent);
      }
    } catch (alarmErr) {
      console.warn('[Notification] 精确闹钟设置失败，回退到普通闹钟:', alarmErr);
      alarmManager.set((AlarmManager as any).RTC_WAKEUP, triggerTime, pendingIntent);
    }

    registeredRequestCodes.push(requestCode);
    persistAlarmCodes();

    const displayTime = advanceMinutes > 0 ? `${timeStr}（提前${advanceMinutes}分钟）` : timeStr;
    console.log(`[Notification] AlarmManager 已设置: ${medName} ${displayTime} → ${triggerDate.toLocaleString()}`);

    return true;
  } catch (e) {
    console.error(`[Notification] 闹钟设置失败 (${medName} ${timeStr}):`, e);
    return false;
  }
  // #endif

  return false;
}

/**
 * 清除所有已注册的闹钟（通过创建空 Intent 取消相同 requestCode 的 PendingIntent）
 */
function clearAllAlarms(): void {
  // #ifdef APP-PLUS
  if (registeredRequestCodes.length === 0) return;

  // ★ v14 安全限制：单次最多清除 100 个，防止低端机 ANR
  const MAX_BATCH_SIZE = 100;
  const codesToClear = registeredRequestCodes.slice(0, MAX_BATCH_SIZE);

  try {
    const main = (plus.android as any).runtimeMainActivity();
    const context = main.getApplicationContext ? main.getApplicationContext() : main;
    const Context = plus.android.importClass('android.content.Context');
    const AlarmManager = plus.android.importClass('android.app.AlarmManager');
    const PendingIntent = plus.android.importClass('android.app.PendingIntent');
    const Intent = plus.android.importClass('android.content.Intent');
    const alarmManager = main.getSystemService((Context as any).ALARM_SERVICE) as any;

    for (const rc of codesToClear) {
      const broadcastIntent = new (Intent as any)(getReminderBroadcastAction(main));
      broadcastIntent.setPackage(main.getPackageName());
      const broadcastPendingIntent = (PendingIntent as any).getBroadcast(
        context,
        rc,
        broadcastIntent,
        (PendingIntent as any).FLAG_NO_CREATE | (PendingIntent as any).FLAG_IMMUTABLE,
      );
      if (broadcastPendingIntent) {
        alarmManager.cancel(broadcastPendingIntent);
        broadcastPendingIntent.cancel();
      }

      // 兼容清理旧版 getActivity 闹钟，避免升级后遗留重复提醒
      const launchIntent = main.getPackageManager().getLaunchIntentForPackage(main.getPackageName());
      if (launchIntent) {
        const legacyIntent = new (Intent as any)(launchIntent);
        legacyIntent.addFlags((Intent as any).FLAG_ACTIVITY_NEW_TASK | (Intent as any).FLAG_ACTIVITY_CLEAR_TOP);
        legacyIntent.setAction((Intent as any).ACTION_MAIN);
        const legacyPendingIntent = (PendingIntent as any).getActivity(
          main,
          rc,
          legacyIntent,
          (PendingIntent as any).FLAG_NO_CREATE | (PendingIntent as any).FLAG_IMMUTABLE,
        );
        if (legacyPendingIntent) {
          alarmManager.cancel(legacyPendingIntent);
          legacyPendingIntent.cancel();
        }
      }
    }

    // 清除已处理的 requestCode（只清除这批）
    registeredRequestCodes.splice(0, codesToClear.length);

    // 如果还有剩余，延迟处理下一批
    if (registeredRequestCodes.length > 0) {
      setTimeout(() => clearAllAlarms(), 50);
      return; // 不执行 persistAlarmCodes，等全部清完后统一持久化
    }

    console.log(`[Notification] 已清除全部闹钟`);
  } catch (e) {
    console.warn('[Notification] 清除闹钟失败:', e);
  }

  registeredRequestCodes = [];
  persistAlarmCodes();
  // #endif
}

/**
 * ★ 核心入口：App 启动时/onShow 时调用此函数
 * 检查当前 Intent 是否由闹钟触发，如果是则发送通知并清除标记
 *
 * 必须在 onLaunch 或 onShow 中调用！
 */
export function checkAndFirePendingReminder(): boolean {
  // #ifdef APP-PLUS
  try {
    const main = (plus.android as any).runtimeMainActivity();

    // 检查是否有闹钟触发的 extra
    let intent = null;
    try {
      if (main.getIntent) {
        intent = main.getIntent();
      } else {
        intent = main.intent;
      }
    } catch (e) {
      console.warn('[Notification] 获取 Intent 失败:', e);
      return false;
    }
    
    if (!intent) {
      // console.log('[Notification] Intent 为空');
      return false;
    }

    let reminderJson = null;
    try {
      reminderJson = intent.getStringExtra(EXTRA_REMINDER_KEY);
    } catch (e) {
      console.warn('[Notification] 获取 extra 失败:', e);
    }
    
    if (!reminderJson) {
      // console.log('[Notification] 没有 reminder extra');
      return false;
    }

    // console.log('[Notification] 找到 reminder extra:', reminderJson.substring(0, 100));

    // 解析提醒数据
    let reminderData: { title: string; content: string; medName: string; timeStr: string };
    try {
      reminderData = JSON.parse(reminderJson);
    } catch (e) {
      console.warn('[Notification] 解析 reminder extra 失败:', e);
      return false;
    }

    // console.log(`[Notification] 🔔 收到闹钟触发: ${reminderData.title}`);

    // 清除 extra（避免重复触发）
    try {
      intent.removeExtra(EXTRA_REMINDER_KEY);
    } catch (e) {
      console.warn('[Notification] 清除 extra 失败:', e);
    }

    // 立即发送通知，不延迟
    sendLocalNotification(reminderData.title, reminderData.content, 1001);

    return true;
  } catch (e) {
    console.error('[Notification] checkAndFirePendingReminder 异常:', e);
    return false;
  }
  // #endif

  return false;
}

// ─────────────────────────────────────────────
// H5 端轮询
// ─────────────────────────────────────────────

let h5CheckInterval: ReturnType<typeof setInterval> | null = null;
const h5TriggeredToday = new Set<string>();

function startH5ReminderCheck(medications: Medication[], config: ReminderConfig): void {
  // #ifdef H5
  if (h5CheckInterval) clearInterval(h5CheckInterval);

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  h5CheckInterval = setInterval(() => {
    if (!config.enabled) return;

    const now = new Date();
    // 清理过期的 key（仅保留当日的条目）
    try {
      const todayKey = String(now.getDate());
      for (const key of Array.from(h5TriggeredToday)) {
        if (!key.endsWith(`_${todayKey}`)) h5TriggeredToday.delete(key);
      }
    } catch (e) {
      // ignore
    }
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const med of medications) {
      if (!med.isActive || !med.reminders) continue;
      for (const timeStr of med.reminders) {
        const key = `${med.id}_${timeStr}_${now.getDate()}`;
        if (h5TriggeredToday.has(key)) continue;
        if (currentTime === timeStr) {
          h5TriggeredToday.add(key);
          sendLocalNotification('\uD83D\uDC8A \u7528\u836F\u63D0\u9192', `${timeStr} 该服用 ${med.name} 了，剂量 ${med.dosage} 片`);
        }
      }
    }
  }, 30 * 1000);

  // console.log('[Notification] H5 轮询已启动（30s）');
  // #endif
}

// ─────────────────────────────────────────────
// 公开 API
// ─────────────────────────────────────────────

/**
 * 为单个药品注册提醒（双通道）
 */
export function scheduleMedicationReminder(med: Medication, config: ReminderConfig): number {
  if (!med.isActive || !med.reminders || med.reminders.length === 0) return 0;

  let count = 0;
  for (const timeStr of med.reminders) {
    // #ifdef APP-PLUS
    // 通道 1：plus.push 定时推送（如果 Push 模块可用）
    const pushOk = schedulePushNotification(med.name, med.dosage, timeStr, config.advanceMinutes ?? 0);

    // 通道 2：AlarmManager（始终设置，不依赖 Push 模块）
    const alarmOk = scheduleAlarmWithNotification(med.id, med.name, med.dosage, timeStr, config.advanceMinutes ?? 0);

    if (pushOk || alarmOk) count++;
    // #endif
  }

  return count;
}

/**
 * 为所有启用的药品注册提醒
 */
export function scheduleAllReminders(medications: Medication[], config?: ReminderConfig): void {
  clearAllReminders();

  const reminderConfig: ReminderConfig = config ?? {
    enabled: true,
    soundEnabled: true,
    vibrateEnabled: true,
    advanceMinutes: 0,
  };

  if (!reminderConfig.enabled) {
    return;
  }

  const activeMeds = medications.filter((m) => m.isActive);

  // ★ v14: 用 setTimeout(0) 让出主线程，避免长任务阻塞渲染
  setTimeout(() => {
    let totalCount = 0;
    for (const med of activeMeds) {
      totalCount += scheduleMedicationReminder(med, reminderConfig);
    }
    console.log(`[Notification] ✅ 已注册 ${totalCount} 条闹钟（${activeMeds.length} 种药品）`);
  }, 0);

  // H5 端启动轮询
  // #ifdef H5
  startH5ReminderCheck(medications, reminderConfig);
  // #endif
}

/**
 * 清除所有定时提醒
 */
export function clearAllReminders(): void {
  clearAllAlarms(); // App 端：取消所有 AlarmManager 闹钟

  // App 端：清除所有 plus.push 本地推送
  // #ifdef APP-PLUS
  try {
    if (plus.push && plus.push.clear) {
      plus.push.clear();
      console.log('[Notification] plus.push 已清除所有推送');
    }
  } catch (e) {
    console.warn('[Notification] plus.push 清除失败:', e);
  }
  // #endif

  // #ifdef H5
  if (h5CheckInterval) {
    clearInterval(h5CheckInterval);
    h5CheckInterval = null;
  }
  h5TriggeredToday.clear();
  // #endif
}

// ─────────────────────────────────────────────
// 库存预警
// ─────────────────────────────────────────────

export function sendStockWarning(medName: string, daysLeft: number): void {
  const title = '\u26A0\uFE0F \u5E93\u5B58\u9884\u8B66';  // ⚠️ 库存预警
  const content =
    daysLeft <= 0
      ? `${medName} 库存已用完，请尽快补充！`
      : `${medName} 库存仅剩 ${daysLeft} 天用量，请及时补充。`;
  sendLocalNotification(title, content);
}

export function checkAndWarnLowStock(medications: Medication[]): void {
  medications.forEach((med) => {
    if (!med.isActive) return;
    const daily = getDailyDosage(med.frequency, med.dosage);
    const days = calcDaysRemaining(med.stockCount, daily);
    if (days <= 3) sendStockWarning(med.name, days);
  });
}

// ─────────────────────────────────────────────
// 诊断函数
// ─────────────────────────────────────────────

export function diagnoseNotificationSystem(): Record<string, unknown> {
  const result: Record<string, unknown> = {
    sdkVersion: 0,
    exactAlarmPermission: false,
    notificationEnabled: false,
    channelExists: false,
    registeredAlarmCount: registeredRequestCodes.length,
    targetSdkNote: 'targetSdkVersion=31，SCHEDULE_EXACT_ALARM 默认授予',
  };

  // #ifdef APP-PLUS
  try {
    const main = (plus.android as any).runtimeMainActivity();
    const Build = plus.android.importClass('android.os.Build');
    result.sdkVersion = plus.android.invoke(Build, 'VERSION.SDK_INT') as number;

    const sdkInt = result.sdkVersion as number;

    // 精确闹钟权限
    if (sdkInt >= 31) {
      const am = main.getSystemService('alarm') as any;
      result.exactAlarmPermission = am ? (am.canScheduleExactAlarms() as boolean) : false;
    } else {
      result.exactAlarmPermission = true;
    }

    // 通知权限
    if (sdkInt >= 24) {
      const Context = plus.android.importClass('android.content.Context');
      const nm = main.getSystemService((Context as any).NOTIFICATION_SERVICE) as any;
      result.notificationEnabled = nm.areNotificationsEnabled() as boolean;

      if (sdkInt >= 26) {
        result.channelExists = !!nm.getNotificationChannel(NOTIFICATION_CHANNEL_ID);
      } else {
        result.channelExists = true;
      }
    } else {
      result.notificationEnabled = true;
      result.channelExists = true;
    }
  } catch (e) {
    console.error('[Notification] 诊断异常:', e);
  }
  // #endif

  // console.log('[Notification] 诊断结果:', JSON.stringify(result, null, 2));
  return result;
}
