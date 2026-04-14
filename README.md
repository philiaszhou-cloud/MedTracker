# Medtracker

Medtracker 是一个基于 uni-app + Vue 3 + TypeScript + Pinia 的多端用药管理应用，面向按时服药、库存跟踪、药片拍照记录和本地提醒场景。

## 核心功能

- 药品管理：新增、编辑、删除、启停药品
- 用药提醒：本地通知、闹钟提醒、提醒时间配置
- 每日服药跟踪：首页显示今日完成度和未服药提醒
- 药品照片：药盒图、药片图拍摄与相册选取
- 每日拍照记录：拍照识别药片数量并做日常校验
- 库存管理：低库存预警、补充库存、品牌变更后强制重拍照片
- 多端支持：H5、Android App，以及 uni-app 支持的其他平台

## 技术栈

- uni-app
- Vue 3
- TypeScript
- Pinia
- Vite

## 本地开发

安装依赖：

```bash
npm install
```

启动 H5：

```bash
npm run dev:h5
```

构建 H5：

```bash
npm run build:h5
```

构建 Android App：

```bash
npm run build:app-android
```

类型检查：

```bash
npm run type-check
```

## 项目结构

```text
src/
  pages/           页面
  stores/          Pinia 状态管理
  utils/           图片持久化、通知、识别等工具
  types/           类型定义
static/            静态资源
tools/             构建与素材处理脚本
```

## 文档入口

- [START_HERE.md](START_HERE.md)：项目总入口
- [README_DOCS.md](README_DOCS.md)：文档索引
- [QUICK_TEST_GUIDE.md](QUICK_TEST_GUIDE.md)：快速测试指南
- [PRE_RELEASE_CHECKLIST.md](PRE_RELEASE_CHECKLIST.md)：发布前检查清单
- [TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md)：常见问题排查

## 当前状态

当前版本已包含以下关键能力与修复：

- APP 与 H5 的药品图片持久化修复
- 首页未服药显著提醒
- 品牌字段与补库存分流逻辑
- Tab 图标资源更新
- 本地提醒 / 通知链路优化

## 上传 GitHub 前说明

- `node_modules/`、`dist/`、`unpackage/`、`.hbuilderx/` 已加入忽略规则
- 仓库建议只提交源码、静态资源、必要文档和锁文件
- 如果需要推送到 GitHub，需要可用的远程仓库地址和本机认证能力