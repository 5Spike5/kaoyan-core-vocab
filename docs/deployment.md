# 部署指南

本项目采用 **GitHub（代码）+ Vercel（前端托管）+ Supabase（认证与用户数据）** 的架构。用户数据只存放在 Supabase，不进入 GitHub。

## 1. 创建 Supabase 项目

1. 打开 [supabase.com](https://supabase.com) 注册并创建项目（免费额度足够个人使用）。
2. 记下项目 Settings → API 中的两个值：
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `anon public` key（形如 `eyJ...`）

## 2. 应用数据库迁移

仓库中已包含 `supabase/migrations/` 下的 SQL 文件。两种方式任选：

**方式 A：Supabase CLI（推荐）**

```bash
# 安装 CLI 后登录
supabase login
supabase link --project-ref <你的项目ID>
supabase db push
```

**方式 B：SQL 编辑器**

在 Supabase Dashboard → SQL Editor 中依次执行：

1. `supabase/migrations/202608210001_initial_schema.sql`
2. `supabase/migrations/202608210002_rls_policies.sql`
3. `supabase/migrations/202608210003_text_ids.sql`（必做：应用使用字符串 ID，需将用户表 `id` 列从 `uuid` 改为 `text`，否则同步会报 400）

执行后确认所有用户表（`profiles`、`user_words`、`review_logs`、`study_sessions`、`user_settings`）均已启用 RLS。

## 3. 配置本地环境变量

复制 `.env.example` 为 `.env` 并填写：

```text
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

> `.env` 已被 .gitignore 忽略，**绝不提交**。前端只能使用 anon public key，service role key 只存在于 Supabase 后台。

## 4. 配置 Supabase Auth 回调

Supabase Dashboard → Authentication → URL Configuration：

- **Site URL**：Vercel 生产地址（如 `https://kaoyan-core-vocab.vercel.app`）
- **Redirect URLs**：
  - `http://localhost:5173/**`（本地开发）
  - Vercel Preview 地址 `https://*.vercel.app/**`
  - 生产地址 `https://kaoyan-core-vocab.vercel.app/**`

建议将邮件确认（Email Confirmations）保持开启。

## 5. 部署到 Vercel

1. 把仓库推送到 GitHub。
2. 在 [vercel.com](https://vercel.com) 点击 Add New → Project，导入该 GitHub 仓库。
3. 在 Project → Settings → Environment Variables 中配置：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Development、Preview、Production 三个环境都配置。
4. Framework Preset 选择 Vite（Vercel 会自动识别），Build Command 保持 `npm run build`。
5. 部署后把生产域名回填到第 4 步的 Supabase Auth 配置中。

每次推送到 `main` 会自动触发 Vercel 部署；GitHub Actions 会同时运行 CI（typecheck + test + build）。

## 6. 词典查询

- 默认使用 [Free Dictionary API](https://dictionaryapi.dev)，**无需任何 key**，前端直接查询。
- 如切换供应商，将 key 存入 Supabase secrets 并在 Edge Function 中代理：

```bash
supabase secrets set DICTIONARY_API_KEY=your-key
supabase functions deploy dictionary-lookup
```

详见 `supabase/functions/dictionary-lookup/README.md`。

## 7. 数据归属规则

| 数据                                            | 存放位置             |
| ----------------------------------------------- | -------------------- |
| 公开词库、真题句子、前端代码、SQL 迁移          | GitHub（公开仓库）   |
| 用户账号、生词、FSRS 状态、复习日志、会话、设置 | Supabase（RLS 隔离） |
| 离线副本、同步队列、词典缓存                    | 浏览器 IndexedDB     |

## 8. 上线前安全检查

- [ ] 旧版 `index.html` 中的 GitHub Token 已撤销（历史版本中的 token 视为已泄露）。
- [ ] 源码中没有 `service_role`、`DICTIONARY_API_KEY` 等真实密钥（CI 会扫描）。
- [ ] `.env` 不在 Git 中。
- [ ] RLS 策略已对全部用户表生效。
- [ ] 登录后开两个浏览器验证生词与复习状态一致。

## 9. 本地模式

未配置 `.env` 时应用自动进入**本地模式**：所有数据保存在浏览器 IndexedDB，查词只使用本地词库与真题语料。配置并登录后，同一浏览器中的本地数据会合并到云端账号。
