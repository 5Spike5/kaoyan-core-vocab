import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { initTheme } from "./lib/theme";

// GitHub Pages 部署在子路径（如 /kaoyan-core-vocab/）时，basename 跟随 Vite base；
// 根域名部署（Vercel）时 basename 为空。
const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

initTheme();

// 注册 service worker（仅生产构建）：静态资源与页面壳离线可缓存
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        // 注册失败（如不支持子路径 scope）时静默降级为普通网页
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
