<template>
  <view class="photo-page">
    <!-- ═══ 赛博HUD导航栏（扫描器模式）═══ -->
    <view class="cyber-nav-hud">
      <view class="hud-scanline-top"></view>
      <view class="cyber-nav-hud-inner">
        <!-- 左侧十字瞄准 -->
        <view class="hud-crosshair hud-crosshair-left">
          <view class="crosshair-line crosshair-h"></view>
          <view class="crosshair-line crosshair-v"></view>
        </view>
        <view class="hud-title-wrap">
          <text class="cyber-nav-hud-title">◎ 视觉识别</text>
          <text class="cyber-nav-hud-sub">// VISION_SYSTEM_v2.4</text>
        </view>
        <!-- 右侧状态指示 -->
        <view class="hud-status-indicator">
          <view class="status-dot"></view>
          <text class="status-text">ONLINE</text>
        </view>
      </view>
      <view class="hud-scanline-bottom"></view>
    </view>

    <view class="container">

      <!-- ① 未拍照：强制引导拍照 -->
      <view v-if="!imagePath" class="force-shoot-wrap">
        <view class="force-shoot-card">
          <text class="shoot-icon">⊙</text>
          <text class="shoot-title">请先拍摄药片照片</text>
          <text class="shoot-desc">将药片平铺在纯色背景板上，保持间距，在光线充足处拍摄</text>
          <view class="btn-shoot" @tap="shootPhoto">
            <text>⊙ 立即拍照</text>
          </view>
          <view class="btn-album" @tap="chooseFromAlbum">
            <text>◻ 从相册选取</text>
          </view>
        </view>
        <view class="tips-card">
          <text class="tips-title">✦ 拍摄建议</text>
          <text class="tips-item">• 深色背景板效果最佳（黑色/深蓝色）</text>
          <text class="tips-item">• 药片之间留 1~2 粒间距，不要叠放</text>
          <text class="tips-item">• 手机垂直朝下，保持平行于药片平面</text>
          <text class="tips-item">• 光线充足、均匀，避免强烈阴影</text>
        </view>
      </view>

      <!-- ② 已拍照：预览 + 分析结果 -->
      <view v-else>
        <!-- 图片预览（分析前显示原图，分析后显示带轮廓的 Canvas） -->
        <view class="image-preview-wrap">
          <!-- 分析前或无结果：显示原图 -->
          <image
            v-if="!countResult"
            :src="displayImagePath || imagePath"
            mode="aspectFit"
            class="preview-image"
            @tap="previewFullImage"
          />
          <!-- 分析后：显示带轮廓的 Canvas（H5）或图片（App） -->
          <view v-else class="canvas-preview-wrap" @tap="previewFullImage">
            <!-- H5 端：使用 Canvas -->
            <canvas
              v-if="!isApp"
              id="pill-canvas"
              canvas-id="pill-canvas"
              class="overlay-canvas"
            />
            <!-- App 端：继续显示图片（我们在 App 端不做叠加层绘制） -->
            <image
              v-else
              :src="displayImagePath || imagePath"
              mode="aspectFit"
              class="preview-image"
            />
          </view>
          <view class="retake-btn" @tap="retakePhoto">
            <text>🔄 重拍</text>
          </view>
          <view class="save-badge" :class="saveFailed ? 'badge-fail' : (savedToAlbum ? 'badge-ok' : 'badge-wait')">
            <text>{{ saveFailed ? '✗ 保存失败' : (savedToAlbum ? '✓ 已保存' : '保存中…') }}</text>
          </view>
        </view>

        <!-- 隐藏 Canvas（像素分析用，固定在屏幕外）- 仅 App 端需要 -->
        <!-- #ifdef APP-PLUS -->
        <canvas 
          canvas-id="pill-detect-canvas" 
          id="pill-detect-canvas"
          style="position: absolute; left: -9999px; top: -9999px; width: 640px; height: 640px;"
        ></canvas>
        <!-- #endif -->
        
        <!-- #ifdef H5 -->
        <canvas id="pill-analysis-canvas" style="position:fixed;left:-9999px;top:-9999px;width:640px;height:640px;"></canvas>
        <!-- #endif -->

        <!-- 分析中 -->
        <view v-if="isAnalyzing" class="card analyzing-card">
          <view class="loading-wrap">
            <view class="loading-spinner"></view>
            <text class="loading-text">{{ analyzingStep }}</text>
          </view>
          <text class="loading-hint">纯离线处理，图片不会上传</text>
        </view>

        <!-- 分析结果（仅数量检测） -->
        <view v-if="countResult && !isAnalyzing" class="result-section">

          <!-- 总数概览 -->
          <view class="card summary-card">
            <view class="summary-row">
              <view class="summary-item">
                <text class="summary-number">{{ countResult.count }}</text>
                <text class="summary-label">检测到的药片数</text>
              </view>
            </view>
            <view class="confidence-row">
              <text class="conf-label">检测置信度</text>
              <view class="confidence-bar">
                <view
                  class="confidence-fill"
                  :class="countResult.confidence >= 0.75 ? 'fill-high' : countResult.confidence >= 0.5 ? 'fill-mid' : 'fill-low'"
                  :style="{ width: (countResult.confidence * 100) + '%' }"
                ></view>
              </view>
              <text class="conf-value">{{ Math.round(countResult.confidence * 100) }}%</text>
            </view>
            <view class="result-msg" :class="countResult.count === 0 ? 'msg-warn' : 'msg-ok'">
              <text>{{ countResult.message }}</text>
            </view>
          </view>

          <!-- 标注图片显示 -->
          <view v-if="countResult && annotatedImagePath" class="card annotation-card">
            <text class="section-title">🎯 药片检测标注</text>
            <text class="annotation-hint">绿色区域表示识别的药片位置</text>
            <image
              :src="annotatedImagePath"
              mode="aspectFit"
              class="annotation-image"
            />
          </view>

          <!-- 手动修改药片数量 -->
          <view v-if="!isCountConfirmed" class="card adjust-count-card">
            <text class="section-title">✏️ 调整药片数量</text>
            <text class="adjust-hint">如果检测有误，可手动修改药片数量</text>
            <view class="count-adjuster">
              <view class="adjust-btn minus" @tap="decreaseCount">
                <text>−</text>
              </view>
              <view class="count-display">
                <text class="count-num">{{ finalPillCount }}</text>
                <text class="count-unit">片</text>
              </view>
              <view class="adjust-btn plus" @tap="increaseCount">
                <text>+</text>
              </view>
            </view>
            <view class="confirm-btn-row">
              <view class="btn-confirm" @tap="confirmCount">
                <text>✓ 确定</text>
              </view>
            </view>
          </view>

          <!-- 每日拍照模式 - 对比检测结果 -->
          <view v-if="isDailyMode && isCountConfirmed" class="card daily-compare-card">
            <text class="section-title">📊 每日拍照对比</text>
            <view class="compare-row">
              <view class="compare-item">
                <text class="compare-label">预期数量</text>
                <text class="compare-number expected">{{ expectedDailyCount }}</text>
              </view>
              <view class="compare-symbol">
                <text>VS</text>
              </view>
              <view class="compare-item">
                <text class="compare-label">确认数量</text>
                <text class="compare-number detected">{{ finalPillCount }}</text>
              </view>
            </view>
            <view
              class="compare-result"
              :class="{
                'result-match': finalPillCount === expectedDailyCount,
                'result-excess': finalPillCount > expectedDailyCount,
                'result-deficit': finalPillCount < expectedDailyCount && finalPillCount > 0
              }"
            >
              <text v-if="finalPillCount === expectedDailyCount" class="result-text">✓ 完美匹配！可以标记为完成</text>
              <text v-else-if="finalPillCount > expectedDailyCount" class="result-text">⚠ 药片数超过预期</text>
              <text v-else-if="finalPillCount > 0" class="result-text">⚠ 药片数少于预期</text>
            </view>
          </view>

          <!-- 拍摄建议 -->
          <view v-if="(countResult.count === 0 || countResult.confidence < 0.55) && !isDailyMode" class="card tips-box">
            <text class="tips-title">💡 提高检测效果的建议</text>
            <text class="tips-item">• 将药片摆放在黑色或深色背景板上</text>
            <text class="tips-item">• 保持药片之间有间隙，不要堆叠</text>
            <text class="tips-item">• 在光线充足均匀的环境下拍摄</text>
          </view>

          <!-- 离线说明 -->
          <view class="card info-card">
            <text class="section-title">🔒 完全离线处理</text>
            <text class="info-text">所有分析在设备本地完成，图片不会上传到任何服务器。</text>
          </view>
        </view>
      </view>

    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, getCurrentInstance, nextTick, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useMedStore } from '../../stores/index';
import { countPillsH5WithOverlay, countPillsApp, type CountResult } from '../../utils/pillCounter';
import type { Medication } from '../../types';
import { persistImage, resolveDisplayUrl, fileToDataUrl, deletePersistedImage } from '../../utils/imageStorage';

declare const wx: any;

const store = useMedStore();
const instance = getCurrentInstance();

// 基础状态
const imagePath = ref('');
const displayImagePath = ref('');
const annotatedImagePath = ref('');  // 标注后的图片路径
const isAnalyzing = ref(false);
const analyzingStep = ref('正在检测药片…');
const countResult = ref<CountResult | null>(null);
const savedToAlbum = ref(false);
const saveFailed = ref(false);

// 数量调整状态
const finalPillCount = ref(0);  // 用户最终确认的数量
const isCountConfirmed = ref(false);  // 是否已确认数量

// 每日拍照模式
const isDailyPhotoMode = ref(false);
const dailyPhotoResult = ref<'pending' | 'completed' | 'mismatch'>('pending');

// 药品库
const medications = computed(() => store.medications);

// 检测是否是 App 端
const isApp = typeof plus !== 'undefined';

// 每日预期药片数
const expectedPillCount = computed(() => store.todayExpectedPillCount);
const isDailyMode = computed(() => isDailyPhotoMode.value);
const expectedDailyCount = computed(() => expectedPillCount.value);

// ── 初始化检查模式 ─────────────────────────────────────
onLoad((query: any) => {
  // 检查 URL 参数，判断是否是每日拍照模式
  if (query && query.mode === 'daily') {
    isDailyPhotoMode.value = true;
  }
});

// ── 拍照 ─────────────────────────────────────
function shootPhoto() {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera'],
    sizeType: ['compressed'],
    success: (res) => handleNewPhoto(res.tempFilePaths[0]),
  });
}

function chooseFromAlbum() {
  uni.chooseImage({
    count: 1,
    sourceType: ['album'],
    sizeType: ['compressed'],
    success: (res) => handleNewPhoto(res.tempFilePaths[0]),
  });
}

/**
 * 保存图片到系统相册
 * - App 端：直接调用 saveImageToPhotosAlbum（系统自动弹权限弹窗，无需手动 authorize）
 * - 小程序端：同上
 * - H5 端：触发 <a download> 下载（浏览器环境无相册概念）
 * - 无论成功还是失败，都会更新 savedToAlbum 状态
 */
async function savePhotoToAlbum(filePath: string) {
  // #ifdef H5
  // H5 端：触发 a 标签下载，不存在"相册"概念，直接标记完成
  try {
    const a = document.createElement('a');
    a.href = filePath;
    a.download = `pill_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    console.warn('[Recognize] H5 下载失败:', e);
  }
  savedToAlbum.value = true;
  // #endif

  // #ifndef H5
  // App 端 & 小程序端：正确等待异步保存操作完成
  // ★ 修复：添加 await 确保 doSaveToAlbum 的异步回调完成
  // 原因：之前不等待，导致保存状态无法及时更新
  await doSaveToAlbum(filePath);
  // #endif
}

function doSaveToAlbum(filePath: string): Promise<void> {
  // ★ 修复：返回 Promise，确保调用者可以正确 await
  return new Promise<void>((resolve) => {
    // ★ 超时保护（10秒）：防止系统静默挂起导致 Promise 永远不 resolve
    // 这是项目中唯一缺少超时的异步操作（其他如 persistImage/fileToDataUrl/countPills 均有）
    const timer = setTimeout(() => {
      console.warn('[Recognize] saveImageToPhotosAlbum 超时(10s)，标记为失败');
      saveFailed.value = true;
      resolve();
    }, 10000);

    uni.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        clearTimeout(timer);
        savedToAlbum.value = true;
        console.log('[Recognize] ✅ saveImageToPhotosAlbum success，已保存到相册');
        resolve();  // 成功时 resolve
      },
      fail: (err) => {
        clearTimeout(timer);
        console.warn('[Recognize] ⚠️ saveImageToPhotosAlbum fail:', err);
        saveFailed.value = true;  // ★ BUG-06 修复：设为 true，让状态变化可见
        savedToAlbum.value = false;
        // 权限被拒时引导用户去系统设置开启
        uni.showModal({
          title: '无法保存到相册',
          content: '请在系统设置中允许访问相册',
          confirmText: '去设置',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // #ifdef APP-PLUS
              // Android 上打开应用设置
              if (typeof plus !== 'undefined' && plus.os.name === 'Android') {
                const main = plus.android.runtimeMainActivity();
                const Intent = plus.android.importClass('android.content.Intent') as any;
                const Settings = plus.android.importClass('android.provider.Settings') as any;
                const intent = new (Intent as any)(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                const Uri = plus.android.importClass('android.net.Uri') as any;
                const uri = Uri.fromParts('package', (main as any).getPackageName(), null);
                intent.setData(uri);
                (main as any).startActivity(intent);
              } else {
                // iOS 上打开应用设置
                plus.runtime.openURL('appSettings:');
              }
              // #endif
              // #ifdef MP-WEIXIN
              (wx as any).openSetting({ success: () => {} });
              // #endif
            }
          },
        });
        resolve();  // 失败时也 resolve（已向用户提示）
      },
    });
  });
}

function retakePhoto() {
  if (imagePath.value) {
    deletePersistedImage(imagePath.value);
  }
  imagePath.value = '';
  displayImagePath.value = '';
  countResult.value = null;
  savedToAlbum.value = false;
  saveFailed.value = false;
}

async function handleNewPhoto(filePath: string) {
  console.log('[Recognize] 处理新照片, 原始路径:', filePath);
  
  // 1. 立即重置状态并显示图片（使用临时路径先显示，避免等待持久化）
  savedToAlbum.value = false;
  saveFailed.value = false;
  imagePath.value = filePath;
  displayImagePath.value = filePath;
  
  // 2. 立即保存到相册（使用原始临时路径，uni.saveImageToPhotosAlbum 需要临时路径）
  savePhotoToAlbum(filePath).catch((e) => {
    console.error('[Recognize] 保存到相册异常:', e);
    saveFailed.value = true;
  });

  // 3. 异步持久化和转换，不阻塞识别流程
  // 使用 setTimeout 确保上面的状态更新已经渲染
  setTimeout(async () => {
    try {
      // ★ 优化：记录持久化耗时（性能监测）
      const persistStartTime = performance.now();
      const persistedPath = await persistImage(filePath);
      const persistTime = performance.now() - persistStartTime;
      console.log(`[Recognize] 图片持久化完成 (${persistTime.toFixed(0)}ms): ${persistedPath.substring(0, 80)}`);
      
      if (persistedPath) {
        imagePath.value = persistedPath;
      }

      // App 端：转换为 data URL 以便显示
      if (isApp) {
        try {
          const dataUrl = await fileToDataUrl(persistedPath || filePath);
          if (dataUrl) {
            displayImagePath.value = dataUrl;
          } else {
            displayImagePath.value = persistedPath || filePath;
          }
        } catch (e) {
          console.warn('[Recognize] 转换 data URL 失败:', e);
          displayImagePath.value = persistedPath || filePath;
        }
      } else {
        const resolvedUrl = await resolveDisplayUrl(persistedPath);
        if (resolvedUrl) {
          displayImagePath.value = resolvedUrl;
        }
      }
    } catch (e) {
      console.error('[Recognize] 持久化异常:', e);
    }
  }, 0);

  // 4. 立即开始分析（使用临时路径，countPillsApp 内部会处理路径格式）
  startAnalysis(filePath);
}

function previewFullImage() {
  uni.previewImage({ urls: [imagePath.value], current: imagePath.value });
}

// ── 分析流程 ─────────────────────────────────
async function startAnalysis(filePath: string) {
  isAnalyzing.value = true;
  countResult.value = null;

  analyzingStep.value = '正在检测药片数量…';

  let count: CountResult;
  
  if (isApp) {
    console.log('[Recognize] App 端，使用 countPillsApp');
    count = await countPillsApp(filePath, 640);
  } else {
    console.log('[Recognize] H5 端，使用 countPillsH5WithOverlay');
    count = await countPillsH5WithOverlay(filePath, 'pill-canvas', {
      maxSize: 640,
      outlineColor: '#00E676',
      outlineWidth: 2,
      fillOpacity: 0.3,
      showLabel: true,
      labelColor: '#FFF',
      labelBgColor: 'rgba(0,150,136,0.85)',
    });
    
    await nextTick();
    const canvas = document.getElementById('pill-canvas') as HTMLCanvasElement;
    if (canvas) {
      const ratio = canvas.width / canvas.height;
      const displayWidth = 702;
      const displayHeight = Math.round(displayWidth / ratio);
      canvas.style.width = displayWidth + 'px';
      canvas.style.height = displayHeight + 'px';
    }
  }

  countResult.value = count;
  isAnalyzing.value = false;
  
  // 初始化数量调整状态
  finalPillCount.value = count.count;
  isCountConfirmed.value = false;

  // 生成并保存标注图片（H5: 直接从 canvas 导出；App: 在离屏 canvas 上绘制并导出）
  try {
    if (!isApp) {
      await nextTick();
      const canvas = document.getElementById('pill-canvas') as HTMLCanvasElement | null;
      if (canvas && typeof canvas.toDataURL === 'function') {
        try {
          annotatedImagePath.value = canvas.toDataURL('image/jpeg', 0.9);
        } catch (e) {
          console.warn('[Recognize] canvas.toDataURL 失败:', e);
        }
      }
    } else {
      // App 端：在离屏 canvas 上绘制绿色半透明填充的标注，并导出为临时文件
      await generateAnnotatedImageForApp(count);
    }
  } catch (e) {
    console.warn('[Recognize] 生成标注图片异常:', e);
  }
  
  console.log('[Recognize] 检测到的药片数量:', count.count);

  if (count.count > 0) {
    uni.showToast({ title: `检测到 ${count.count} 片药片，请确认`, icon: 'success' });
  } else {
    uni.showToast({ title: count.message || '未检测到药片', icon: 'none', duration: 2500 });
  }
}

// App 端：基于检测结果在离屏 canvas 绘制绿色半透明覆盖并导出为图片
function generateAnnotatedImageForApp(result: CountResult) {
  return new Promise<void>((resolve) => {
    if (!result || !result.regions || result.regions.length === 0) return resolve();

    const src = displayImagePath.value || imagePath.value || '';
    if (!src) return resolve();

    // 获取图片原始尺寸，计算与 countPillsViaUniCanvas 相同的缩放逻辑
    uni.getImageInfo({
      src,
      success: (info: any) => {
        let origW = info.width || 640;
        let origH = info.height || 640;
        const maxSize = 640;
        let targetW = origW;
        let targetH = origH;
        if (targetW > maxSize || targetH > maxSize) {
          const s = maxSize / Math.max(targetW, targetH);
          targetW = Math.round(targetW * s);
          targetH = Math.round(targetH * s);
        }

        try {
          const CANVAS_ID = 'pill-detect-canvas';
          // @ts-ignore uni.createCanvasContext
          const ctx: any = uni.createCanvasContext(CANVAS_ID);

          // 清空并绘制原图
          ctx.clearRect && ctx.clearRect(0, 0, targetW, targetH);
          ctx.drawImage && ctx.drawImage(src, 0, 0, targetW, targetH);

          // 半透明绿色覆盖
          ctx.setGlobalAlpha && ctx.setGlobalAlpha(0.35);
          ctx.setFillStyle && ctx.setFillStyle('#00FF88');

          for (const r of result.regions) {
            const x = r.bboxMinX || 0;
            const y = r.bboxMinY || 0;
            const w = r.width || Math.max(6, (r.bboxMaxX - (r.bboxMinX || 0)));
            const h = r.height || Math.max(6, (r.bboxMaxY - (r.bboxMinY || 0)));
            // 保护边界
            ctx.fillRect && ctx.fillRect(x, y, w, h);
          }

          // 恢复 alpha
          ctx.setGlobalAlpha && ctx.setGlobalAlpha(1);

          // draw 并导出为临时文件
          ctx.draw && ctx.draw(false, () => {
            // 导出图片
            try {
              uni.canvasToTempFilePath({
                canvasId: CANVAS_ID,
                success: (res: any) => {
                  annotatedImagePath.value = res.tempFilePath;
                  resolve();
                },
                fail: (err: any) => {
                  console.warn('[Recognize] canvasToTempFilePath 失败:', err);
                  resolve();
                },
              });
            } catch (e) {
              console.warn('[Recognize] canvasToTempFilePath 异常:', e);
              resolve();
            }
          });
        } catch (e) {
          console.warn('[Recognize] 在离屏 canvas 绘制失败:', e);
          resolve();
        }
      },
      fail: () => resolve(),
    });
  });
}

// 数量调整函数
function increaseCount() {
  if (finalPillCount.value < 100) {
    finalPillCount.value++;
  }
}

function decreaseCount() {
  if (finalPillCount.value > 0) {
    finalPillCount.value--;
  }
}

function confirmCount() {
  isCountConfirmed.value = true;
  
  // 如果是每日拍照模式，记录结果
  if (isDailyPhotoMode.value && imagePath.value) {
    const photoForRecord = annotatedImagePath.value || imagePath.value;
    const status = store.recordDailyPhoto(finalPillCount.value, photoForRecord);
    dailyPhotoResult.value = status;
  }
  
  uni.showToast({ title: `已确认 ${finalPillCount.value} 片`, icon: 'success' });
}
</script>

<style scoped>
/* ═══ 拍照识别页 — 赛博HUD风格 ═══ */

.photo-page { background: #080C14; min-height: 100vh; }
.container { padding: 24rpx; padding-bottom: 160rpx; }

/* ═══ 赛博HUD导航栏（扫描器模式）═══ */
.cyber-nav-hud {
  position: relative;
  background: linear-gradient(180deg, #080C14 0%, #0D1420 50%, #080C14 100%);
  padding: 48rpx 32rpx 22rpx;
  padding-top: calc(var(--status-bar-height, 44rpx) + 16rpx);
  border-bottom: 1rpx solid rgba(0, 229, 255, 0.2);
  overflow: hidden;
}

.hud-scanline-top {
  position: absolute; top: 0; left: 0; right: 0; height: 2rpx;
  background: #00E5FF;
  box-shadow: 0 0 15rpx rgba(0, 229, 255, 0.8), 0 0 40rpx rgba(176, 0, 255, 0.3);
  animation: hud-blink 2s ease-in-out infinite;
}
@keyframes hud-blink { 0%,100%{opacity:1;} 50%{opacity:0.4;} }

.cyber-nav-hud-inner {
  display: flex;
  align-items: center;
  gap: 16rpx;
  position: relative;
  z-index: 1;
}

/* 十字瞄准装饰 */
.hud-crosshair {
  width: 28rpx; height: 28rpx;
  position: relative; flex-shrink: 0;
}
.crosshair-line {
  position: absolute; background: #00E5FF;
}
.crosshair-h { width: 100%; height: 2rpx; top: 50%; left: 0; margin-top: -1rpx; box-shadow: 0 0 6rpx #00E5FF; }
.crosshair-v { width: 2rpx; height: 100%; left: 50%; top: 0; margin-left: -1rpx; box-shadow: 0 0 6rpx #00E5FF; }

.hud-title-wrap { display: flex; flex-direction: column; gap: 2rpx; }

.cyber-nav-hud-title {
  font-size: 38rpx;
  font-weight: 900;
  color: #00E5FF;
  text-transform: uppercase;
  letter-spacing: 4rpx;
  text-shadow:
    0 0 10rpx rgba(0, 229, 255, 0.7),
    0 0 30rpx rgba(0, 229, 255, 0.3),
    0 0 60rpx rgba(176, 0, 255, 0.15);
  font-family: 'Orbitron', 'Rajdhani', sans-serif;
}

.cyber-nav-hud-sub {
  font-size: 18rpx;
  color: #B000FF;
  font-family: 'Courier New', monospace;
  letter-spacing: 3rpx;
  text-shadow: 0 0 8rpx rgba(176, 0, 255, 0.5);
}

.hud-status-indicator {
  margin-left: auto;
  display: flex; align-items: center; gap: 8rpx;
  background: rgba(0, 229, 255, 0.06);
  border: 1rpx solid rgba(0, 229, 255, 0.2);
  border-radius: 30rpx;
  padding: 6rpx 16rpx;
}
.status-dot {
  width: 12rpx; height: 12rpx;
  border-radius: 50%;
  background: #00FF88;
  box-shadow: 0 0 8rpx rgba(0, 255, 136, 0.7);
  animation: dot-pulse 1.5s ease-in-out infinite;
}
@keyframes dot-pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
.status-text {
  font-size: 20rpx;
  color: #00FF88;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  letter-spacing: 2rpx;
}

.hud-scanline-bottom {
  position: absolute; bottom: 0; left: 5%; right: 5%; height: 1rpx;
  background: linear-gradient(90deg, transparent, #B000FF 30%, #00E5FF 70%, transparent);
  box-shadow: 0 0 8rpx rgba(176, 0, 255, 0.5), 0 -2rpx 12rpx rgba(0, 229, 255, 0.15);
}

/* ── 拍照引导（赛博HUD）── */
.force-shoot-wrap { display: flex; flex-direction: column; gap: 24rpx; }

.force-shoot-card {
  background: rgba(8, 12, 20, 0.85);
  border-radius: 9rpx;
  padding: 56rpx 36rpx;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  border: 1rpx solid rgba(0, 229, 255, 0.15);
  box-shadow:
    0 0 20rpx rgba(0, 229, 255, 0.06),
    inset 0 0 30rpx rgba(0, 229, 255, 0.02);
  position: relative; overflow: hidden;

  /* 顶部扫描线 */
  &::before {
    content: '';
    position: absolute;
    top: 0; left: -100%; right: -100%; height: 2rpx;
    background: linear-gradient(90deg, transparent, #00E5FF 30%, #B000FF 70%, transparent);
    animation: hud-sweep 3s linear infinite;
    box-shadow: 0 0 10rpx #00E5FF;
  }
}

@keyframes hud-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

.shoot-icon { font-size: 96rpx; margin-bottom: 20rpx; animation: cyber-pulse-icon 2s ease-in-out infinite; }
@keyframes cyber-pulse-icon {
  0%,100%{ transform:scale(1); filter:drop-shadow(0 0 10rpx rgba(0,229,255,0.3)); }
  50%{ transform:scale(1.08); filter:drop-shadow(0 0 25rpx rgba(0,229,255,0.6)); }
}
.shoot-title { font-size: 36rpx; font-weight: 900; color: #00E5FF; margin-bottom: 14rpx; letter-spacing: 4rpx; text-transform: uppercase; text-shadow: 0 0 12rpx rgba(0,229,255,0.4); }
.shoot-desc { font-size: 30rpx; color: #5C708A; line-height: 1.75; margin-bottom: 44rpx; padding: 0 16rpx; }

.btn-shoot {
  width: 100%;
  background: transparent;
  color: #00E5FF;
  font-size: 34rpx; font-weight: 900; padding: 28rpx 0;
  border-radius: 9rpx; text-align: center;
  border: 2rpx solid #00E5FF;
  transition: all 200ms ease;
  text-transform: uppercase;
  letter-spacing: 6rpx;
  box-shadow:
    0 0 10rpx rgba(0, 229, 255, 0.2),
    inset 0 0 12rpx rgba(0, 229, 255, 0.05);
}
.btn-shoot::before { content: none; }
.btn-shoot:active {
  background: rgba(0, 229, 255, 0.1);
  box-shadow: 0 0 25rpx rgba(0, 229, 255, 0.5);
  transform: scale(0.98);
}

.btn-album {
  width: 100%; background: transparent; color: #B000FF;
  font-size: 28rpx; font-weight: 600; padding: 20rpx 0;
  border-radius: 9rpx; text-align: center;
  border: 1rpx solid rgba(176, 0, 255, 0.3); margin-top: 16rpx;
  letter-spacing: 2rpx;
  text-transform: uppercase;
}
.btn-album:active { background: rgba(176, 0, 255, 0.08); box-shadow: 0 0 15rpx rgba(176, 0, 255, 0.2); }

.tips-card { background: rgba(255, 149, 0, 0.03); border-radius: 9rpx; padding: 28rpx; border: 1rpx solid rgba(255, 183, 77, 0.15); }
.tips-title { font-size: 32rpx; font-weight: 700; color: #FF9500; display: block; margin-bottom: 14rpx; }
.tips-item { font-size: 28rpx; color: #5C708A; display: block; line-height: 1.85; }

.med-count-card { background: rgba(0,255,136,0.04); border-radius: 27rpx; padding: 22rpx 28rpx; border: 1rpx solid rgba(0,255,136,0.1); }
.med-count-card.warn { background: rgba(255,149,0,0.04); border-color: rgba(255,149,0,0.1); }
.med-count-text { font-size: 28rpx; font-weight: 600; color: #E0EAF2; display: block; }
.med-count-sub { font-size: 28rpx; color: #5C708A; display: block; margin-top: 4rpx; }

/* ═══ 图片预览 — 赛博视窗 ═══ */
.image-preview-wrap {
  position: relative; border-radius: 9rpx; overflow: hidden;
  background: #000; margin-bottom: 22rpx;
  border: 1rpx solid rgba(0, 229, 255, 0.2);
  box-shadow:
    0 0 20rpx rgba(0, 0, 0, 0.5),
    0 0 40rpx rgba(0, 229, 255, 0.06),
    inset 0 0 30rpx rgba(0, 229, 255, 0.03);

  &::before, &::after {
    content: ''; position: absolute; width: 28rpx; height: 28rpx;
    border-color: #00E5FF; border-style: solid; pointer-events: none; z-index: 5;
    box-shadow: 0 0 8rpx rgba(0, 229, 255, 0.6);
  }
  &::before { top: 10rpx; left: 10rpx; border-width: 3rpx 0 0 3rpx; }
  &::after { bottom: 10rpx; right: 10rpx; border-width: 0 3rpx 3rpx 0; }
}
.preview-image { width: 100%; height: 500rpx; }
.canvas-preview-wrap { width: 100%; display: flex; justify-content: center; align-items: center; min-height: 500rpx; background: #000; }
.overlay-canvas {
  max-width: 100%;
  max-height: 600px;
  border-radius: 27rpx;
}
.retake-btn {
  position: absolute; bottom: 16rpx; right: 16rpx;
  background: rgba(0, 10, 20, 0.8); color: #00E5FF;
  padding: 12rpx 24rpx; border-radius: 9rpx; font-size: 26rpx; font-weight: 600;
  border: 1rpx solid rgba(0, 229, 255, 0.3); z-index: 3;
  letter-spacing: 1rpx; text-shadow: 0 0 6rpx rgba(0,229,255,0.4);
}
.save-badge {
  position: absolute; top: 12rpx; left: 12rpx;
  padding: 8rpx 20rpx; border-radius: 3rpx; font-size: 20rpx; font-weight: 700;
  z-index: 3; font-family: 'Courier New', monospace; letter-spacing: 1rpx;
}
.badge-ok   { background: rgba(0,255,136,0.85); color: #000; border: none; text-shadow: none; }
.badge-wait { background: rgba(0,10,20,0.85); color: #00E5FF; border: 1rpx solid #00E5FF; animation: cyber-pulse-icon 1.5s ease-in-out infinite; box-shadow: 0 0 10rpx rgba(0,229,255,0.3); }
.badge-fail { background: rgba(255,32,96,0.85); color: #FFF; border: none; }

/* ═══ 卡片通用 — 赛博面板 ═══ */
.card {
  background: rgba(8, 14, 22, 0.85);
  border: 1rpx solid rgba(0, 229, 255, 0.1);
  border-radius: 9rpx; padding: 28rpx; margin-bottom: 20rpx;
  position: relative;
  box-shadow:
    0 0 15rpx rgba(0, 0, 0, 0.3),
    inset 0 0 20rpx rgba(0, 229, 255, 0.02);
}

/* ═══ 分析中 — 赛博加载 ═══ */
.analyzing-card { text-align: center; padding: 48rpx 28rpx; }
.loading-wrap { display: flex; flex-direction: column; align-items: center; gap: 22rpx; margin-bottom: 18rpx; }
.loading-spinner {
  width: 72rpx; height: 72rpx;
  border: 3rpx solid rgba(0, 229, 255, 0.1);
  border-top-color: #00E5FF; border-right-color: #B000FF;
  border-radius: 50%; animation: spin 0.7s linear infinite;
  box-shadow: 0 0 15rpx rgba(0, 229, 255, 0.3), inset 0 0 10rpx rgba(176, 0, 255, 0.1);
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 32rpx; color: #00E5FF; font-weight: 700; text-shadow: 0 0 10rpx rgba(0,229,255,0.4); letter-spacing: 2rpx; }
.loading-hint { font-size: 28rpx; color: #3A4A5A; }

/* ═══ 置信度条 — 赛博霓虹 ═══ */
.confidence-row { display: flex; align-items: center; gap: 14rpx; margin-bottom: 18rpx; }
.conf-label { font-size: 28rpx; color: #4A5568; white-space: nowrap; }
.confidence-bar { flex: 1; height: 10rpx; background: rgba(0,10,20,0.7); border-radius: 3rpx; overflow: hidden; border: 1rpx solid rgba(0,229,255,0.1); }
.confidence-fill { height: 100%; border-radius: 3rpx; transition: width 0.6s ease; box-shadow: 0 0 8rpx currentColor; }
.fill-high { background: linear-gradient(90deg, #00FF88, #00E5FF); box-shadow: 0 0 10rpx rgba(0,255,136,0.4); }
.fill-mid  { background: linear-gradient(90deg, #FF9500, #FFB74D); }
.fill-low  { background: linear-gradient(90deg, #FF2060, #FF9500); box-shadow: 0 0 10rpx rgba(255,32,96,0.4); }
.conf-value { font-size: 26rpx; font-weight: 900; color: #00E5FF; white-space: nowrap; min-width: 66rpx; text-align: right; font-family: 'Courier New', monospace; text-shadow: 0 0 8rpx rgba(0,229,255,0.4); }

/* ═══ 结果显示 — 霓虹数字 ═══ */
.result-card { border-left: 5rpx solid #00FF88 !important; }
.count-display { display: flex; align-items: center; justify-content: center; margin-bottom: 28rpx; }
.count-minus, .count-plus {
  width: 90rpx; height: 90rpx; border-radius: 50%;
  background: rgba(0,229,255,0.08); color: #00E5FF; font-size: 52rpx;
  display: flex; align-items: center; justify-content: center; font-weight: 700;
  border: 1rpx solid rgba(0,229,255,0.2);
}
.count-center { display: flex; align-items: baseline; gap: 8rpx; margin: 0 36rpx; }
.count-number {
  font-size: 110rpx; font-weight: 900; color: #00E5FF; line-height: 1;
  text-shadow: 0 0 20rpx rgba(0, 229, 255, 0.5), 0 0 50rpx rgba(0, 229, 255, 0.15);
  font-family: 'Courier New', monospace; letter-spacing: 4rpx;
}
.count-unit { font-size: 38rpx; color: #5C708A; font-weight: 600; }

.result-msg { padding: 14rpx 18rpx; border-radius: 15rpx; font-size: 26rpx; line-height: 1.6; margin-bottom: 10rpx; }
.msg-ok   { background: rgba(129,199,132,0.08); color: #81C784; border: 1rpx solid rgba(129,199,132,0.12); }
.msg-warn { background: rgba(255,183,77,0.08); color: #FFB74D; border: 1rpx solid rgba(255,183,77,0.12); }

/* ═══ 信息卡片 ═══ */
.info-card { background: rgba(0,229,255,0.02); border-color: rgba(0,229,255,0.12); }
.info-text { font-size: 24rpx; color: #4A5568; line-height: 1.8; display: block; font-family: 'Courier New', monospace; }
.tips-box { background: rgba(255,149,0,0.02); border-color: rgba(255,149,0,0.1); }

/* ═══ 数量调整卡片 ═══ */
.adjust-count-card {
  background: linear-gradient(135deg, rgba(0, 255, 136, 0.08) 0%, rgba(0, 217, 255, 0.04) 100%);
  border: 2rpx solid rgba(0, 255, 136, 0.3);
  box-shadow: 0 0 20rpx rgba(0, 255, 136, 0.15);
}

.adjust-hint {
  font-size: 24rpx;
  color: #5C708A;
  display: block;
  margin-bottom: 16rpx;
}

.count-adjuster {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 28rpx;
  margin-bottom: 20rpx;
  padding: 20rpx;
  background: rgba(0, 255, 136, 0.05);
  border-radius: 9rpx;
}

.adjust-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52rpx;
  font-weight: 900;
  background: rgba(0, 229, 255, 0.15);
  border: 2rpx solid rgba(0, 229, 255, 0.3);
  color: #00D9FF;
  transition: all 0.2s ease;
}

.adjust-btn:active {
  transform: scale(0.9);
  background: rgba(0, 229, 255, 0.25);
  box-shadow: 0 0 12rpx rgba(0, 229, 255, 0.4);
}

.adjust-btn.plus {
  color: #00FF88;
  background: rgba(0, 255, 136, 0.15);
  border-color: rgba(0, 255, 136, 0.3);
}

.adjust-btn.plus:active {
  background: rgba(0, 255, 136, 0.25);
  box-shadow: 0 0 12rpx rgba(0, 255, 136, 0.4);
}

.count-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.count-num {
  font-size: 88rpx;
  font-weight: 900;
  color: #00FF88;
  line-height: 1;
  text-shadow: 0 0 15rpx rgba(0, 255, 136, 0.6);
  font-family: 'Courier New', monospace;
}

.count-unit {
  font-size: 28rpx;
  color: #5C708A;
  font-weight: 600;
}

.confirm-btn-row {
  display: flex;
  justify-content: center;
}

.btn-confirm {
  padding: 12rpx 36rpx;
  background: linear-gradient(135deg, #00FF88 0%, #00D9FF 100%);
  border-radius: 15rpx;
  border: none;
  color: #0A0E27;
  font-size: 28rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
  box-shadow: 0 0 20rpx rgba(0, 255, 136, 0.4);
  transition: all 0.3s ease;
}

.btn-confirm:active {
  transform: scale(0.95);
  box-shadow: 0 0 30rpx rgba(0, 255, 136, 0.6);
}

/* ═══ 每日拍照对比卡片 ═══ */
.daily-compare-card {
  background: linear-gradient(135deg, rgba(0,229,255,0.08) 0%, rgba(176,0,255,0.04) 100%);
  border-color: rgba(0,229,255,0.25);
  box-shadow: 
    0 0 20rpx rgba(0, 229, 255, 0.15),
    inset 0 0 1rpx rgba(0, 229, 255, 0.1);
}

.compare-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.compare-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  background: rgba(8, 12, 20, 0.6);
  border-radius: 9rpx;
  padding: 18rpx;
  border: 1rpx solid rgba(0, 229, 255, 0.1);
}

.compare-label {
  font-size: 24rpx;
  color: #5C708A;
  font-weight: 600;
}

.compare-number {
  font-size: 72rpx;
  font-weight: 900;
  font-family: 'Courier New', monospace;
  line-height: 1;
  text-shadow: 0 0 15rpx rgba(0, 229, 255, 0.3);
}

.compare-number.expected {
  color: #FF9500;
  text-shadow: 0 0 15rpx rgba(255, 149, 0, 0.4);
}

.compare-number.detected {
  color: #00E5FF;
  text-shadow: 0 0 15rpx rgba(0, 229, 255, 0.5);
}

.compare-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #B000FF;
  font-weight: 900;
  text-shadow: 0 0 10rpx rgba(176, 0, 255, 0.4);
  letter-spacing: 3rpx;
}

.compare-result {
  padding: 16rpx;
  border-radius: 9rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.6;
}

.result-match {
  background: rgba(0, 255, 136, 0.08);
  border: 1rpx solid rgba(0, 255, 136, 0.2);
  color: #00FF88;
  box-shadow: 0 0 15rpx rgba(0, 255, 136, 0.15);
}

.result-match .result-text {
  color: #00FF88;
  text-shadow: 0 0 10rpx rgba(0, 255, 136, 0.4);
}

.result-excess,
.result-deficit {
  background: rgba(255, 183, 77, 0.08);
  border: 1rpx solid rgba(255, 183, 77, 0.2);
  color: #FFB74D;
  box-shadow: 0 0 15rpx rgba(255, 183, 77, 0.1);
}

.result-excess .result-text,
.result-deficit .result-text {
  color: #FFB74D;
  text-shadow: 0 0 10rpx rgba(255, 183, 77, 0.3);
}
</style>
