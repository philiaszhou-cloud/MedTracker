// 用药类型
export type MedicationType = 'daily' | 'temporary';

export interface MedicationIncomingStock {
  stockCount: number;
  expiryDate: string;
  receivedAt: number;
}

// 药品数据模型
export interface Medication {
  id: string;
  name: string;
  brand?: string; // 品牌，如 "同仁堂"
  specification: string; // 规格，如 "10mg"
  dosage: string; // 单次剂量，如 "2片"
  frequency: FrequencyType; // 服药频率
  customFrequency?: string; // 自定义频率描述
  stockCount: number; // 剩余库存
  reminders: string[]; // 提醒时间数组 ["08:00", "20:00"]
  medicationType: MedicationType; // 用药类型：日常 | 临时
  boxImageUri: string; // 药盒照片（必填）
  pillImageUri: string; // 药片照片（必填）
  expiryDate: string; // 保质期，格式 "YYYY-MM"
  activeStockCount?: number; // 当前正在使用批次的剩余库存
  incomingStock?: MedicationIncomingStock; // 已入库但尚未启用的新批次
  imageUri?: string; // 兼容旧字段
  notes?: string; // 备注
  createdAt: number; // 创建时间
  isActive: boolean; // 是否启用
}

// 服药频率类型
export type FrequencyType = 
  | 'once_daily'      // 每日1次
  | 'twice_daily'     // 每日2次
  | 'thrice_daily'    // 每日3次
  | 'every_other_day' // 隔日1次
  | 'weekly'          // 每周1次
  | 'custom';         // 自定义

// 服药记录
export interface IntakeLog {
  id: string;
  medicationId: string;
  medicationName: string;
  timestamp: number;
  status: 'taken' | 'skipped' | 'missed';
  scheduledTime: string; // 计划服药时间 "08:00"
}

// 提醒配置
export interface ReminderConfig {
  enabled: boolean;
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  advanceMinutes: number; // 提前提醒分钟数
}

// 库存预警
export interface StockAlert {
  medicationId: string;
  medicationName: string;
  stockCount: number;
  daysRemaining: number;
}

// 药片识别结果（分组后）
export interface RecognizeGroup {
  medicationId: string | null;
  medicationName: string;
  count: number;
  confidence: number;
  medication?: Medication;  // 完整药品信息（已匹配时存在）
}

// 用药类型标签
export const MEDICATION_TYPE_LABELS: Record<MedicationType, string> = {
  daily: '日常用药',
  temporary: '临时用药',
};

// 频率显示名称映射
export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  once_daily: '每日1次',
  twice_daily: '每日2次',
  thrice_daily: '每日3次',
  every_other_day: '隔日1次',
  weekly: '每周1次',
  custom: '自定义',
};

// 默认提醒时间
export const DEFAULT_REMINDER_TIMES: Record<string, string[]> = {
  once_daily: ['08:00'],
  twice_daily: ['08:00', '20:00'],
  thrice_daily: ['08:00', '14:00', '20:00'],
  every_other_day: ['08:00'],
  weekly: ['08:00'],
  custom: [],
};
