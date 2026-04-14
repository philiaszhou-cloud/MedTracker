/**
 * pillCounter.ts
 * 离线药片检测与计数 —— 纯像素分析，不依赖任何网络/AI 服务
 *
 * v8.3 算法（2026-04-05 起步，2026-04-10 三轮审查优化 + 形态学圆形核升级）：
 * 1. 高斯模糊降噪
 * 2. 亮度直方图空隙（gap）分割 —— 替代旧版色差+Otsu 方法
 * 3. 自适应形态学去噪（开+闭+空洞填充，半径按前景占比四档自适应+尺寸下限保护）
 * 4. BFS 连通区域标记
 * 5. 多维度形状过滤（面积/宽高比/圆形度/亮度）
 * 6. 导出每个区域的颜色特征供品种识别
 *
 * 设计原理：
 * - 药片和桌面背景在亮度上有明显差异（药片亮度 > 150，背景 < 130）
 * - 直方图空隙法能自动找到背景和前景之间的最佳分割点
 * - 不依赖色差阈值，对木纹/纹理桌面鲁棒
 */

export interface PillRegion {
  area: number;           // 像素面积
  centroidX: number;      // 质心 X
  centroidY: number;      // 质心 Y
  bboxMinX: number;
  bboxMinY: number;
  bboxMaxX: number;
  bboxMaxY: number;
  width: number;          // 外接矩形宽度
  height: number;         // 外接矩形高度
  circularity: number;    // 圆形度 (0~1)
  aspectRatio: number;    // 宽高比
  compactness: number;    // 紧凑度（v8.3 当前=circularity；保留为独立字段以备将来基于凸包周长扩展，区分"实心度"与"圆形度"）
  avgColor: [number, number, number]; // 区域平均颜色 [R, G, B]
  domColor: [number, number, number]; // 中心区域主色 [R, G, B]
  /** 区域平均亮度（用于过滤判断，v8 补全类型声明） */
  avgLuma?: number;
  /** 轮廓像素坐标（用于绘制），仅在 analyzeWithOverlay 时填充 */
  outlinePixels?: [number, number][];
  /** 区域所有像素坐标（用于填充半透明），仅在 analyzeWithOverlay 时填充 */
  allPixels?: [number, number][];
}

export interface CountResult {
  count: number;
  confidence: number;
  message: string;
  regions: PillRegion[];  // 每个检测到的药片区域详情
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 将像素坐标 (x,y) 映射到 RGBA 数组下标 */
function idx(x: number, y: number, w: number): number {
  return (y * w + x) * 4;
}

/** RGB 转灰度亮度 */
function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 快速选择算法（QuickSelect）—— O(N) 平均时间找到第 k 小的元素
 *
 * v8.1 改进（2026-04-10 审查）：
 * - 迭代版本（非递归），彻底消除栈溢出风险
 * - 原地 partition（O(1) 额外空间，不创建临时数组）
 * - 随机枢轴选择，避免已排序输入的 O(N²) 最坏情况
 */
function quickSelect(arr: number[] | Float64Array, k: number): number {
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    // 随机选枢轴并换到末尾
    const pivotIdx = lo + Math.floor(Math.random() * (hi - lo + 1));
    [arr[pivotIdx], arr[hi]] = [arr[hi], arr[pivotIdx]];

    // 原地 partition：比枢轴小的放左边
    let store = lo;
    for (let i = lo; i < hi; i++) {
      if (arr[i] < arr[hi]) {
        [arr[store], arr[i]] = [arr[i], arr[store]];
        store++;
      }
    }
    // 枢轴归位
    [arr[store], arr[hi]] = [arr[hi], arr[store]];

    // 缩小搜索范围
    if (k === store) return arr[k];
    else if (k < store) hi = store - 1;
    else lo = store + 1;
  }
  return arr[lo];
}

// ─────────────────────────────────────────────
// 第一步：高斯模糊降噪
// ─────────────────────────────────────────────

/**
 * 简化高斯模糊（3×3 卷积核）
 * 用于消除桌面纹理噪声，避免纹理被误检为前景
 */
function gaussianBlur3x3(data: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  // 3x3 高斯核: [1,2,1; 2,4,2; 1,2,1] / 16
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const ksum = 16;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let rSum = 0, gSum = 0, bSum = 0, ki = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ni = idx(x + dx, y + dy, w);
          const k = kernel[ki++];
          rSum += data[ni] * k;
          gSum += data[ni + 1] * k;
          bSum += data[ni + 2] * k;
        }
      }
      const oi = idx(x, y, w);
      out[oi] = Math.round(rSum / ksum);
      out[oi + 1] = Math.round(gSum / ksum);
      out[oi + 2] = Math.round(bSum / ksum);
      out[oi + 3] = data[oi + 3]; // alpha 不变
    }
  }
  // 边缘像素直接复制
  for (let x = 0; x < w; x++) {
    const topI = idx(x, 0, w), botI = idx(x, h - 1, w);
    out[topI] = data[topI]; out[topI+1] = data[topI+1]; out[topI+2] = data[topI+2]; out[topI+3] = data[topI+3];
    out[botI] = data[botI]; out[botI+1] = data[botI+1]; out[botI+2] = data[botI+2]; out[botI+3] = data[botI+3];
  }
  for (let y = 0; y < h; y++) {
    const leftI = idx(0, y, w), rightI = idx(w - 1, y, w);
    out[leftI] = data[leftI]; out[leftI+1] = data[leftI+1]; out[leftI+2] = data[leftI+2]; out[leftI+3] = data[leftI+3];
    out[rightI] = data[rightI]; out[rightI+1] = data[rightI+1]; out[rightI+2] = data[rightI+2]; out[rightI+3] = data[rightI+3];
  }
  return out;
}

// ─────────────────────────────────────────────
// 第二步：亮度直方图空隙分割
// ─────────────────────────────────────────────

/**
 * 在亮度直方图中找到背景和前景之间的空隙
 *
 * 原理：药片（前景）和桌面（背景）的亮度分布通常不连续，
 * 中间存在一个直方图值接近零的"空隙"。找到这个空隙的中点作为分割阈值。
 *
 * @param lumas 亮度数组（已模糊后的像素）
 * @param total 总像素数
 * @returns 分割阈值
 */
function findHistogramGap(
  lumas: Float64Array,
  total: number,
  searchLo = 70,
  searchHi = 200,
): number {
  // 构建亮度直方图
  const hist = new Array(256).fill(0);
  for (let i = 0; i < total; i++) {
    hist[Math.min(255, Math.max(0, Math.round(lumas[i])))]++;
  }

  // 5 次平滑（消除噪声导致的锯齿）
  // 选值理由：3 次不足以抹平木纹等高频纹理的直方图毛刺，
  //           7 次会过度模糊导致窄空隙（药片与背景间距小时）消失
  // 注意：此常量声明在函数内部（局部作用域），如需对外暴露为可调参数需提升到模块顶层
  const SMOOTH_ITERATIONS = 5;
  const smooth = hist.slice();
  for (let iter = 0; iter < SMOOTH_ITERATIONS; iter++) {
    const temp = smooth.slice();
    for (let i = 1; i < 255; i++) {
      temp[i] = (smooth[i - 1] + smooth[i] * 2 + smooth[i + 1]) / 4;
    }
    for (let i = 0; i < 256; i++) smooth[i] = temp[i];
  }

  // 在 searchLo ~ searchHi 之间找最宽的"低谷"
  // 低谷 = 连续 N 个 bin 的直方图值都低于阈值
  const gapThreshold = total * 0.002; // 每个 bin < 总像素的 0.2%

  let bestStart = searchLo;
  let bestEnd = searchLo;
  let bestLength = 0;

  let currentStart: number | null = null;

  for (let t = searchLo; t <= searchHi; t++) {
    if (smooth[t] < gapThreshold) {
      if (currentStart === null) currentStart = t;
    } else {
      if (currentStart !== null) {
        const length = t - currentStart;
        if (length > bestLength) {
          bestLength = length;
          bestStart = currentStart;
          bestEnd = t - 1;
        }
        currentStart = null;
      }
    }
  }

  // 处理末尾连续低谷
  if (currentStart !== null) {
    const length = searchHi - currentStart + 1;
    if (length > bestLength) {
      bestLength = length;
      bestStart = currentStart;
      bestEnd = searchHi;
    }
  }

  if (bestLength > 0) {
    return (bestStart + bestEnd) / 2;
  }

  // 回退：用 QuickSelect 找 P90（O(N)，比全排序快 10~50x）
  // v8.2+ 优化：直接传 Float64Array 副本给 quickSelect，
  // quickSelect 仅用 < 比较和解构交换，完全兼容 TypedArray，无需 Array.from() 转换
  const p90Idx = Math.floor(total * 0.9);
  return quickSelect(lumas.slice(0), p90Idx);
}

// ─────────────────────────────────────────────
// 第三步：形态学运算
// ─────────────────────────────────────────────

/**
 * 形态学核形状说明（v8.3 已切换为圆形核）：
 *
 * v8.2 及以前使用方形（Manhattan）邻域核：(2r+1) × (2r+1)
 *   问题：角落像素距离中心 √2·r 却被同等对待，导致：
 *     - 腐蚀时圆角药片的四个角被过度削掉
 *     - 膨胀时水平/垂直方向比对角方向扩展更多
 *
 * v8.3 切换为圆形（欧氏距离）核：仅保留 dx² + dy² ≤ r² 的像素
 *   - 实现方式：内层循环预计算 rSq = radius*radius，跳过超出欧氏半径的点
 *   - 效果：各方向等价膨胀/腐蚀，更符合真实药片形状假设
 *   - 注意：切换后形态学参数（开运算半径、过滤阈值）需重新验证训练集
 */

/** 腐蚀（圆形核：仅欧氏距离 ≤ radius 的邻域像素参与判断） */
function erode(bin: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const rSq = radius * radius;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let keep = true;
      outer: for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > rSq) continue; // 圆形核：跳过超出欧氏半径的角
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || bin[ny * w + nx] === 0) {
            keep = false;
            break outer;
          }
        }
      }
      out[y * w + x] = keep ? 1 : 0;
    }
  }
  return out;
}

/** 膨胀（圆形核：仅欧氏距离 ≤ radius 的邻域像素被填充） */
function dilate(bin: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const rSq = radius * radius;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bin[y * w + x] === 1) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > rSq) continue; // 圆形核：跳过超出欧氏半径的角
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              out[ny * w + nx] = 1;
            }
          }
        }
      }
    }
  }
  return out;
}

/** 开运算（先腐蚀后膨胀）去噪 */
function morphOpen(bin: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const eroded = erode(bin, w, h, radius);
  return dilate(eroded, w, h, radius);
}

/** 闭运算（先膨胀后腐蚀）填补空洞 */
function morphClose(bin: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const dilated = dilate(bin, w, h, radius);
  return erode(dilated, w, h, radius);
}

/**
 * 洪水填充算法 —— 从外向内填充背景，然后反转得到没有空洞的前景
 */
function fillHoles(bin: Uint8Array, w: number, h: number): Uint8Array {
  const visited = new Uint8Array(w * h);
  const queue: [number, number][] = [];

  // 从四条边开始 BFS，标记所有背景连通区域
  for (let x = 0; x < w; x++) {
    if (bin[x] === 0 && !visited[x]) {
      queue.push([x, 0]);
      visited[x] = 1;
    }
    const bottom = (h - 1) * w + x;
    if (bin[bottom] === 0 && !visited[bottom]) {
      queue.push([x, h - 1]);
      visited[bottom] = 1;
    }
  }
  for (let y = 0; y < h; y++) {
    const left = y * w;
    if (bin[left] === 0 && !visited[left]) {
      queue.push([0, y]);
      visited[left] = 1;
    }
    const right = y * w + w - 1;
    if (bin[right] === 0 && !visited[right]) {
      queue.push([w - 1, y]);
      visited[right] = 1;
    }
  }

  // BFS 扩展
  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const ni = ny * w + nx;
          if (!visited[ni] && bin[ni] === 0) {
            visited[ni] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  // 未被访问到的背景像素 = 被前景包围的空洞 → 填充为前景
  const filled = new Uint8Array(bin);
  for (let i = 0; i < w * h; i++) {
    if (bin[i] === 0 && !visited[i]) {
      filled[i] = 1;
    }
  }

  return filled;
}

// ─────────────────────────────────────────────
// 第四步：连通区域标记 + 特征提取
// ─────────────────────────────────────────────

interface RawRegion {
  pixels: [number, number][]; // 所有像素坐标
  area: number;
}

function labelConnectedComponents(bin: Uint8Array, w: number, h: number): RawRegion[] {
  const visited = new Uint8Array(w * h);
  const regions: RawRegion[] = [];

  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const si = sy * w + sx;
      if (bin[si] === 1 && !visited[si]) {
        const queue: [number, number][] = [[sx, sy]];
        visited[si] = 1;
        const pixels: [number, number][] = [];

        let head = 0;
        while (head < queue.length) {
          const [cx, cy] = queue[head++];
          pixels.push([cx, cy]);

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx, ny = cy + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                const ni = ny * w + nx;
                if (bin[ni] === 1 && !visited[ni]) {
                  visited[ni] = 1;
                  queue.push([nx, ny]);
                }
              }
            }
          }
        }

        regions.push({ pixels, area: pixels.length });
      }
    }
  }

  return regions;
}

/**
 * 从原始像素区域提取 PillRegion 特征
 * @param includePixels 是否保留像素数据（用于轮廓绘制）
 */
function extractRegionFeatures(
  region: RawRegion,
  data: Uint8ClampedArray,
  w: number,
  includePixels = false,
): PillRegion | null {
  const { pixels, area } = region;

  // 边界框
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let sumX = 0, sumY = 0;
  let rSum = 0, gSum = 0, bSum = 0;
  let lumaSum = 0;

  for (const [px, py] of pixels) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
    sumX += px;
    sumY += py;

    const i = idx(px, py, w);
    const r = data[i], g = data[i + 1], b = data[i + 2];
    rSum += r; gSum += g; bSum += b;
    lumaSum += luma(r, g, b);
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;

  // 边界框太窄或太宽 → 噪声/粘连 → 跳过（v8 放宽到 6）
  if (bw < 6 || bh < 6) return null;

  const avgColor: [number, number, number] = [
    Math.round(rSum / area),
    Math.round(gSum / area),
    Math.round(bSum / area),
  ];

  const avgLuma = lumaSum / area;

  // 中心区域主色（取边界框中心 40% 区域的平均色）
  const cxMin = Math.round(minX + bw * 0.3);
  const cxMax = Math.round(minX + bw * 0.7);
  const cyMin = Math.round(minY + bh * 0.3);
  const cyMax = Math.round(minY + bh * 0.7);
  let cR = 0, cG = 0, cB = 0, cCount = 0;

  for (const [px, py] of pixels) {
    if (px >= cxMin && px <= cxMax && py >= cyMin && py <= cyMax) {
      const i = idx(px, py, w);
      cR += data[i]; cG += data[i + 1]; cB += data[i + 2];
      cCount++;
    }
  }

  const domColor: [number, number, number] = cCount > 0
    ? [Math.round(cR / cCount), Math.round(cG / cCount), Math.round(cB / cCount)]
    : avgColor;

  // 精确周长计算
  // 使用位运算编码坐标：(py << 16) | px，支持最大 65536×65536 无碰撞
  const pixelSet = new Set<number>();
  for (const [px, py] of pixels) {
    pixelSet.add((py << 16) | px);
  }
  let perimeter = 0;
  for (const [px, py] of pixels) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (!pixelSet.has(((py + dy) << 16) | (px + dx))) {
          perimeter++;
        }
      }
    }
  }

  const circularity = perimeter > 0
    ? Math.min(1, (4 * Math.PI * area) / (perimeter * perimeter))
    : 0;

  const aspectRatio = Math.max(bw, bh) / Math.min(bw, bh);
  // 紧凑度：v8.3 当前与 circularity 公式相同（4πA/P²）
  // 冗余保留原因（不删除此字段）：
  //   ① pillRecognizer 品种识别模块已依赖 compactness 作为特征向量分量
  //   ② 将来可改为基于凸包周长计算（convexPerimeter²），以区分"实心度"与"圆形度"
  //   ③ 删除字段需联动修改类型定义 + 赋值 + 消费端，改动面大但收益为零
  const compactness = circularity;

  // 计算轮廓像素（当需要绘制时）
  let outlinePixels: [number, number][] | undefined;
  let allPixels: [number, number][] | undefined;

  if (includePixels) {
    allPixels = pixels;
    outlinePixels = [];
    for (const [px, py] of pixels) {
      let isOutline = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (!pixelSet.has(((py + dy) << 16) | (px + dx))) {
            isOutline = true;
            break;
          }
        }
        if (isOutline) break;
      }
      if (isOutline) outlinePixels.push([px, py]);
    }
  }

  return {
    area,
    centroidX: Math.round(sumX / area),
    centroidY: Math.round(sumY / area),
    bboxMinX: minX,
    bboxMinY: minY,
    bboxMaxX: maxX,
    bboxMaxY: maxY,
    width: bw,
    height: bh,
    circularity,
    aspectRatio,
    compactness,
    avgColor,
    domColor,
    avgLuma,
    outlinePixels,
    allPixels,
  };
}

// ─────────────────────────────────────────────
// 第五步：过滤
// ─────────────────────────────────────────────

/**
 * 过滤和合并区域
 * v8 过滤条件（基于形状+亮度，2026-04-10 优化）：
 * - 面积：0.02% ~ 20%（放宽，适应单片照片中的小药片）
 * - 宽高比：≤ 4.5（放宽，适应椭圆形药片如厄贝沙坦）
 * - 圆形度：≥ 0.03（略微降低，椭圆形药片圆形度偏低）
 * - 区域平均亮度：> 阈值（去掉双重限制，仅保留相对阈值判断）
 */
function filterRegions(
  regions: PillRegion[],
  totalPixels: number,
  threshold: number,
): PillRegion[] {
  return regions.filter(r => {
    const pct = r.area / totalPixels * 100;
    // 面积过滤（v8 放宽范围）
    if (pct < 0.02 || pct > 20.0) return false;
    // 宽高比（v8 适配椭圆药片）
    if (r.aspectRatio > 4.5) return false;
    // 圆形度（v8 略微降低阈值）
    if (r.circularity < 0.03) return false;
    // 亮度：必须明显高于分割阈值
    if (r.avgLuma !== undefined && r.avgLuma <= threshold) return false;
    // 最小尺寸
    if (r.width < 6 || r.height < 6) return false;
    return true;
  });
}

// ─────────────────────────────────────────────
// 置信度计算
// ─────────────────────────────────────────────

function calculateConfidence(regions: PillRegion[]): number {
  if (regions.length === 0) return 0;

  if (regions.length === 1) {
    const r = regions[0];
    if (r.compactness > 0.6 && r.aspectRatio < 1.8) return 0.85;
    if (r.compactness > 0.4) return 0.7;
    return 0.5;
  }

  // 多个区域：看大小均匀度和形状一致性
  const areas = regions.map(r => r.area);
  const mean = areas.reduce((s, a) => s + a, 0) / areas.length;
  const variance = areas.reduce((s, a) => s + (a - mean) ** 2, 0) / areas.length;
  const cv = Math.sqrt(variance) / mean;

  const circularities = regions.map(r => r.circularity);
  const meanCirc = circularities.reduce((s, v) => s + v, 0) / circularities.length;
  const meanCompact = regions.reduce((s, r) => s + r.compactness, 0) / regions.length;

  let score = 0;
  score += Math.max(0, 1 - cv) * 0.5;
  score += meanCirc * 0.3;
  score += Math.min(1, meanCompact * 1.5) * 0.2;

  return Math.max(0.3, Math.min(0.95, score));
}

// ─────────────────────────────────────────────
// 绘制相关
// ─────────────────────────────────────────────

/**
 * H5 版本：检测药片并在 Canvas 上绘制轮廓和颜色标注
 * v7 修复（2026-04-10）：
 *   - 消除 Promise 构造器反模式，改用 async/await
 *   - 叠加层绘制增加超时保护，防止 Image 加载本地路径时卡死
 *   - 无论叠加层是否成功，都返回分析结果
 */
export async function countPillsH5WithOverlay(
  imageSrc: string,
  canvasId: string,
  options: {
    maxSize?: number;
    outlineColor?: string;
    outlineWidth?: number;
    fillOpacity?: number;
    showLabel?: boolean;
    labelColor?: string;
    labelBgColor?: string;
  } = {},
): Promise<CountResult> {
  const {
    maxSize = 640,
    outlineColor = '#00E676',
    outlineWidth = 2,
    fillOpacity = 0.25,
    showLabel = true,
    labelColor = '#FFF',
    labelBgColor = 'rgba(0,150,136,0.85)',
  } = options;

  // 用统一的 Web API 完成像素分析
  const result = await countPillsViaWebAPI(imageSrc, maxSize);

  // 尝试在页面 Canvas 上绘制叠加层（失败不影响结果返回）
  try {
    const targetCanvas = document.getElementById(canvasId) as HTMLCanvasElement | null;

    if (targetCanvas && result.regions.length > 0) {
      const ctx = targetCanvas.getContext('2d');
      if (ctx) {
        // 叠加层绘制带超时保护，避免 Image 加载本地路径时静默卡死
        await new Promise<void>((drawResolve) => {
          const img = new Image();
          // 不设置 crossOrigin：叠加层只需绘制（不读像素），
          // 避免本地 file:// / blob URL 路径导致 Canvas 被 taint

          const drawTimer = setTimeout(() => {
            console.warn('[countPillsH5] 叠加层图片加载超时(5s)，跳过绘制');
            drawResolve();
          }, 5000);

          img.onload = () => {
            clearTimeout(drawTimer);
            try {
              let w = img.width, h = img.height;
              if (w > maxSize || h > maxSize) {
                const scale = maxSize / Math.max(w, h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
              }
              targetCanvas.width = w;
              targetCanvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);
              drawOverlay(ctx, result.regions, w, h, {
                outlineColor, outlineWidth, fillOpacity, showLabel, labelColor, labelBgColor,
              });
            } catch (e) {
              console.warn('[countPillsH5] 叠加层绘制失败:', e);
            }
            drawResolve();
          };

          img.onerror = () => {
            clearTimeout(drawTimer);
            console.warn('[countPillsH5] 叠加层图片加载失败，跳过绘制');
            drawResolve();
          };

          img.src = imageSrc;
        });
      }
    }
  } catch (e) {
    console.warn('[countPillsH5] 叠加层流程异常（不影响结果）:', e);
  }

  return result;
}

/**
 * 在 Canvas 上绘制药片轮廓和标注
 * v8.1 优化（2026-04-10 审查修正）：
 * - 轮廓改用 Path2D + stroke() 批量描边，避免逐像素 fillRect 的 O(N) API 调用
 * - 填充使用标准 Canvas globalAlpha 混合（而非 ImageData putImageData），确保真正的半透明叠加
 * - 先画半透明填充（保留原图可见性），再画彩色轮廓线，最后叠标签
 */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  regions: PillRegion[],
  canvasW: number,
  canvasH: number,
  opts: {
    outlineColor: string;
    outlineWidth: number;
    fillOpacity: number;
    showLabel: boolean;
    labelColor: string;
    labelBgColor: string;
  },
) {
  // 保存绘图状态（globalAlpha / fillStyle 等后续会修改）
  ctx.save();

  // ── 半透明填充：使用 Canvas 标准 alpha 混合，不会覆盖底层原图 ──
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = opts.fillOpacity;

  // 性能保护阈值：Path2D 对超多顶点的路径填充需要三角剖分/扫描线光栅化，
  // 大区域（>5000px）反而比 ImageData 直接操作更慢。
  // 实测大多数药片在 1000~4000px 之间走 Path2D 更快（API 调用次数少）。
  const PATH2D_FILL_THRESHOLD = 5000;

  for (const region of regions) {
    if (!region.allPixels || region.allPixels.length === 0) continue;
    const [r, g, b] = region.domColor;
    ctx.fillStyle = `rgb(${r},${g},${b})`;

    if (region.allPixels.length <= PATH2D_FILL_THRESHOLD) {
      // 小/中区域：Path2D 路径填充（API 调用少，路径引擎高效）
      const path = new Path2D();
      let started = false;
      for (const [px, py] of region.allPixels) {
        if (!started) { path.moveTo(px, py); started = true; }
        else path.lineTo(px, py);
      }
      path.closePath();
      ctx.fill(path);
    } else {
      // 大区域（>5000px）：回退 ImageData 直接操作避免路径引擎瓶颈
      const overlayData = ctx.createImageData(canvasW, canvasH);
      const fillAlpha = Math.round(opts.fillOpacity * 255);
      for (const [px, py] of region.allPixels) {
        const i = (py * canvasW + px) * 4;
        overlayData.data[i] = r;
        overlayData.data[i + 1] = g;
        overlayData.data[i + 2] = b;
        overlayData.data[i + 3] = fillAlpha;
      }
      // 用临时 canvas 做 alpha 混合（putImageData 不走 compositing）
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasW;
      tempCanvas.height = canvasH;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(overlayData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }

  // 恢复 alpha 为不透明（后续轮廓线和文字需要完全不透明）
  ctx.globalAlpha = prevAlpha ?? 1;

  // ── 彩色轮廓线：Path2D + stroke() 批量描边 ──
  ctx.strokeStyle = opts.outlineColor;
  ctx.lineWidth = opts.outlineWidth;

  for (const region of regions) {
    if (!region.outlinePixels || region.outlinePixels.length === 0) continue;

    const path = new Path2D();
    let started = false;
    for (const [px, py] of region.outlinePixels) {
      if (!started) { path.moveTo(px, py); started = true; }
      else path.lineTo(px, py);
    }
    path.closePath();
    ctx.stroke(path);
  }

  // ── 编号标签：Canvas 文字 API ──
  if (opts.showLabel) {
    for (let idx = 0; idx < regions.length; idx++) {
      const region = regions[idx];
      const cx = region.centroidX;
      const cy = region.centroidY;
      const label = String(idx + 1);
      const fontSize = Math.max(12, Math.min(20, region.width * 0.25));

      ctx.font = `bold ${fontSize}px sans-serif`;
      const metrics = ctx.measureText(label);
      const tw = metrics.width + 8;
      const th = fontSize + 4;

      ctx.fillStyle = opts.labelBgColor;
      const rx = cx - tw / 2;
      const ry = cy - th / 2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(rx, ry, tw, th, 4);
      } else {
        ctx.rect(rx, ry, tw, th);
      }
      ctx.fill();

      ctx.fillStyle = opts.labelColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy);
    }
  }

  // 恢复绘图状态
  ctx.restore();
}

// ─────────────────────────────────────────────
// 主入口
// ─────────────────────────────────────────────

/**
 * H5 版本（简化入口）—— 委托给 countPillsH5WithOverlay，使用默认样式
 *
 * v8.2 重构（2026-04-10 三轮审查）：
 *   消除与 countPillsH5WithOverlay 的代码重复（DRY），
 *   改为一行委托调用。所有绘制逻辑统一维护在 WithOverlay 中。
 */
export function countPillsH5(
  imageSrc: string,
  canvasId: string,
  maxSize = 640,
): Promise<CountResult> {
  return countPillsH5WithOverlay(imageSrc, canvasId, { maxSize });
}

/**
 * App-Plus / H5 统一入口
 *
 * 版本演进（v9 重构）：
 * - v4-v8：均依赖 Web DOM API（document/Image/canvas），在部分 App 端环境不可用
 * - v9（当前）：
 *   - 有 Web DOM API → countPillsViaWebAPI（H5 / 部分 App 环境）
 *   - 无 Web DOM API → countPillsViaUniCanvas（App 端原生 canvas 方案）
 */
export function countPillsApp(
  imageSrc: string,
  maxSize = 640,
): Promise<CountResult> {
  // ★ 修复：App端始终优先使用 uni canvas 方案
  // 原因：App端 WebView 中 new Image().src 加载本地文件路径可能静默失败
  //   （onload/onerror 都不触发），导致 countPillsViaWebAPI 卡死8秒才进入L2 fallback
  // 只有当 imageSrc 是 data URL 或 blob URL 时，Web API 才可靠
  const isWebSafeSrc = imageSrc.startsWith('data:') || imageSrc.startsWith('blob:') || imageSrc.startsWith('http');
  
  if (isWebSafeSrc) {
    const hasWebAPIs = typeof document !== 'undefined' && typeof Image !== 'undefined';
    if (hasWebAPIs) {
      return countPillsViaWebAPI(imageSrc, maxSize);
    }
  }

  // App 端本地文件路径 → 使用 uni-app 原生 canvas API 读取像素
  console.log('[countPillsApp] 使用 uni canvas 方案, src=', (imageSrc || '').substring(0, 80));
  return countPillsViaUniCanvas(imageSrc, maxSize);
}

/**
 * App 端原生 Canvas 方案（不依赖 Web DOM API）
 *
 * v9 新增：解决部分 App 端环境 document/Image 不可用的问题
 *
 * 实现原理：
 *   1. 使用页面中已有的 <canvas canvas-id="pill-canvas"> 组件
 *   2. uni.createCanvasContext + drawImage 将图片绘制到 canvas
 *   3. 等待绘制完成（setTimeout 轮询或 callback）
 *   4. uni.canvasGetImageData 读取全部像素
 *   5. 将像素数据传给 analyzePixels() 进行药片检测算法
 *
 * 注意：
 *   - 需要 add.vue 页面中有 <canvas canvas-id="detect-canvas">（离屏检测用）
 *   - 如果没有可用 canvas，返回错误信息
 */
function countPillsViaUniCanvas(
  imageSrc: string,
  maxSize = 640,
): Promise<CountResult> {
  return new Promise((resolve) => {
    console.log('[countPillsViaUniCanvas] 开始, src=', (imageSrc || '').substring(0, 80));

    // 安全检查：uni API 是否可用
    if (typeof uni === 'undefined') {
      resolve({ count: 0, confidence: 0, message: 'uni API 不可用(App)', regions: [] });
      return;
    }

    // 防止重复 resolve 的安全包装器
    let resolved = false;
    // ★ 修复 BUG-01：提前声明 globalTimer，避免 TDZ（Temporal Dead Zone）访问
    let globalTimer: ReturnType<typeof setTimeout>;
    const safeResolve = (result: CountResult) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(globalTimer);
        resolve(result);
      }
    };

    // 检查是否是 data URL
    const isDataUrl = imageSrc.startsWith('data:image');

    // ════════════════════════════════════════
    // ★ 公共函数：canvas 绘图 → 像素读取 → 分析
    // 提取自 v13 重构（原 data URL / 非 data URL 两段 ~170 行重复代码合并）
    // ════════════════════════════════════════
    function drawAndAnalyze(src: string, tw: number, th: number): void {
      const CANVAS_ID = 'pill-detect-canvas';
      try {
        // @ts-ignore - uni.createCanvasContext 在 App 端可用
        const ctx = uni.createCanvasContext(CANVAS_ID);
        ctx.clearRect(0, 0, tw, th);
        ctx.drawImage(src, 0, 0, tw, th);
        ctx.draw(false, () => {
          console.log(`[countPillsViaUniCanvas] drawImage 完成, 读取像素 ${tw}x${th}`);
          setTimeout(() => {
            try {
              // @ts-ignore - uni.canvasGetImageData 在 App 端可用
              uni.canvasGetImageData({
                canvasId: CANVAS_ID,
                x: 0, y: 0, width: tw, height: th,
                success: (pixelData: any) => {
                  console.log(`[countPillsViaUniCanvas] canvasGetImageData 成功: ${pixelData.width}x${pixelData.height}`);
                  try {
                    safeResolve(analyzePixels(pixelData.data as Uint8ClampedArray, pixelData.width, pixelData.height));
                  } catch (analyzeErr) {
                    console.error('[countPillsViaUniCanvas] analyzePixels 异常:', analyzeErr);
                    safeResolve({ count: 0, confidence: 0, message: '分析异常:' + String(analyzeErr), regions: [] });
                  }
                },
                fail: (err: any) => {
                  console.error('[countPillsViaUniCanvas] canvasGetImageData 失败:', err);
                  safeResolve({ count: 0, confidence: 0, message: '无法读取像素数据:' + String((err && err.errMsg) || err), regions: [] });
                },
              });
            } catch (e) {
              console.error('[countPillsViaUniCanvas] 读取像素异常:', e);
              safeResolve({ count: 0, confidence: 0, message: '读取像素异常:' + String(e), regions: [] });
            }
          }, 100); // 等待 100ms 确保 draw 完成
        });
      } catch (ctxErr) {
        console.error('[countPillsViaUniCanvas] createCanvasContext 异常:', ctxErr);
        safeResolve({ count: 0, confidence: 0, message: '创建Canvas上下文失败:' + String(ctxErr), regions: [] });
      }
    }

    /**
     * 缩放尺寸到 maxSize 以内（保持比例）
     */
    function scaleToLimit(ow: number, oh: number): [number, number] {
      if (ow <= 0 || oh <= 0) return [0, 0];
      if (ow > maxSize || oh > maxSize) {
        const s = maxSize / Math.max(ow, oh);
        return [Math.round(ow * s), Math.round(oh * s)];
      }
      return [ow, oh];
    }

    // ── 路径 A：data URL（通过 Image 对象获取尺寸）──
    if (isDataUrl) {
      console.log('[countPillsViaUniCanvas] 处理 data URL');
      const img = new Image();
      img.onload = () => {
        const [tw, th] = scaleToLimit(img.width, img.height);
        console.log(`[countPillsViaUniCanvas] data URL 图片尺寸: ${img.width}x${img.height} → ${tw}x${th}`);
        if (tw === 0) {
          safeResolve({ count: 0, confidence: 0, message: '图片尺寸无效', regions: [] });
          return;
        }
        drawAndAnalyze(imageSrc, tw, th);
      };
      img.onerror = () => {
        console.error('[countPillsViaUniCanvas] data URL 加载失败');
        safeResolve({ count: 0, confidence: 0, message: '无法加载图片', regions: [] });
      };
      img.src = imageSrc;
      return;
    }

    // ── 路径 B：非 data URL（通过 getImageInfo 获取尺寸）──
    uni.getImageInfo({
      src: imageSrc,
      success: (imgInfo) => {
        const [tw, th] = scaleToLimit(imgInfo.width, imgInfo.height);
        console.log(`[countPillsViaUniCanvas] getImageInfo OK: ${imgInfo.width}x${imgInfo.height} → ${tw}x${th}`);
        if (tw === 0) {
          safeResolve({ count: 0, confidence: 0, message: '图片尺寸无效', regions: [] });
          return;
        }
        drawAndAnalyze(imageSrc, tw, th);
      },
      fail: (err: any) => {
        console.error('[countPillsViaUniCanvas] getImageInfo 失败:', err);
        safeResolve({ count: 0, confidence: 0, message: '无法读取图片:' + String((err && err.errMsg) || err), regions: [] });
      },
    });

    // 外层超时保护（20 秒）
    globalTimer = setTimeout(() => {
      safeResolve({ count: 0, confidence: 0, message: 'App端识别超时(canvas方案)', regions: [] });
    }, 20000);
  });
}

// ────────────────────────────────────────────────────────
// Web DOM API 方案（H5 / 有 WebView DOM 的环境）
// ────────────────────────────────────────────────────────

/**
 * 核心图片加载 + 像素分析引擎（Web DOM API 版）
 *
 * v7 重构（2026-04-10 晚）：
 *   核心问题：App 端 savedFiles 路径（如 /storage/emulated/0/Android/data/.../savedFiles/xxx.jpg）
 *   直接赋给 new Image().src 后，WebView 中的 Image 对象可能无法加载本地 file:// 路径，
 *   导致 onload 和 onerror 都不触发 → Promise 永远不 resolve → UI 永久卡死
 *
 *   防御策略（三级 fallback）：
 *   Level 1: new Image() 直接加载路径（H5 可用；App 端可能静默失败）
 *   Level 2: 超时后走 uni.getImageInfo → fetch 转 blob URL → 再用 Image 加载
 *   Level 3: 所有方案均失败时返回明确错误信息
 */
function countPillsViaWebAPI(
  imageSrc: string,
  maxSize = 640,
): Promise<CountResult> {
  return new Promise((resolve) => {
    try {
      // 安全检查：确认我们在有 DOM API 的环境中
      // ★ v9 诊断：记录每个条件的实际值，帮助排查 App 端环境
      const hasDoc = typeof document !== 'undefined';
      const hasImg = typeof Image !== 'undefined';
      const hasCanvas = typeof CanvasRenderingContext2D !== 'undefined';
      const hasWin = typeof window !== 'undefined';
      console.warn(`[countPillsViaWebAPI] 环境诊断: document=${hasDoc}, Image=${hasImg}, CanvasRenderingContext2D=${hasCanvas}, window=${hasWin}`);
      console.warn(`[countPillsViaWebAPI] imageSrc 预览: ${(imageSrc || '').substring(0, 80)}`);
      if (!hasDoc || !hasImg) {
        resolve({ count: 0, confidence: 0, message: '环境不支持', regions: [] });
        return;
      }

      // ★ 防止重复 resolve 的安全包装器
      let settled = false;
      const safeResolve = (result: CountResult) => {
        if (!settled) { settled = true; resolve(result); }
      };

      // ── Level 1: 尝试直接用 Image 加载（最简单、最快的路径）──
      const LEVEL1_TIMEOUT_MS = 8000;
      const level1Timer = setTimeout(() => {
        if (settled) return;
        console.warn('[countPillsViaWebAPI] L1 Image 加载超时(8s)，进入 L2 fallback');
        enterLevel2Fallback(imageSrc, maxSize, safeResolve);
      }, LEVEL1_TIMEOUT_MS);

      const img = new Image();
      // 不设置 crossOrigin：L1 后续需 getImageData() 读取像素，
      // 若加载本地 file:// 路径时设置 crossOrigin 会导致 Canvas 被 taint → SecurityError

      img.onload = () => {
        clearTimeout(level1Timer);
        if (settled) return;
        try {
          let w = img.width, h = img.height;
          if (w <= 0 || h <= 0) {
            console.warn('[countPillsViaWebAPI] 图片尺寸无效，进入 L2 fallback');
            enterLevel2Fallback(imageSrc, maxSize, safeResolve);
            return;
          }
          if (w > maxSize || h > maxSize) {
            const s = maxSize / Math.max(w, h);
            w = Math.round(w * s); h = Math.round(h * s);
          }

          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { safeResolve({ count: 0, confidence: 0, message: '无法创建 Canvas 上下文', regions: [] }); return; }

          ctx.drawImage(img, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);

          console.log(`[countPillsViaWebAPI] L1 分析完成: ${w}x${h}`);
          safeResolve(analyzePixels(imageData.data as Uint8ClampedArray, w, h));
        } catch (e) {
          console.error('[countPillsViaWebAPI] L1 处理异常:', e);
          safeResolve({ count: 0, confidence: 0, message: '图片处理异常: ' + String(e), regions: [] });
        }
      };

      img.onerror = () => {
        clearTimeout(level1Timer);
        if (settled) return;
        console.warn('[countPillsViaWebAPI] L1 Image 加载错误，进入 L2 fallback:', imageSrc);
        enterLevel2Fallback(imageSrc, maxSize, safeResolve);
      };

      img.src = imageSrc;

    } catch (e) {
      console.error('[countPillsViaWebAPI] 异常:', e);
      resolve({ count: 0, confidence: 0, message: '检测异常: ' + String(e), regions: [] });
    }
  });
}

/**
 * Level 2 Fallback：通过 uni.getImageInfo + 多种方式加载图片
 *
 * 加载策略（按优先级尝试）：
 * L2-a: fetch(uni返回的path) → blob URL → Image（H5 可用）
 * L2-b: uni.getFileSystemManager().readFile → base64 data URL → Image（App/小程序可用）
 *       这是 App 端最可靠的路径：原生 API 直接读取文件，不经过 WebView 安全限制
 * L2-c: 所有方案均失败时返回明确错误信息
 */
function enterLevel2Fallback(
  originalSrc: string,
  maxSize: number,
  safeResolve: (r: CountResult) => void,
): void {
  // 检查 uni API 是否可用
  if (typeof uni === 'undefined' || !uni.getImageInfo) {
    console.warn('[L2 fallback] uni API 不可用');
    safeResolve({ count: 0, confidence: 0, message: '图片加载失败(API不可用)', regions: [] });
    return;
  }

  uni.getImageInfo({
    src: originalSrc,
    success: async (res) => {
      const imgPath = (res.path || originalSrc);
      console.log(`[L2 fallback] getImageInfo OK: ${res.width}x${res.height}, path=${imgPath}`);

      // ── L2-a: fetch + blob URL（H5 端首选）──
      try {
        const resp = await fetch(imgPath);
        if (resp.ok) {
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const loadResult = await loadImageFromBlobUrl(blobUrl, maxSize, safeResolve);
          if (loadResult) return; // 成功或已 resolve
          // blob URL 方式失败，继续尝试 L2-b
        } else {
          console.warn(`[L2-a] fetch 返回非成功状态(${resp.status})，跳到 L2-b`);
        }
      } catch (fetchErr) {
        console.warn('[L2-a] fetch 失败，尝试 L2-b:', fetchErr);
      }

      // ── L2-b: plus.io / XHR → base64 data URL（App 端可用）──
      // 注意：getFileSystemManager 是微信小程序专属 API，uni-app App 端不可用
      // App 端应使用 plus.io 或 XMLHttpRequest 读取本地文件
      try {
        const dataUrl = await readFileAsDataUrl(imgPath);
        if (dataUrl) {
          console.log(`[L2-b] data URL 准备完成 (${Math.round(dataUrl.length / 1024)}KB)`);
          const loadResult = await loadDataUrl(dataUrl, maxSize, safeResolve);
          if (loadResult) return;
        }
      } catch (fsErr) {
        console.warn('[L2-b] 文件读取失败:', fsErr);
      }

      // ── 所有 L2 子策略均失败 ──
      console.error('[L2 fallback] 所有加载方式均失败');
      safeResolve({ count: 0, confidence: 0, message: '无法读取图片(App安全限制)', regions: [] });
    },
    fail: (err) => {
      console.error('[L2 fallback] getImageInfo 失败:', err);
      safeResolve({ count: 0, confidence: 0, message: '无法读取图片:' + String((err && (err as any).errMsg) || err), regions: [] });
    },
  });
}

/**
 * 用 blob URL 加载 Image 并分析像素
 * @returns true=已处理(resolve或应停止), false=失败需重试其他方式
 */
async function loadImageFromBlobUrl(
  blobUrl: string,
  maxSize: number,
  safeResolve: (r: CountResult) => void,
): Promise<boolean> {
  return new Promise<boolean>((cb) => {
    const tryImg = new Image();
    let settled = false;

    const l2Timer = setTimeout(() => {
      console.warn('[L2-a] blob Image 超时(5s)');
      URL.revokeObjectURL(blobUrl);
      cb(false); // 告诉调用方此路不通
    }, 5000);

    tryImg.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(l2Timer);
      URL.revokeObjectURL(blobUrl);
      try {
        let w = tryImg.width, h = tryImg.height;
        if (w > maxSize || h > maxSize) {
          const s = maxSize / Math.max(w, h);
          w = Math.round(w * s); h = Math.round(h * s);
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        if (!cx) { safeResolve({ count: 0, confidence: 0, message: 'Canvas 失败', regions: [] }); cb(true); return; }
        cx.drawImage(tryImg, 0, 0, w, h);
        const data = cx.getImageData(0, 0, w, h);
        console.log(`[L2-a] 分析完成: ${w}x${h}`);
        safeResolve(analyzePixels(data.data as Uint8ClampedArray, w, h));
        cb(true);
      } catch (e) {
        console.error('[L2-a] 处理异常:', e);
        safeResolve({ count: 0, confidence: 0, message: 'L2-a 异常:' + String(e), regions: [] });
        cb(true);
      }
    };

    tryImg.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(l2Timer);
      URL.revokeObjectURL(blobUrl);
      console.warn('[L2-a] blob Image onerror');
      cb(false); // 告诉调用方此路不通，尝试下一种方式
    };

    tryImg.src = blobUrl;
  });
}

/**
 * 用 base64 data URL 加载 Image 并分析像素
 * data URL 是 WebView 100% 支持的内联协议，不受本地文件安全限制
 * @returns true=已处理, false=失败
 */
async function loadDataUrl(
  dataUrl: string,
  maxSize: number,
  safeResolve: (r: CountResult) => void,
): Promise<boolean> {
  return new Promise<boolean>((cb) => {
    const tryImg = new Image();
    let settled = false;

    const timer = setTimeout(() => {
      console.warn('[L2-b] base64 Image 超时(5s)');
      // data URL 是内联字符串，无需像 blob URL 那样 revoke
      cb(false);
    }, 5000);

    tryImg.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        let w = tryImg.width, h = tryImg.height;
        if (w <= 0 || h <= 0) { cb(false); return; }
        if (w > maxSize || h > maxSize) {
          const s = maxSize / Math.max(w, h);
          w = Math.round(w * s); h = Math.round(h * s);
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        if (!cx) { safeResolve({ count: 0, confidence: 0, message: 'Canvas失败(L2-b)', regions: [] }); cb(true); return; }
        cx.drawImage(tryImg, 0, 0, w, h);
        const data = cx.getImageData(0, 0, w, h);
        console.log(`[L2-b] base64 分析完成: ${w}x${h}`);
        safeResolve(analyzePixels(data.data as Uint8ClampedArray, w, h));
        cb(true);
      } catch (e) {
        safeResolve({ count: 0, confidence: 0, message: 'L2-b异常:' + String(e), regions: [] });
        cb(true);
      }
    };

    tryImg.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      console.warn('[L2-b] base64 Image onerror');
      cb(false);
    };

    tryImg.src = dataUrl;
  });
}

/**
 * 读取本地文件并返回 base64 data URL
 * 按优先级尝试多种方式：
 *   1. plus.io (App 端原生 API)
 *   2. XMLHttpRequest (file:// 协议)
 *   3. 返回空字符串（全部失败）
 */
async function readFileAsDataUrl(filePath: string): Promise<string> {
  // 方式1: plus.io (uni-app App 端)
  try {
    if (typeof (window as any).plus !== 'undefined' && (window as any).plus && (window as any).plus.io) {
      return await new Promise<string>((resolve) => {
        (window as any).plus.io.resolveLocalFileSystemURL(
          filePath,
          (entry: any) => {
            entry.file(
              (file: any) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const result = reader.result as string;
                  resolve(result && result.startsWith('data:') ? result : '');
                };
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
              },
              () => resolve(''),
            );
          },
          () => resolve(''),
        );
      });
    }
  } catch (e) {
    // plus 不可用，继续尝试其他方式
  }

  // 方式2: XMLHttpRequest
  try {
    return await new Promise<string>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', filePath, true);
      xhr.responseType = 'blob';
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 0) { // file:// 通常返回 0
          const blob = xhr.response as Blob;
          const ext = (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i) || [])[1] || 'jpg';
          const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
          const mime = mimeMap[ext.toLowerCase()] || 'image/jpeg';
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result && result.startsWith('data:') ? result : '');
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        } else {
          resolve('');
        }
      };
      xhr.onerror = () => resolve('');
      xhr.send();
    });
  } catch (e) {
    // XHR 也失败
  }

  return '';
}


// ─────────────────────────────────────────────
// 通用像素分析核心
// ─────────────────────────────────────────────

export function analyzePixels(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): CountResult {
  return _analyzePixelsCore(data, w, h, false);
}

export function analyzeWithOverlay(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): CountResult {
  return _analyzePixelsCore(data, w, h, true);
}

// 核心分析函数（内部实现，不直接导出 —— 用 _ 前缀表示"仅供模块内调用"）
function _analyzePixelsCore(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  includePixels: boolean,
): CountResult {
  const totalPixels = w * h;

  // 1. 高斯模糊降噪
  const blurred = gaussianBlur3x3(data, w, h);

  // 2. 构建亮度数组（只计算一次，后续步骤复用）
  const lumas = new Float64Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const pi = i * 4;
    lumas[i] = luma(blurred[pi], blurred[pi + 1], blurred[pi + 2]);
  }

  // 3. 亮度直方图空隙分割
  const threshold = findHistogramGap(lumas, totalPixels);

  // 4. 二值化（复用已有的 lumas 数组）
  let bin = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    bin[i] = lumas[i] > threshold ? 1 : 0;
  }

  // 5. 自适应形态学开运算半径
  // 前景占比越小 → 药片越细小/稀疏 → 开运算半径必须更小，避免腐蚀掉药片本身
  const fgCount = bin.reduce((s, v) => s + v, 0);
  const fgPct = fgCount / totalPixels;
  let openRadius: number;
  if (fgPct < 0.02) openRadius = 1;       // 极小药片（单片照片）
  else if (fgPct < 0.08) openRadius = 2;   // 小药片
  else if (fgPct < 0.25) openRadius = 3;   // 中等
  else openRadius = 4;                       // 大面积前景

  // v8 安全保护：极小图片时限制核尺寸不超过短边的 1/6
  const minDim = Math.min(w, h);
  const safeRadius = Math.min(openRadius, Math.max(1, Math.floor(minDim / 6)));

  bin = morphOpen(bin, w, h, safeRadius);
  bin = fillHoles(bin, w, h);
  bin = morphClose(bin, w, h, 2);

  // 6. 连通区域标记
  const rawRegions = labelConnectedComponents(bin, w, h);

  // 7. 特征提取
  const features: PillRegion[] = [];
  for (const raw of rawRegions) {
    const feat = extractRegionFeatures(raw, blurred, w, includePixels);
    if (feat) features.push(feat);
  }

  // 8. 过滤
  const filtered = filterRegions(features, totalPixels, threshold);

  // 9. 按面积排序
  filtered.sort((a, b) => b.area - a.area);

  // 10. 置信度
  const confidence = calculateConfidence(filtered);

  // 11. 生成结果
  const count = filtered.length;
  let message = '';
  if (count === 0) {
    message = '未检测到药片，请确保药片比背景更亮';
  } else if (confidence < 0.5) {
    message = `检测到约 ${count} 片，请手动确认数量`;
  } else {
    message = `检测到 ${count} 片药片`;
  }

  return { count, confidence, message, regions: filtered };
}
