import { useEffect } from "react";
import AppShell from "../components/AppShell";
import { restoreSession } from "../features/auth/authService";
import { runAutoCloudSync } from "../repositories/cloudSync";
import { AppProviders } from "./providers";
import { AppRoutes } from "./router";
import "../styles/tokens.css";
import "../styles/globals.css";

export default function App() {
  useEffect(() => {
    void restoreSession().then((user) => {
      // 启动时恢复会话：已登录则自动同步一次云端数据
      if (user) {
        void runAutoCloudSync().catch(() => {
          // 同步失败不阻塞使用，可在设置页手动重试
        });
      }
    });
  }, []);

  return (
    <AppProviders>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </AppProviders>
  );
}
