<template>
  <view class="cyberpunk-demo">
    <!-- 标题 -->
    <view class="demo-header">
      <text class="demo-title">⚡ CYBERPUNK 2077</text>
      <text class="demo-subtitle">Medtracker Theme Preview</text>
    </view>

    <!-- 颜色展示 -->
    <view class="card">
      <text class="card-title">🎨 霓虹色板</text>
      <view class="color-grid">
        <view class="color-box">
          <view class="color-swatch" style="background: #00D9FF;"></view>
          <text class="color-label">NEON BLUE</text>
        </view>
        <view class="color-box">
          <view class="color-swatch" style="background: #FF006E;"></view>
          <text class="color-label">NEON PINK</text>
        </view>
        <view class="color-box">
          <view class="color-swatch" style="background: #8F00FF;"></view>
          <text class="color-label">NEON PURPLE</text>
        </view>
        <view class="color-box">
          <view class="color-swatch" style="background: #FFFF00;"></view>
          <text class="color-label">NEON YELLOW</text>
        </view>
        <view class="color-box">
          <view class="color-swatch" style="background: #00FF41;"></view>
          <text class="color-label">NEON GREEN</text>
        </view>
        <view class="color-box">
          <view class="color-swatch" style="background: #FF6B00;"></view>
          <text class="color-label">NEON ORANGE</text>
        </view>
      </view>
    </view>

    <!-- 按钮展示 -->
    <view class="card">
      <text class="card-title">🔲 按钮系统</text>
      <button class="btn-primary">Primary Button</button>
      <button class="btn-secondary" style="margin-top: 12rpx;">Secondary Button</button>
      <button class="btn-success" style="margin-top: 12rpx;">Success Button</button>
      <button class="btn-danger" style="margin-top: 12rpx;">Danger Button</button>
    </view>

    <!-- 标签展示 -->
    <view class="card">
      <text class="card-title">🏷️ 标签和徽章</text>
      <view style="margin-bottom: 16rpx;">
        <text class="tag tag-blue">TAG BLUE</text>
        <text class="tag tag-pink">TAG PINK</text>
        <text class="tag tag-purple">TAG PURPLE</text>
      </view>
      <view style="margin-bottom: 16rpx;">
        <text class="tag tag-green">TAG GREEN</text>
        <text class="tag tag-orange">TAG ORANGE</text>
      </view>
      <view style="margin-top: 16rpx;">
        <text class="badge">99+</text>
      </view>
    </view>

    <!-- 文字样式 -->
    <view class="card">
      <text class="card-title">✍️ 文字样式</text>
      <text class="text-neon-blue">蓝色霓虹文本</text>
      <text class="text-neon-pink" style="display: block; margin-top: 10rpx;">粉色霓虹文本</text>
      <text class="text-neon-purple" style="display: block; margin-top: 10rpx;">紫色霓虹文本</text>
      <text class="text-neon-green" style="display: block; margin-top: 10rpx;">绿色霓虹文本</text>
    </view>

    <!-- 输入框 -->
    <view class="card">
      <text class="card-title">⌨️ 表单元素</text>
      <view class="form-group">
        <label class="form-label">Username</label>
        <input class="form-input" type="text" placeholder="Enter your username..." />
      </view>
      <view class="form-group">
        <label class="form-label">Password</label>
        <input class="form-input" type="password" placeholder="Enter your password..." />
      </view>
    </view>

    <!-- 药品卡片示例 -->
    <view class="card">
      <text class="card-title">💊 药品卡片</text>
      <view class="med-card">
        <view class="med-header">
          <text class="med-name">感冒灵</text>
          <text class="med-dose">1粒</text>
        </view>
        <view class="med-info">
          <text class="med-specs">规格：0.5g × 12粒</text>
          <text class="med-stock">库存：8粒</text>
        </view>
        <view class="med-actions">
          <button class="btn-primary" style="flex: 1; margin-right: 10rpx;">服用</button>
          <button class="btn-secondary" style="flex: 1;">详情</button>
        </view>
      </view>
    </view>

    <!-- 说明 -->
    <view class="card" style="background: rgba(143, 0, 255, 0.1); border-color: #8F00FF;">
      <text class="card-title" style="color: #8F00FF;">🎮 关于赛博朋克</text>
      <text style="color: #B0B8D4; line-height: 1.8;">
        此设计灵感来自游戏《赛博朋克 2077》，采用高对比度的霓虹色+ 深色背景，搭配玻璃拟态、扫描线效果和动画过渡，营造未来科技感。
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";

onLoad(() => {
  console.log("🎮 Cyberpunk 2077 Design Preview Loaded");
});
</script>

<style scoped>
.cyberpunk-demo {
  padding: 20rpx;
  min-height: 100vh;
}

.demo-header {
  text-align: center;
  padding: 40rpx 0;
  border-bottom: 2rpx solid rgba(0, 217, 255, 0.2);
  margin-bottom: 30rpx;
}

.demo-title {
  display: block;
  font-size: 64rpx;
  font-weight: 900;
  color: #00D9FF;
  text-shadow: 0 0 20px rgba(0, 217, 255, 0.6);
  letter-spacing: 3rpx;
  text-transform: uppercase;
  font-family: 'Courier New', monospace;
}

.demo-subtitle {
  display: block;
  font-size: 24rpx;
  color: #FF006E;
  margin-top: 10rpx;
  letter-spacing: 2rpx;
  text-transform: uppercase;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 15px rgba(255, 0, 110, 0.4);
}

/* 颜色网格 */
.color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.color-box {
  flex: 1;
  min-width: 45%;
  text-align: center;
}

.color-swatch {
  height: 80rpx;
  border-radius: 12rpx;
  margin-bottom: 8rpx;
  box-shadow: 0 0 20px rgba(0, 217, 255, 0.3);
  border: 2rpx solid rgba(255, 255, 255, 0.1);
}

.color-label {
  color: #B0B8D4;
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  font-family: 'Courier New', monospace;
}

/* 药品卡片 */
.med-card {
  background: rgba(30, 45, 90, 0.4);
  border: 2rpx solid rgba(0, 217, 255, 0.2);
  border-radius: 12rpx;
  padding: 16rpx;
  margin-top: 12rpx;
}

.med-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.med-name {
  font-size: 28rpx;
  font-weight: 700;
  color: #00D9FF;
}

.med-dose {
  background: rgba(0, 217, 255, 0.2);
  color: #00D9FF;
  padding: 6rpx 12rpx;
  border-radius: 9rpx;
  border: 1rpx solid #00D9FF;
  font-size: 20rpx;
  font-weight: 700;
}

.med-info {
  margin-bottom: 12rpx;
}

.med-specs,
.med-stock {
  display: block;
  font-size: 20rpx;
  color: #B0B8D4;
  margin-top: 4rpx;
}

.med-actions {
  display: flex;
  gap: 10rpx;
}

.med-actions button {
  margin: 0 !important;
  padding: 12rpx 16rpx !important;
  font-size: 22rpx !important;
}

/* 表单组 */
.form-group {
  margin-bottom: 20rpx;
}

.form-group:last-child {
  margin-bottom: 0;
}
</style>
