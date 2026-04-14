/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * 格式化日期
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化时间
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 格式化日期时间（用于显示）
 */
export function formatDateTime(timestamp: number): string {
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
}

/**
 * 获取今天是星期几
 */
export function getWeekday(date: Date = new Date()): string {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return `星期${days[date.getDay()]}`;
}

/**
 * 获取今日友好日期
 */
export function getTodayLabel(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `${month}月${day}日 ${getWeekday(now)}`;
}

/**
 * 比较时间字符串（HH:MM）
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareTime(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * 获取当前时间字符串 HH:MM
 */
export function getCurrentTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * 计算库存可用天数
 */
export function calcDaysRemaining(stockCount: number, dailyUsage: number): number {
  if (dailyUsage <= 0) return Infinity;
  return Math.floor(stockCount / dailyUsage);
}

/**
 * 获取每日用量
 */
export function parseDosageToNumber(dosageStr: string | number | undefined): number {
  if (typeof dosageStr === 'number') return dosageStr;
  if (!dosageStr) return 1;
  const s = String(dosageStr).trim();

  // Try to match decimal numbers like 1.5 or integers
  const numMatch = s.match(/([\d]+(?:\.[\d]+)?)/);
  if (numMatch) {
    const v = parseFloat(numMatch[1]);
    if (!Number.isNaN(v)) return v;
  }

  // Handle simple Chinese '半' (half)
  if (s.includes('半')) {
    // '半片' or '1又半片' etc.
    const preNum = s.match(/(\d+)\s*又\s*半/);
    if (preNum) {
      const v = parseInt(preNum[1], 10);
      if (!Number.isNaN(v)) return v + 0.5;
    }
    // startsWith 半 -> 0.5
    if (s.startsWith('半')) return 0.5;
  }

  // Fractions like 1/2
  const frac = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (frac) {
    const a = parseFloat(frac[1]);
    const b = parseFloat(frac[2]);
    if (!Number.isNaN(a) && !Number.isNaN(b) && b !== 0) return a / b;
  }

  // Fallback to 1
  return 1;
}

export function getDailyDosage(frequency: string, dosageStr: string): number {
  const dosage = parseDosageToNumber(dosageStr);
  const freqMap: Record<string, number> = {
    once_daily: 1,
    twice_daily: 2,
    thrice_daily: 3,
    every_other_day: 0.5,
    weekly: 1 / 7,
  };

  if (frequency === 'custom') {
    // Attempt to parse patterns like "每周3次" from dosageStr
    const m = (dosageStr || '').match(/每周\s*(\d+)\s*次|周\s*(\d+)\s*次|(\d+)\s*次\/?周/);
    const timesPerWeek = m ? parseInt(m[1] || m[2] || m[3], 10) : NaN;
    if (!Number.isNaN(timesPerWeek) && timesPerWeek > 0) {
      return dosage * (timesPerWeek / 7);
    }
    // If cannot parse, fallback to dosage as daily amount (safer than returning 0)
    return dosage;
  }

  const multiplier = freqMap[frequency] ?? 1;
  return dosage * multiplier;
}

/**
 * 获取状态文字和颜色
 */
export function getIntakeStatusInfo(status: string): { text: string; color: string } {
  const map: Record<string, { text: string; color: string }> = {
    taken: { text: '已服药', color: '#4CAF50' },
    skipped: { text: '已跳过', color: '#FF9800' },
    missed: { text: '已漏服', color: '#F44336' },
  };
  return map[status] || { text: '未知', color: '#999' };
}
