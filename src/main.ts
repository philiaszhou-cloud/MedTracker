import { createSSRApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";

export function createApp() {
  const app = createSSRApp(App);
  const pinia = createPinia();
  app.use(pinia);

  // ★ v14: 全局错误兜底 — 防止未捕获异常导致白屏/死锁
  app.config.errorHandler = (err, vm, info) => {
    console.error('[Global Error]', err, info);
    // 可扩展：上报到错误监控服务
  };

  return {
    app,
  };
}
