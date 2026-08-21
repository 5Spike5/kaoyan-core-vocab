import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let sharedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function createSupabaseClient(): SupabaseClient {
  if (sharedClient) {
    return sharedClient;
  }

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
    string | undefined;

  if (!url || !key) {
    throw new Error(
      "Supabase 未配置：请在 .env 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  sharedClient = createClient(url, key);
  return sharedClient;
}
