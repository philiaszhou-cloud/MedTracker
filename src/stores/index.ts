import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Medication, IntakeLog, ReminderConfig, StockAlert } from '../types';
import { generateId, getDailyDosage, calcDaysRemaining, getCurrentTimeStr, parseDosageToNumber } from '../utils';
import { scheduleAllReminders } from '../utils/notification';
import { deletePersistedImage } from '../utils/imageStorage';

// 本地存储 key
const STORAGE_KEYS = {
  MEDICATIONS: 'medreminder_medications',
  INTAKE_LOGS: 'medreminder_intake_logs',
  REMINDER_CONFIG: 'medreminder_reminder_config',
  DAILY_PHOTO_CONFIG: 'medreminder_daily_photo_config',
  DAILY_PHOTO_LOGS: 'medreminder_daily_photo_logs',
};

export const useMedStore = defineStore('medication', () => {
  // ===== 药品列表 =====
  const medications = ref<Medication[]>([]);

  // ===== 服药记录 =====
  const intakeLogs = ref<IntakeLog[]>([]);

  // ===== 提醒配置 =====
  const reminderConfig = ref<ReminderConfig>({
    enabled: true,
    soundEnabled: true,
    vibrateEnabled: true,
    advanceMinutes: 0,
  });

  // ===== 每日拍照记录配置 =====
  const dailyPhotoConfig = ref({
    enabled: false,         // 是否启用每日拍照记录
    requireDaily: false,    // 是否强制每日拍照校验
    lastPhotoDate: '',      // 最后一次拍照的日期
  });

  // ===== 每日拍照记录 =====
  const dailyPhotoLogs = ref<{
    date: string; // YYYY-MM-DD
    pillCount: number; // 拍照识别的药片数量
    expectedCount: number; // 预期的每日用药数量
    photoUri: string; // 拍照的 URI
    status: 'pending' | 'completed' | 'mismatch'; // pending: 未拍照, completed: 完成且数量正确, mismatch: 数量不符
    timestamp: number;
  }[]>([]);

  // ===== 计算属性 =====
  
  // 活跃的药品
  const activeMedications = computed(() => 
    medications.value.filter(m => m.isActive)
  );

  // 今天的服药记录
  const todayLogs = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    return intakeLogs.value.filter(log => log.timestamp >= todayStart);
  });

  // 今日已服药数量
  const todayTakenCount = computed(() => 
    todayLogs.value.filter(l => l.status === 'taken').length
  );

  // 今日需服药总数
  const todayTotalCount = computed(() => {
    let total = 0;
    activeMedications.value.forEach(med => {
      total += med.reminders.length;
    });
    return total;
  });

  // 库存预警列表
  const stockAlerts = computed<StockAlert[]>(() => {
    const alerts: StockAlert[] = [];
    activeMedications.value.forEach(med => {
      const dailyUsage = getDailyDosage(med.frequency, med.dosage);
      const daysRemaining = calcDaysRemaining(med.stockCount, dailyUsage);
      if (daysRemaining <= 3) {
        alerts.push({
          medicationId: med.id,
          medicationName: med.name,
          stockCount: med.stockCount,
          daysRemaining,
        });
      }
    });
    return alerts;
  });

  // 今日待办提醒
  const todayReminders = computed(() => {
    const currentTime = getCurrentTimeStr();
    const reminders: {
      medicationId: string;
      medicationName: string;
      dosage: string;
      scheduledTime: string;
      status: 'pending' | 'done';
    }[] = [];

    activeMedications.value.forEach(med => {
      med.reminders.forEach(time => {
        // 检查是否已记录
        const log = todayLogs.value.find(
          l => l.medicationId === med.id && l.scheduledTime === time
        );
        reminders.push({
          medicationId: med.id,
          medicationName: med.name,
          dosage: med.dosage,
          scheduledTime: time,
          status: log ? 'done' : 'pending',
        });
      });
    });

    return reminders.sort((a, b) => {
      // pending 排前面，再按时间排序
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });
  });

  // 今日预期服药总数量（用于拍照校验）
  const todayExpectedPillCount = computed(() => {
    let total = 0;
    activeMedications.value.forEach(med => {
      // 根据频率计算每日用量（getDailyDosage 接受字符串类型的 dosage）
      const dailyCount = getDailyDosage(med.frequency, med.dosage);
      total += dailyCount;
    });
    return total;
  });

  // 今日是否已完成拍照记录
  const todayPhotoStatus = computed(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    return dailyPhotoLogs.value.find(log => log.date === today) || null;
  });

  // ===== 数据持久化 =====

  function saveMedications() {
    uni.setStorageSync(STORAGE_KEYS.MEDICATIONS, JSON.stringify(medications.value));
  }

  function saveIntakeLogs() {
    uni.setStorageSync(STORAGE_KEYS.INTAKE_LOGS, JSON.stringify(intakeLogs.value));
  }

  function saveReminderConfig() {
    uni.setStorageSync(STORAGE_KEYS.REMINDER_CONFIG, JSON.stringify(reminderConfig.value));
  }

  function saveDailyPhotoConfig() {
    uni.setStorageSync(STORAGE_KEYS.DAILY_PHOTO_CONFIG, JSON.stringify(dailyPhotoConfig.value));
  }

  function saveDailyPhotoLogs() {
    uni.setStorageSync(STORAGE_KEYS.DAILY_PHOTO_LOGS, JSON.stringify(dailyPhotoLogs.value));
  }

  // 从本地存储加载数据（v14: 防御性 fallback，防止数据损坏导致白屏）
  function loadFromStorage() {
    // 药品数据
    try {
      const medsData = uni.getStorageSync(STORAGE_KEYS.MEDICATIONS);
      if (medsData && typeof medsData === 'string') {
        const parsed = JSON.parse(medsData as string);
        medications.value = Array.isArray(parsed) ? parsed : [];
      } else {
        medications.value = [];
      }
    } catch (e) {
      console.error('加载药品数据失败', e);
      medications.value = [];
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

  // ===== 药品管理操作 =====

  // 添加药品
  function addMedication(med: Omit<Medication, 'id' | 'createdAt' | 'isActive'>) {
    const newMed: Medication = {
      ...med,
      id: generateId(),
      createdAt: Date.now(),
      isActive: true,
    };
    medications.value.push(newMed);
    saveMedications();
    // 重新注册所有提醒
    scheduleAllReminders(medications.value, reminderConfig.value);
    return newMed;
  }

  // 更新药品
  function updateMedication(id: string, updates: Partial<Medication>) {
    const index = medications.value.findIndex(m => m.id === id);
    if (index !== -1) {
      medications.value[index] = { ...medications.value[index], ...updates };
      saveMedications();
      // 重新注册所有提醒
      scheduleAllReminders(medications.value, reminderConfig.value);
    }
  }

  // 删除药品
  function removeMedication(id: string) {
    const index = medications.value.findIndex(m => m.id === id);
    if (index !== -1) {
      const med = medications.value[index];
      // 清理持久化照片
      deletePersistedImage(med.boxImageUri);
      deletePersistedImage(med.pillImageUri);
      deletePersistedImage(med.imageUri || '');
      
      medications.value.splice(index, 1);
      saveMedications();
      // 重新注册所有提醒
      scheduleAllReminders(medications.value, reminderConfig.value);
    }
  }

  // 切换药品启用/禁用
  function toggleMedication(id: string) {
    const med = medications.value.find(m => m.id === id);
    if (med) {
      med.isActive = !med.isActive;
      saveMedications();
      // 重新注册所有提醒
      scheduleAllReminders(medications.value, reminderConfig.value);
    }
  }

  // 补充库存（识别后一键补药）
  function addStock(id: string, count: number) {
    const med = medications.value.find(m => m.id === id);
    if (med) {
      med.stockCount += count;
      saveMedications();
    }
  }

  // ===== 服药记录操作 =====

  // 记录服药
  function recordIntake(medicationId: string, status: 'taken' | 'skipped' | 'missed' = 'taken', scheduledTime: string) {
    const med = medications.value.find(m => m.id === medicationId);
    if (!med) return;

    const log: IntakeLog = {
      id: generateId(),
      medicationId,
      medicationName: med.name,
      timestamp: Date.now(),
      status,
      scheduledTime,
    };

    intakeLogs.value.unshift(log);
    saveIntakeLogs();

    // 如果是已服药，扣除库存（更稳健地解析剂量）
    if (status === 'taken') {
      try {
        const dosage = Math.max(0, parseDosageToNumber(med.dosage));
        med.stockCount = Math.max(0, med.stockCount - dosage);
        saveMedications();
      } catch (e) {
        med.stockCount = Math.max(0, med.stockCount - 1);
        saveMedications();
      }
    }
  }

  // 更新提醒配置
  function updateReminderConfig(updates: Partial<ReminderConfig>) {
    reminderConfig.value = { ...reminderConfig.value, ...updates };
    saveReminderConfig();
    // 配置变更后重新注册提醒（如关闭提醒、修改提前时间等）
    scheduleAllReminders(medications.value, reminderConfig.value);
  }

  // 更新每日拍照配置
  function updateDailyPhotoConfig(updates: Partial<typeof dailyPhotoConfig.value>) {
    dailyPhotoConfig.value = { ...dailyPhotoConfig.value, ...updates };
    saveDailyPhotoConfig();
  }

  // 记录今日拍照
  function recordDailyPhoto(pillCount: number, photoUri: string) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    
    // 检查是否已有今日记录，有则更新
    const existingIndex = dailyPhotoLogs.value.findIndex(log => log.date === today);
    
    const status: 'completed' | 'mismatch' = 
      pillCount === todayExpectedPillCount.value ? 'completed' : 'mismatch';
    
    const photoLog = {
      date: today,
      pillCount,
      expectedCount: todayExpectedPillCount.value,
      photoUri,
      status,
      timestamp: Date.now(),
    };

    if (existingIndex !== -1) {
      dailyPhotoLogs.value[existingIndex] = photoLog;
    } else {
      dailyPhotoLogs.value.push(photoLog);
    }

    saveDailyPhotoLogs();
    return status;
  }

  return {
    // State
    medications,
    intakeLogs,
    reminderConfig,
    dailyPhotoConfig,
    dailyPhotoLogs,
    // Computed
    activeMedications,
    todayLogs,
    todayTakenCount,
    todayTotalCount,
    stockAlerts,
    todayReminders,
    todayExpectedPillCount,
    todayPhotoStatus,
    // Actions
    loadFromStorage,
    addMedication,
    updateMedication,
    removeMedication,
    toggleMedication,
    addStock,
    recordIntake,
    updateReminderConfig,
    updateDailyPhotoConfig,
    recordDailyPhoto,
  };
});
