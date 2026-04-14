# 🔴 Medtracker APP 启动卡死 — 完整排查报告

**日期**: 2026-04-13  
**现象**: 真机安装后 APP 一直显示加载页面，无法进入主界面  
**审查范围**: App.vue / manifest.json / stores/index.ts / notification.ts / index.vue / main.ts / pages.json

---

## 一、根因排序（按可能性）

| # | 根因 | 严重度 | 触发机制 |
|---|------|--------|----------|
| **1** | `alwaysShowBeforeRender=true` + 渲染异常 | 🔴 致命 | 首页报错 → 启动页永不关闭 |
| **2** | onLaunch 中 Android 原生操作密集阻塞 | 🔴 致命 | JS线程卡住 → 页面无法渲染 → 触发 #1 |
| **3** | `scheduleAllReminders` → `clearAllAlarms` 循环大量 requestCode | 🟠 高危 | 低端机 ANR 或严重卡顿 |
| **4** | `loadFromStorage` JSON.parse 失败无 fallback | 🟡 中危 | 数据损坏 → computed 异常 → 白屏 |
| **5** | onShow 重复调用 loadFromStorage 无防抖 | 🟡 中危 | 首页 + App.onShow 几乎同时触发 |

---

## 二、逐项详细分析

### 问题 1 [🔴 致命] Splashscreen 配置导致启动画面永远不关闭

**文件**: `src/manifest.json` 第 12-17 行

```json
"splashscreen": {
    "alwaysShowBeforeRender": true,   // ← 关键问题
    "waiting": true,
    "autoclose": true,
    "delay": 0
}
```

**为什么致命**:  
`alwaysShowBeforeRender: true` 的含义是：**必须等待首屏页面渲染完成后才关闭启动页**。如果首页渲染过程中发生任何异常（JS 报错、资源加载失败、原生 API 阻塞），启动页将 **永远不关闭**，用户看到的永远是加载画面。

这就像给门装了一把"渲染完成才能开"的锁，但钥匙（正常渲染）被后面的 #2 和 #3 偷走了。

---

### 问题 2 [🔴 致命] onLaunch 同步链路阻塞 UI 线程

**文件**: `src/App.vue` 第 9-44 行

```
onLaunch()
  ├── store.loadFromStorage()              // 5次 getStorageSync + 5次 JSON.parse (同步)
  ├── restoreRegisteredAlarmCodes()         // 读取 Storage + JSON.parse (同步)
  └── setTimeout(1000ms) 后:
        ├── createNotificationChannel()     // ★ Android NotificationManager JNI 调用
        ├── requestNotificationPermission() // ★ 返回 Promise 但未 await
        │     └── ActivityCompat.requestPermissions() // SDK_INT 查询 + 权限请求
        ├── scheduleAllReminders()
        │     └── clearAllReminders()
        │           └── clearAllAlarms()   // ★ 对每个 requestCode 执行：
        │                 ├── getPackageManager().getLaunchIntentForPackage()
        │                 ├── new Intent + PendingIntent.getActivity()
        │                 └── alarmManager.cancel(pendingIntent)  // ★ N次循环!
        └── checkAndFirePendingReminder()   // ★ getIntent() + getStringExtra()
              └── sendLocalNotification()    // ★ NotificationCompat.Builder + notify()
```

**关键阻塞点**:

1. **`clearAllAlarms()` (第399-443行)** — 对每个已注册的 `requestCode` 执行完整 JNI 调用链：
   - `getPackageManager().getLaunchIntentForPackage()` 
   - 创建 Intent、设置 Flags 和 Action
   - `PendingIntent.getActivity()` 
   - `alarmManager.cancel(pendingIntent)` + `pendingIntent.cancel()`
   
   如果有 **10个药品 × 3次/天 = 30+ 个 requestCode**，这就是 **30×6=180+ 次 JNI 调用**，全部同步执行在主线程上。

2. **`checkAndFirePendingReminder()` (第451-517行)** — 每次 App 显示都执行：
   - `main.getIntent()` / `main.intent` — 跨 JNI 边界
   - `intent.getStringExtra()` — 跨 JNI 边界
   - 如果 intent 异常可能抛错（虽然有 try-catch，但已在 setTimeout 内部）
   - 最后还调用 `sendLocalNotification()` 又是一轮 JNI 调用

3. **`requestNotificationPermission()` (第77行)** — 直接调用不 await，后续的 `scheduleAllReminders` 可能在权限未就绪时运行。

---

### 问题 3 [🟠 高危] scheduleAllReminders 无数量保护

**文件**: `src/utils/notification.ts` 第595行

```typescript
export function scheduleAllReminders(medications, config?) {
  clearAllReminders();          // 先清除所有闹钟
  const activeMeds = medications.filter(m => m.isActive);  // ★ 无上限
  for (const med of activeMeds) {
    totalCount += scheduleMedicationReminder(med, reminderConfig);
    // 每个药品 × 每个提醒时间 = 2通道(Push + AlarmManager)
  }
}
```

**没有 MAX_MEDS_PER_BATCH 限制**。如果有大量活跃药品，`clearAllAlarms()` 中的 for 循环会长时间占用 JS 线程，导致 uni-app 渲染管线无法推进。

---

### 问题 4 [🟡 中危] loadFromStorage 缺少防御性 fallback

**文件**: `src/stores/index.ts` 第171-216 行

```typescript
function loadFromStorage() {
    try {
      const medsData = uni.getStorageSync(STORAGE_KEYS.MEDICATIONS);
      if (medsData) {
        medications.value = JSON.parse(medsData as string);  // ★ 数据损坏？
      }
      // ★ 没有 else 分支！medications 可能保持 undefined
    } catch (e) {
      console.error('加载药品数据失败', e);
      // ★ catch 后也没有设置默认值！
    }
    // ... 其余4个字段同样的问题
}
```

**风险链**:  
`JSON.parse` 失败 → `medications.value` 为空/undefined → `activeMedlications` computed 访问 `.filter` 时可能报错 → 首页模板渲染崩溃 → 触发 `alwaysShowBeforeRender` 死锁 (#1)

---

### 问题 5 [🟡 中危] onShow 重复调用无防抖

```typescript
// App.vue 第46-65行
onShow(() => {
  store.loadFromStorage();           // ← 第1次
  setTimeout(() => { ... }, 300);
});

// index.vue 第174-177行  
onShow(() => {
  store.loadFromStorage();           // ← 第2次（几乎同时）
});
```

`App.onShow` 和首页 `index.onShow` 在首次启动时 **几乎同时触发**。`loadFromStorage()` 是同步操作（5次 Storage 读取 + 5次 JSON.parse），虽然单次很快，但两次叠加 + 无防抖保护，在低端真机上可能造成短暂但关键的卡顿窗口。

---

### 问题 6 [🟢 低危] targetSdkVersion=31 与精确闹钟权限

**文件**: `manifest.json` 第40-41行 + 第49行

```
targetSdkVersion: 31  (Android 12)
SCHEDULE_EXACT_ALARM 权限: 已声明
USE_EXACT_ALARM 权限: 已声明（实际需要 API 33+）
```

Android 12 引入了精确闹钟限制。`setExactAndAllowWhileIdle()` 在用户拒绝精确闹钟权限时抛出 `SecurityException`。代码有 try-catch 回退到普通 `set()`，但如果回退路径也因其他原因失败（如 Doze 模式限制），可能导致部分闹钟静默失败——但这不会导致白屏，只会影响通知到达率。

---

## 三、完整修复方案

### Fix 1: 修改 Splashscreen 配置 ⭐ 最重要

**文件**: `src/manifest.json`

```json
"splashscreen": {
    "alwaysShowBeforeRender": false,   // ★ 改为 false：固定时间后关闭，不依赖渲染状态
    "autoclose": true,
    "delay": 1500                       // ★ 固定 1.5 秒后关闭
},
"distribute": {
    "splashscreen": {
        "androidStyle": "common",
        "waiting": false               // ★ 关闭等待圈
    }
}
```

**为什么这样改**: 把"等渲染完再关"改成"1.5秒后一定关"。即使后面有问题，用户至少能看到页面和白屏错误提示，而不是永远卡在启动图。

---

### Fix 2: 通知初始化改为异步非阻塞

**文件**: `src/App.vue`

```typescript
onLaunch(() => {
  const store = useMedStore();
  store.loadFromStorage();
  restoreRegisteredAlarmCodes();

  // ★ 延迟增加到 2 秒，确保 plus.android 完全就绪
  // ★ 用 nextTick 确保 DOM 渲染不被阻塞
  setTimeout(() => {
    uni.nextTick(async () => {
      try {
        initNotifications(store.medications, store.reminderConfig);
        checkAndFirePendingReminder();
      } catch(e) {
        console.error('[App] 通知初始化失败:', e);
      }
      hasInitialized = true;
    });
  }, 2000);  // ★ 从 1000ms 改为 2000ms
});
```

---

### Fix 3: loadFromStorage 加完善 fallback

**文件**: `src/stores/index.ts` 第171-216 行

```typescript
function loadFromStorage() {
  // 药品数据
  try {
    const medsData = uni.getStorageSync(STORAGE_KEYS.MEDICATIONS);
    if (medsData && typeof medsData === 'string') {
      const parsed = JSON.parse(medsData as string);
      medications.value = Array.isArray(parsed) ? parsed : [];
    } else {
      medications.value = [];  // ★ 显式 fallback
    }
  } catch (e) {
    console.error('加载药品数据失败', e);
    medications.value = [];   // ★ catch 中也设置默认值
  }

  // 服药记录
  try {
    const logsData = uni.getStorageSync(STORAGE_KEYS.INTAKE_LOGS);
    if (logsData && typeof logsData === 'string') {
      const parsed = JSON.parse(logsData as string);
      intakeLogs.value = Array.isArray(parsed) ? parsed : [];
    } else {
      intakeLogs.value = [];
    }
  } catch (e) {
    console.error('加载服药记录失败', e);
    intakeLogs.value = [];
  }

  // 提醒配置（有默认值，更安全）
  try {
    const configData = uni.getStorageSync(STORAGE_KEYS.REMINDER_CONFIG);
    if (configData && typeof configData === 'string') {
      reminderConfig.value = { ...reminderConfig.value, ...JSON.parse(configData) };
    }
  } catch (e) {
    console.error('加载提醒配置失败', e);
  }

  // 每日拍照配置
  try {
    const photoConfigData = uni.getStorageSync(STORAGE_KEYS.DAILY_PHOTO_CONFIG);
    if (photoConfigData && typeof photoConfigData === 'string') {
      dailyPhotoConfig.value = { ...dailyPhotoConfig.value, ...JSON.parse(photoConfigData) };
    }
  } catch (e) {
    console.error('加载每日拍照配置失败', e);
  }

  // 每日拍照记录
  try {
    const photoLogsData = uni.getStorageSync(STORAGE_KEYS.DAILY_PHOTO_LOGS);
    if (photoLogsData && typeof photoLogsData === 'string') {
      const parsed = JSON.parse(photoLogsData as string);
      dailyPhotoLogs.value = Array.isArray(parsed) ? parsed : [];
    } else {
      dailyPhotoLogs.value = [];
    }
  } catch (e) {
    console.error('加载每日拍照记录失败', e);
    dailyPhotoLogs.value = [];
  }
}
```

---

### Fix 4: scheduleAllReminders 增加 timeout 保护 + 分帧

**文件**: `src/utils/notification.ts` 第595行附近

```typescript
export function scheduleAllReminders(medications: Medication[], config?: ReminderConfig): void {
  clearAllReminders();

  const reminderConfig: ReminderConfig = config ?? {
    enabled: true,
    soundEnabled: true,
    vibrateEnabled: true,
    advanceMinutes: 0,
  };

  if (!reminderConfig.enabled) return;

  const activeMeds = medications.filter((m) => m.isActive);

  // ★ 用 setTimeout(0) 让出主线程，避免长任务阻塞渲染
  setTimeout(() => {
    for (const med of activeMeds) {
      scheduleMedicationReminder(med, reminderConfig);
    }
  }, 0);
}
```

---

### Fix 5: clearAllAlarms 增加数量限制

**文件**: `src/utils/notification.ts` 第399行附近

```typescript
function clearAllAlarms(): void {
  // #ifdef APP-PLUS
  if (registeredRequestCodes.length === 0) return;

  // ★ 安全限制：单次最多清除 100 个
  const codesToClear = registeredRequestCodes.slice(0, 100);

  try {
    const main = (plus.android as any).runtimeMainActivity();
    const Context = plus.android.importClass('android.content.Context');
    const AlarmManager = plus.android.importClass('android.app.AlarmManager');
    const PendingIntent = plus.android.importClass('android.app.PendingIntent');
    const Intent = plus.android.importClass('android.content.Intent');
    const alarmManager = main.getSystemService((Context as any).ALARM_SERVICE) as any;

    const launchIntent = main.getPackageManager().getLaunchIntentForPackage(main.getPackageName());
    if (!launchIntent) {
      registeredRequestCodes = [];
      persistAlarmCodes();
      return;
    }

    for (const rc of codesToClear) {
      const emptyIntent = new (Intent as any)(launchIntent);
      emptyIntent.addFlags((Intent as any).FLAG_ACTIVITY_NEW_TASK | (Intent as any).FLAG_ACTIVITY_CLEAR_TOP);
      emptyIntent.setAction((Intent as any).ACTION_MAIN);
      const pendingIntent = (PendingIntent as any).getActivity(
        main, rc, emptyIntent,
        (PendingIntent as any).FLAG_NO_CREATE | (PendingIntent as any).FLAG_IMMUTABLE
      );
      if (pendingIntent) {
        alarmManager.cancel(pendingIntent);
        pendingIntent.cancel();
      }
    }

    // 清除已处理的 requestCode
    registeredRequestCodes.splice(0, codesToClear.length);
    
    // 如果还有剩余，延迟处理下一批
    if (registeredRequestCodes.length > 0) {
      setTimeout(() => clearAllAlarms(), 50);
      return;  // 不执行 persistAlarmCodes，等全部清完后统一持久化
    }
  } catch (e) {
    console.warn('[Notification] 清除闹钟失败:', e);
  }

  registeredRequestCodes = [];
  persistAlarmCodes();
  // #endif
}
```

---

### Fix 6: 首页 onShow 增加防抖

**文件**: `src/pages/index/index.vue` 第174行附近

```typescript
let _lastLoadTime = 0;
const LOAD_DEBOUNCE_MS = 500;

onShow(() => {
  const now = Date.now();
  if (now - _lastLoadTime < LOAD_DEBOUNCE_MS) return;  // ★ 防抖
  _lastLoadTime = now;
  store.loadFromStorage();
});
```

---

### Fix 7: 全局错误兜底（可选但推荐）

**文件**: `src/main.ts`

```typescript
import { createSSRApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";

export function createApp() {
  const app = createSSRApp(App);
  const pinia = createPinia();
  app.use(pinia);

  // ★ 全局错误兜底 — 防止未捕获异常导致白屏
  app.config.errorHandler = (err, vm, info) => {
    console.error('[Global Error]', err, info);
    // 可以在这里上报到错误监控服务
  };

  return { app };
}
```

---

## 四、调试步骤建议

如果应用上述修复后仍有问题，按以下顺序定位：

### Step 1: 开启远程调试
1. 手机连接电脑，开启 USB 调试
2. Chrome 访问 `chrome://inspect`
3. 找到 Medtracker 的 WebView，点击 `inspect`
4. 查看 Console 是否有红色错误

### Step 2: Logcat 日志过滤
```bash
adb logcat | grep -E "(Medtracker|Notification|uni-app|Console)"
```
重点关注 `[Global Error]`、`[App]`、`[Notification]` 前缀的日志。

### Step 3: 快速验证是否通知模块导致
临时注释掉 `App.vue` 中的通知初始化代码：

```typescript
// 临时注释以下两行来验证
// initNotifications(store.medications, store.reminderConfig);
// checkAndFirePendingReminder();
hasInitialized = true;  // 这行保留
```

如果注释后 APP 能正常进入首页，则确认是通知模块的问题，逐一恢复并观察。

### Step 4: 检查 Storage 数据完整性
在控制台执行：
```javascript
uni.getStorageSync('medreminder_medications')
```
查看返回值是否为合法 JSON 数组。

---

## 五、修复优先级矩阵

| Fix | 影响 | 工作量 | 推荐优先级 |
|-----|------|--------|-----------|
| Fix 1: splashscreen 配置 | 解决"永远卡住"的视觉表现 | 改1行配置 | **P0 — 必须先做** |
| Fix 2: 异步化通知初始化 | 解除 JS 线程阻塞根因 | 改5行代码 | **P0 — 必须做** |
| Fix 3: loadFromStorage fallback | 防止数据损坏导致白屏 | 改20行 | **P0 — 强烈建议** |
| Fix 4: scheduleAllReminders 分帧 | 防止大量药品时卡顿 | 改3行 | **P1 — 建议** |
| Fix 5: clearAllAlarms 限流 | 防止低端机 ANR | 改15行 | **P1 — 建议** |
| Fix 6: 首页防抖 | 消除重复加载 | 改5行 | **P2 — 锦上添花** |
| Fix 7: 全局错误兜底 | 兜住未知异常 | 改4行 | **P2 — 推荐** |

---

## 六、总结

> **核心结论**：APP 卡在加载页面的最可能原因是 **Splashscreen `alwaysShowBeforeRender=true` 与通知初始化中大量 Android 原生 API 调用的组合效应**。
>
> 1. `setTimeout(1000ms)` 后开始执行通知初始化
> 2. `clearAllAlarms()` 对每个 requestCode 执行 6+ 次 JNI 调用
> 3. 这些同步调用占满 JS 线程 → 首页无法完成渲染
> 4. `alwaysShowBeforeRender=true` 要求渲染完成后才关闭启动页
> 5. **死锁形成**：启动页永远不关闭 → 用户永远看到加载画面

**最小可行修复**（只需改 2 个文件就能验证）：
1. `manifest.json`: `alwaysShowBeforeRender` → `false`, `delay` → `1500`
2. `App.vue`: 通知初始化延时从 1000ms → 2000ms，包裹在 `try-catch` 中

---

*报告生成时间: 2026-04-13 23:03*  
*审查工具: Code Explorer Agent v1*
