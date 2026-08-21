import { toast } from "../components/Toast";
import { getCurrentUser } from "../features/auth/authService";
import { createLocalDb } from "./localDb";
import { createSupabaseClient, isSupabaseConfigured } from "./supabaseClient";
import { createSupabaseRepository } from "./supabaseRepository";
import { syncLocalToCloud } from "./syncService";

const LAST_SYNC_KEY = "kaoyan-last-sync-at";

export { LAST_SYNC_KEY };

/**
 * 自动同步：把本地学习进度上传到当前登录账号的云端，并拉取合并云端数据。
 * 适用于登录成功、应用启动恢复会话、学习完成后等时机。
 * - 未配置 Supabase 或未登录时返回 null（不做任何事）
 * - 失败时抛出异常，由调用方决定是否提示
 */
export async function runAutoCloudSync(
  options: { notify?: boolean } = {},
): Promise<{
  uploaded: number;
  merged: number;
} | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const user = getCurrentUser();
  if (!user) {
    return null;
  }

  const lastSyncAt = Number(localStorage.getItem(LAST_SYNC_KEY)) || null;
  const db = createLocalDb();
  try {
    const client = createSupabaseClient();
    const remote = createSupabaseRepository(client);
    const result = await syncLocalToCloud(db, remote, user.id, lastSyncAt);
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));

    if (options.notify) {
      toast(
        result.uploaded > 0
          ? `已同步 ${result.uploaded} 条更新`
          : "已同步，暂无本地更新",
        "success",
      );
    }
    return result;
  } finally {
    db.close();
  }
}
