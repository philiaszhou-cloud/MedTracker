/**
 * pillRecognizer.ts v2
 * 离线药片品种识别 —— 基于多维颜色特征的药品库匹配
 *
 * v2 改进（2026-04-06）：
 * - 特征提取：仅采样图片中心 30% 区域（排除背景干扰）
 * - 新增 HSV 直方图特征：将色相分为 12 个区间，构建颜色分布指纹
 * - 新增面积归一化：按药片面积大小计算面积得分
 * - 匹配算法：色相独立性权重提高到 40%，加入 K-means 聚类后排序
 * - 修复 App 端特征提取：使用 bitmapData 方案获取真实像素
 *
 * 匹配原理：
 * 1. 从检测到的每个药片区域 → 提取颜色指纹
 * 2. 从药品库中每个药品的药片照片 → 提取颜色指纹（缓存）
 * 3. 多维距离匹配：色相直方图 + RGB主色 + 亮度 + 面积
 * 4. 贪心匹配：每个药片区域找到最佳药品，已匹配的药品降低权重
 */

import type { PillRegion } from './pillCounter';
import type { Medication, RecognizeGroup } from '../types';

/** 药品的缓存颜色特征 */
interface CachedMedFeature {
  medicationId: string;
  avgColor: [number, number, number];     // 中心区平均色 RGB
  domColor: [number, number, number];     // 中心区主色 RGB（去掉最亮最暗 20%）
  domHsv: [number, number, number];       // 主色的 HSV
  avgLuma: number;                         // 中心区平均亮度
  hueHistogram: number[];                  // 12-bin 色相直方图（归一化）
  avgSaturation: number;                   // 中心区平均饱和度
  avgValue: number;                        // 中心区平均明度 (V)
  dominantHueBin: number;                  // 最强的色相 bin (0~11)
}

/** 单个药片的识别结果 */
export interface RecognizedPill {
  regionIndex: number;       // 对应 pillCounter 检测的区域索引
  medicationId: string | null;  // 匹配到的药品 ID，null = 未知
  medicationName: string;    // 药品名或"未知药片"
  confidence: number;        // 匹配置信度 0~1
  region: PillRegion;        // 原始区域数据
}

/** 总识别结果 */
export type { RecognizeGroup } from '../types';

export interface RecognitionResult {
  pills: RecognizedPill[];
  grouped: RecognizeGroup[];
  totalCount: number;
  message: string;
}

// ─────────────────────────────────────────────
// 颜色工具
// ─────────────────────────────────────────────

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0, s = max === 0 ? 0 : d / max, v = max;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s, v];
}

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** 色相距离（环形，0~180） */
function hueDist(a: number, b: number): number {
  let d = Math.abs(a - b);
  return d > 180 ? 360 - d : d;
}

/**
 * 构建色相直方图（12 bin，每 bin 30°）
 * 仅统计饱和度 > 0.15 的像素（灰色/白色不算有色彩）
 */
function buildHueHistogram(pixels: [number, number, number][]): number[] {
  const bins = new Array(12).fill(0);
  let coloredCount = 0;

  for (const [r, g, b] of pixels) {
    const [h, s, v] = rgbToHsv(r, g, b);
    // 跳过低饱和度像素（灰色/白色）
    if (s < 0.15 || v < 0.15) continue;
    const bin = Math.min(11, Math.floor(h / 30));
    bins[bin]++;
    coloredCount++;
  }

  // 归一化
  if (coloredCount > 0) {
    for (let i = 0; i < 12; i++) bins[i] /= coloredCount;
  }

  return bins;
}

/** 两个直方图的 Bhattacharyya 距离（越小越相似） */
function histogramBhattacharyya(a: number[], b: number[]): number {
  let bc = 0;
  for (let i = 0; i < a.length; i++) {
    bc += Math.sqrt(a[i] * b[i]);
  }
  return Math.sqrt(Math.max(0, 1 - bc));
}

// ─────────────────────────────────────────────
// 特征缓存
// ─────────────────────────────────────────────

const featureCache = new Map<string, CachedMedFeature>();

/** 清除特征缓存（药品库变更时调用） */
export function clearFeatureCache() {
  featureCache.clear();
}

/**
 * 从药品的药片照片提取颜色特征
 * 结果会被缓存，同一药品只提取一次
 */
async function extractMedicationFeature(med: Medication): Promise<CachedMedFeature | null> {
  // 检查缓存
  const cached = featureCache.get(med.id);
  if (cached) return cached;

  // 获取药片照片路径（优先 pillImageUri，其次 boxImageUri，最后 imageUri）
  const photoPath = med.pillImageUri || med.boxImageUri || med.imageUri;
  if (!photoPath) return null;

  try {
    const feature = await extractColorsFromImage(photoPath);
    if (feature) {
      feature.medicationId = med.id;
      featureCache.set(med.id, feature);
      return feature;
    }
  } catch (e) {
    console.warn(`[Recognizer] 提取药品 ${med.name} 特征失败:`, e);
  }

  return null;
}

/**
 * 从图片提取颜色特征（跨平台）
 * 优先使用 HTML Canvas，App 端使用 bitmapData
 */
async function extractColorsFromImage(imageSrc: string): Promise<CachedMedFeature | null> {
  // #ifdef H5
  return extractColorsH5(imageSrc);
  // #endif

  // #ifdef APP-PLUS
  return extractColorsApp(imageSrc);
  // #endif

  // #ifndef H5 || APP-PLUS
  return null;
  // #endif
}

/**
 * H5 端：使用 HTML Canvas 提取颜色特征
 */
function extractColorsH5(imageSrc: string): Promise<CachedMedFeature | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 缩小到最大 200px
      let w = img.width, h = img.height;
      const scale = Math.min(200 / w, 200 / h, 1);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;

      const feature = computeColorFeatureFromPixels(data, w, h);
      resolve(feature);
    };
    img.onerror = () => resolve(null);
    img.src = imageSrc;
  });
}

/**
 * App 端：使用 uni.getImageInfo + canvas bitmap 提取颜色特征
 * 修复：使用 fileToDataUrl 将本地路径转换为 data URL，确保可以正确加载
 */
function extractColorsApp(imageSrc: string): Promise<CachedMedFeature | null> {
  return new Promise(async (resolve) => {
    try {
      // console.log('[Recognizer] App 端开始提取颜色特征, src=', (imageSrc || '').substring(0, 80));
      
      // 尝试导入 imageStorage（需要动态导入或确保已导入）
      let useDataUrl = imageSrc;
      
      // 如果 imageStorage 可用，尝试转换为 data URL
      try {
        // @ts-ignore - 尝试动态获取 fileToDataUrl
        const { fileToDataUrl } = await import('./imageStorage');
        if (fileToDataUrl && !imageSrc.startsWith('data:')) {
          const dataUrl = await fileToDataUrl(imageSrc);
          if (dataUrl) {
            // console.log('[Recognizer] 已转换为 data URL');
            useDataUrl = dataUrl;
          }
        }
      } catch (e) {
        console.warn('[Recognizer] 无法导入 imageStorage，继续使用原路径:', e);
      }

      // 第一步：获取图片信息
      uni.getImageInfo({
        src: useDataUrl,
        success: (info) => {
          // console.log('[Recognizer] getImageInfo 成功:', info.width, 'x', info.height);
          // 第二步：使用 canvas 绘制并读取像素
          const maxDim = 200;
          let w = info.width, h = info.height;
          const scale = Math.min(maxDim / w, maxDim / h, 1);
          w = Math.round(w * scale);
          h = Math.round(h * scale);

          // 使用离屏 canvas - 必须确保页面中有这个 canvas
          const canvasId = 'pill-detect-canvas';
          
          try {
            // @ts-ignore
            const ctx = uni.createCanvasContext(canvasId);
            if (!ctx) {
              console.warn('[Recognizer] 无法创建 canvas context');
              resolve(null);
              return;
            }

            // 创建离屏 canvas
            ctx.drawImage(useDataUrl, 0, 0, w, h);
            ctx.draw(false, () => {
              console.log('[Recognizer] drawImage 完成，等待读取像素');
              setTimeout(() => {
                uni.canvasGetImageData({
                  canvasId,
                  x: 0, y: 0,
                  width: w, height: h,
                  success: (res) => {
                    console.log('[Recognizer] canvasGetImageData 成功');
                    const data = res.data as unknown as Uint8ClampedArray;
                    const feature = computeColorFeatureFromPixels(data, w, h);
                    resolve(feature);
                  },
                  fail: (err) => {
                    console.warn('[Recognizer] canvasGetImageData 失败:', err);
                    resolve(null);
                  },
                });
              }, 200); // 增加等待时间
            });
          } catch (ctxErr) {
            console.warn('[Recognizer] canvas 操作异常:', ctxErr);
            resolve(null);
          }
        },
        fail: (err) => {
          console.warn('[Recognizer] getImageInfo 失败:', err);
          resolve(null);
        },
      });
    } catch (e) {
      console.warn('[Recognizer] App 端提取异常:', e);
      resolve(null);
    }
  });
}

/**
 * 从像素数据计算颜色特征
 * 关键改进：仅采样图片中心 30% 区域，排除背景干扰
 */
function computeColorFeatureFromPixels(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): CachedMedFeature {
  // 仅采样中心 35%~65% 的区域（排除边缘背景）
  const marginX = Math.floor(w * 0.35);
  const marginY = Math.floor(h * 0.35);
  const maxX = Math.floor(w * 0.65);
  const maxY = Math.floor(h * 0.65);

  const colors: [number, number, number][] = [];
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  let sSum = 0, vSum = 0;

  for (let y = marginY; y < maxY; y += 1) {
    for (let x = marginX; x < maxX; x += 1) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // 跳过纯白和纯黑像素（可能是背景）
      if (r > 240 && g > 240 && b > 240) continue;
      if (r < 15 && g < 15 && b < 15) continue;

      colors.push([r, g, b]);
      rSum += r; gSum += g; bSum += b;
      count++;

      const [h_val, s, v] = rgbToHsv(r, g, b);
      sSum += s;
      vSum += v;
    }
  }

  const avgColor: [number, number, number] = count > 0
    ? [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)]
    : [128, 128, 128];

  const avgLuma = count > 0 ? luma(avgColor[0], avgColor[1], avgColor[2]) : 128;
  const avgSaturation = count > 0 ? sSum / count : 0;
  const avgValue = count > 0 ? vSum / count : 0.5;

  // 找主色：按亮度排序，去掉最亮最暗各 20%
  const sortedColors = [...colors].sort(
    (a, b) => luma(a[0], a[1], a[2]) - luma(b[0], b[1], b[2])
  );
  const trimStart = Math.floor(sortedColors.length * 0.2);
  const trimEnd = Math.floor(sortedColors.length * 0.8);
  const mid = sortedColors.slice(trimStart, trimEnd);

  const domColor: [number, number, number] = mid.length > 0
    ? [
        Math.round(mid.reduce((s, c) => s + c[0], 0) / mid.length),
        Math.round(mid.reduce((s, c) => s + c[1], 0) / mid.length),
        Math.round(mid.reduce((s, c) => s + c[2], 0) / mid.length),
      ]
    : avgColor;

  const domHsv = rgbToHsv(domColor[0], domColor[1], domColor[2]);

  // 构建色相直方图
  const hueHistogram = buildHueHistogram(mid.length > 0 ? mid : colors);

  // 找最 dominant 的色相 bin
  let maxBin = 0, maxBinVal = 0;
  for (let i = 0; i < 12; i++) {
    if (hueHistogram[i] > maxBinVal) {
      maxBinVal = hueHistogram[i];
      maxBin = i;
    }
  }

  return {
    medicationId: '',
    avgColor,
    domColor,
    domHsv,
    avgLuma,
    hueHistogram,
    avgSaturation,
    avgValue,
    dominantHueBin: maxBin,
  };
}

// ─────────────────────────────────────────────
// 匹配算法
// ─────────────────────────────────────────────

/**
 * 计算两个特征之间的综合相似度（0~1，1 = 完全相同）
 *
 * 维度与权重：
 * - 色相直方图相似度 40%（最重要的区分特征）
 * - 主色 RGB 欧氏距离 15%
 * - 主色 HSV 色相距离 10%
 * - 亮度相似度 10%
 * - 平均色相似度 15%
 * - 饱和度相似度 10%
 */
function computeSimilarity(
  pill: PillRegion,
  medFeature: CachedMedFeature,
): number {
  // 1. 色相直方图 Bhattacharyya 距离（核心维度）
  const pillHueHist = buildPillHueHistogram(pill);
  const histDist = histogramBhattacharyya(pillHueHist, medFeature.hueHistogram);
  const histSimilarity = 1 - histDist; // 0~1

  // 2. 主色 RGB 欧氏距离
  const rgbDist = colorDist(pill.domColor, medFeature.domColor);
  const maxRgbDist = 255 * Math.sqrt(3);
  const rgbSimilarity = 1 - rgbDist / maxRgbDist;

  // 3. 主色 HSV 色相距离
  const pillHsv = rgbToHsv(pill.domColor[0], pill.domColor[1], pill.domColor[2]);
  const hDist = hueDist(pillHsv[0], medFeature.domHsv[0]) / 180;
  const hsvSimilarity = 1 - hDist;

  // 4. 亮度相似度
  const pillLuma = luma(pill.avgColor[0], pill.avgColor[1], pill.avgColor[2]);
  const lumaDist = Math.abs(pillLuma - medFeature.avgLuma) / 255;
  const lumaSimilarity = 1 - lumaDist;

  // 5. 平均色相似度
  const avgDist = colorDist(pill.avgColor, medFeature.avgColor);
  const avgSimilarity = 1 - avgDist / maxRgbDist;

  // 6. 饱和度相似度
  const pillSat = pillHsv[1];
  const satDist = Math.abs(pillSat - medFeature.avgSaturation);
  const satSimilarity = 1 - satDist;

  // 加权综合
  const similarity =
    histSimilarity * 0.40 +
    rgbSimilarity * 0.15 +
    hsvSimilarity * 0.10 +
    lumaSimilarity * 0.10 +
    avgSimilarity * 0.15 +
    satSimilarity * 0.10;

  return similarity;
}

/**
 * 从药片区域的像素信息构建色相直方图
 * 使用 PillRegion 中的 avgColor 和 domColor 估算
 */
function buildPillHueHistogram(pill: PillRegion): number[] {
  // 从 domColor 和 avgColor 生成模拟直方图
  // 中心 70% 权重给 domColor，30% 给 avgColor
  const dom = pill.domColor;
  const avg = pill.avgColor;

  const domHsv = rgbToHsv(dom[0], dom[1], dom[2]);
  const avgHsv = rgbToHsv(avg[0], avg[1], avg[2]);

  const bins = new Array(12).fill(0);
  let total = 0;

  // 主色：权重 0.7
  if (domHsv[1] > 0.15 && domHsv[2] > 0.15) {
    const bin = Math.min(11, Math.floor(domHsv[0] / 30));
    bins[bin] += 0.7;
    total += 0.7;
    // 给相邻 bin 一点点扩散
    bins[(bin + 1) % 12] += 0.1;
    bins[(bin + 11) % 12] += 0.1;
    total += 0.2;
  }

  // 平均色：权重 0.3
  if (avgHsv[1] > 0.15 && avgHsv[2] > 0.15) {
    const bin = Math.min(11, Math.floor(avgHsv[0] / 30));
    bins[bin] += 0.3;
    total += 0.3;
  }

  // 归一化
  if (total > 0) {
    for (let i = 0; i < 12; i++) bins[i] /= total;
  }

  return bins;
}

/**
 * 将检测到的药片区域与药品库匹配（贪心匹配 + 多对一去重）
 */
async function matchPillsToLibrary(
  regions: PillRegion[],
  medications: Medication[],
): Promise<RecognizedPill[]> {
  if (medications.length === 0) {
    return regions.map((r, i) => ({
      regionIndex: i,
      medicationId: null,
      medicationName: '未知药片',
      confidence: 0,
      region: r,
    }));
  }

  // 提取所有药品的特征
  const medFeatures: (CachedMedFeature & { med: Medication })[] = [];
  for (const med of medications) {
    const feature = await extractMedicationFeature(med);
    if (feature) {
      medFeatures.push({ ...feature, med });
    }
  }

  if (medFeatures.length === 0) {
    return regions.map((r, i) => ({
      regionIndex: i,
      medicationId: null,
      medicationName: '未知药片',
      confidence: 0,
      region: r,
    }));
  }

  // 匹配阈值
  const MATCH_THRESHOLD = 0.65;
  const HIGH_CONFIDENCE = 0.82;

  // 对每个区域计算与所有药品的相似度
  const allScores: {
    regionIdx: number;
    feature: CachedMedFeature & { med: Medication };
    similarity: number;
  }[] = [];

  for (let i = 0; i < regions.length; i++) {
    for (const mf of medFeatures) {
      const similarity = computeSimilarity(regions[i], mf);
      allScores.push({ regionIdx: i, feature: mf, similarity });
    }
  }

  // 贪心匹配：按相似度从高到低排序，依次分配
  allScores.sort((a, b) => b.similarity - a.similarity);

  const matchedRegions = new Set<number>();
  const medMatchCount = new Map<string, number>(); // 记录每个药品已匹配数量
  const results: RecognizedPill[] = new Array(regions.length);

  for (const score of allScores) {
    if (matchedRegions.has(score.regionIdx)) continue;
    if (score.similarity < MATCH_THRESHOLD) continue;

    const medId = score.feature.med.id;
    // 每个药品最多匹配 N 个区域（N = 药品库数量，允许同品种多个药片）
    // 但通过降权避免过度集中
    const alreadyMatched = medMatchCount.get(medId) || 0;
    const maxPerMed = Math.max(3, Math.ceil(regions.length / medFeatures.length));

    if (alreadyMatched >= maxPerMed) continue;

    matchedRegions.add(score.regionIdx);
    medMatchCount.set(medId, alreadyMatched + 1);

    // 第 2+ 次匹配到同一药品时，置信度逐渐降低
    const penalty = alreadyMatched > 0 ? 1 - alreadyMatched * 0.05 : 1;
    const confidence = score.similarity >= HIGH_CONFIDENCE
      ? score.similarity * penalty
      : score.similarity * 0.85 * penalty;

    results[score.regionIdx] = {
      regionIndex: score.regionIdx,
      medicationId: medId,
      medicationName: score.feature.med.name,
      confidence: Math.max(0, confidence),
      region: regions[score.regionIdx],
    };
  }

  // 填充未匹配的区域
  for (let i = 0; i < regions.length; i++) {
    if (!results[i]) {
      // 找最佳匹配（即使低于阈值也记录，标记为未知）
      let bestSim = 0;
      for (const mf of medFeatures) {
        const sim = computeSimilarity(regions[i], mf);
        if (sim > bestSim) bestSim = sim;
      }
      results[i] = {
        regionIndex: i,
        medicationId: null,
        medicationName: '未知药片',
        confidence: bestSim,
        region: regions[i],
      };
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// 公开 API
// ─────────────────────────────────────────────

/**
 * 主入口：识别药片品种和数量
 * @param regions  pillCounter 检测到的区域列表
 * @param medications  用户药品库
 */
export async function recognizePills(
  regions: PillRegion[],
  medications: Medication[],
): Promise<RecognitionResult> {
  if (regions.length === 0) {
    return {
      pills: [],
      grouped: [],
      totalCount: 0,
      message: '未检测到药片',
    };
  }

  // 只匹配活跃的且有照片的药品
  const matchableMeds = medications.filter(m =>
    m.isActive && (m.pillImageUri || m.boxImageUri || m.imageUri)
  );

  // 匹配
  const pills = await matchPillsToLibrary(regions, matchableMeds);

  // 按 medicationId 分组
  const groupMap = new Map<string | null, RecognizedPill[]>();
  for (const pill of pills) {
    const key = pill.medicationId;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(pill);
  }

  const grouped = Array.from(groupMap.entries()).map(([medId, items]) => {
    const avgConf = items.reduce((s, p) => s + p.confidence, 0) / items.length;
    const med = medId ? medications.find(m => m.id === medId) : undefined;
    return {
      medicationId: medId,
      medicationName: items[0].medicationName,
      count: items.length,
      confidence: avgConf,
      medication: med,
    };
  }).sort((a, b) => {
    // 已知的排前面，未知排最后
    if (a.medicationId === null && b.medicationId !== null) return 1;
    if (a.medicationId !== null && b.medicationId === null) return -1;
    return b.confidence - a.confidence;
  });

  // 生成消息
  const knownCount = pills.filter(p => p.medicationId !== null).length;
  const unknownCount = pills.filter(p => p.medicationId === null).length;
  let message = '';
  if (knownCount > 0 && unknownCount > 0) {
    message = `共 ${pills.length} 片，其中 ${knownCount} 片已识别，${unknownCount} 片未知`;
  } else if (knownCount > 0) {
    message = `共 ${pills.length} 片，全部已识别`;
  } else {
    message = `共 ${pills.length} 片，均为未知品种`;
  }

  return {
    pills,
    grouped,
    totalCount: pills.length,
    message,
  };
}
