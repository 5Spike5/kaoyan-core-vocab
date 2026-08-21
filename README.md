# 研词 Core · 考研英语词汇系统

基于 **FSRS-6 间隔重复算法**的考研英语词汇学习应用。

内置核心词库（约 1,400 词条）与 2010–2026 年真题例句语料，支持新词学习、到期复习、查词、个人生词库、Excel 导入导出、邮箱登录与自动云同步。

> 技术栈：React 19 · Vite · TypeScript · React Router · TanStack Query · Dexie (IndexedDB) · ts-fsrs · Supabase · SheetJS · Vitest

---

## 功能一览

- **今日背诵（学新词）**：从核心词库 + 个人生词中取每日目标量（默认 80 词），每个词连问 **3 遍**（第 1 遍英→中、第 2 遍中→英、第 3 遍英→中），答完自动朗读发音。无需手动评分，学完自动按 FSRS 安排复习。
- **强制复习**：所有到期单词，只出英→中释义题，答完用 Again / Hard / Good / Easy 评分（对应 1分钟 / 10分钟 / 1天 / 4天）。
- **自主复习**：从已学单词中随机抽 20 个自测，同样带 FSRS 评分。
- **FSRS-6 调度**：官方 `ts-fsrs` 实现，每次评分后更新稳定性 / 难度 / 下次复习时间，稳定性 ≥ 21 天自动标记"已掌握"。
- **学习进度写回**：每次答题的评分、单词状态、复习日志都会写入本地并自动同步到云端。
- **查词**：输入单词或短语，先展示本地考研语料出现次数与真题例句，再异步补充公共词典（Free Dictionary API，免 key）的音标、释义与发音。
- **生词库**：查词一键加入；支持搜索、状态筛选、Excel 拖拽导入（带预览）、导出。
- **统计**：今日/累计学习时长、正确率、词库状态分布、最近 7 天活动。
- **账号与云同步**：邮箱注册/登录/密码重置；本地优先 + 增量同步，断网可学，登录 / 启动 / 学完自动同步。
- **发音（TTS）**：浏览器语音合成朗读单词，失败自动回退在线发音。

---

## 快速开始（本地运行）

```bash
npm install
npm run dev          # 开发服务器 http://localhost:5173
npm test             # 运行测试
npm run typecheck    # 类型检查
npm run build        # 生产构建（输出 dist/）
```

**不配置任何环境变量也能用**：应用以**本地模式**运行，所有数据保存在浏览器 IndexedDB 中。

---

## 页面与操作说明

| 页面                 | 说明                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **今日学习（首页）** | 个人资料名片、每日目标（60/80/100/120 可调）、三种学习模式入口、今日概览、学习进度、学习时长、词库管理             |
| **学习页**           | 顶部显示进度 / 计时 / 模式；大字单词卡（音标 + 发音按钮）；四选一答题；答后显示对错、真题例句（可展开）、FSRS 评分 |
| **完成页**           | 正确 / 错误 / 总数、正确率、本次 / 今日 / 累计时长；学完自动同步云端                                               |
| **查词**             | 输入英文单词或短语，查看本地语料统计、真题例句、公共词典释义与音标                                                 |
| **生词库**           | 搜索、按状态筛选、Excel 导入（拖放 + 预览 + 确认）、导出                                                           |
| **统计**             | 学习时长、正确率、词库状态分布、7 天活动柱状图                                                                     |
| **设置**             | 当前模式（本地 / 云同步）、立即同步、数据导出（JSON）、清理本地缓存、退出登录                                      |

### 键盘快捷键（学习页）

| 按键              | 功能          |
| ----------------- | ------------- |
| `1`–`4` / `A`–`D` | 选择答案      |
| `Enter` / `Space` | 下一题 / 继续 |
| `Esc`             | 退出学习      |

---

## 启用云同步（Supabase）

数据不会默认上云；想多设备同步、防清浏览器丢数据，按以下步骤配置：

### 1. 创建 Supabase 项目

在 [supabase.com](https://supabase.com) 免费创建项目，进入 **Settings → API** 记下：

- `Project URL`（形如 `https://xxxx.supabase.co`）
- `anon public` key（形如 `eyJ...`）

> ⚠️ 只使用 anon public key。`service_role` key 权限过大，绝不能放进前端或仓库。

### 2. 执行数据库迁移

在 Supabase Dashboard → **SQL Editor** 中**依次**执行以下三个文件（或本地 `supabase db push`）：

1. `supabase/migrations/202608210001_initial_schema.sql` — 建表
2. `supabase/migrations/202608210002_rls_policies.sql` — 行级安全策略
3. `supabase/migrations/202608210003_text_ids.sql` — **必做**：应用使用字符串 ID，需把用户表 `id` 列从 `uuid` 改为 `text`，否则同步会报 400

### 3. 配置本地环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```text
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

`.env` 已被 `.gitignore` 忽略，**不会提交到仓库**。改完**重启** `npm run dev`。

### 4. 配置 Auth 回调地址

Supabase Dashboard → **Authentication → URL Configuration**：

- **Site URL**：`http://localhost:5173`（本地）或正式域名
- **Redirect URLs**：`http://localhost:5173/**`，以及生产环境地址

否则注册确认邮件里的链接会跳不回来。

### 5. 登录并验证

重启应用 → 设置页会从"本地模式"变为"云同步模式" → 注册账号 → 登录 → 登录成功会自动同步一次本地数据。

---

## 数据与同步架构

应用采用**本地优先（local-first）**设计：

```text
学习操作（每天使用）
   ↓ 即时写入
浏览器 IndexedDB（离线副本，读写快）
   ↓ 增量上传 + 拉取合并
Supabase（账号下的数据副本，RLS 隔离）
```

- 学习永远先写**本地**，因此断网也能学、响应快。
- 云端是**备份 + 多端同步**的副本。
- 同步是**增量**的：只上传上次同步后有变化的数据（单词按 `updatedAt`、日志按 `reviewedAt`），20 条一批并发上传。

### 自动同步时机

| 时机               | 说明             |
| ------------------ | ---------------- |
| 登录 / 注册成功    | 自动同步 + 提示  |
| 打开应用（已登录） | 自动同步（静默） |
| 学完一组学习       | 自动同步 + 提示  |
| 设置页"立即同步"   | 手动全量确认     |

未配置 Supabase 或未登录时自动跳过，不影响使用。

### 数据归属

| 数据                                      | 存放位置             |
| ----------------------------------------- | -------------------- |
| 核心词库、真题语料、前端代码、SQL 迁移    | GitHub（公开仓库）   |
| 账号、个人生词、FSRS 状态、复习日志、会话 | Supabase（RLS 隔离） |
| 离线副本、同步队列、词典缓存              | 浏览器 IndexedDB     |

---

## 部署

### 方案 A：Vercel（推荐）

1. 推送到 GitHub 后，在 [vercel.com](https://vercel.com) 导入仓库。
2. 在 **Settings → Environment Variables** 配置 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`（Development / Preview / Production 都配）。
3. 部署后把正式域名回填到 Supabase Auth 的 Site URL / Redirect URLs。
4. 推送 `main` 自动部署；GitHub Actions 自动跑 typecheck / test / build。

### 方案 B：GitHub Pages（已内置部署配置）

仓库已包含 `.github/workflows/pages.yml`，构建时会自动设置子路径 `base`、生成 SPA 回退页（`404.html`）并部署。只需三步：

1. **配置环境变量**：仓库 **Settings → Secrets and variables → Actions** 新建两个 repository variable：`VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`（不配则站点以本地模式运行，朋友无法注册登录）。
2. **开启 Pages**：仓库 **Settings → Pages → Source 选择 GitHub Actions**。
3. **触发部署**：推送到 `main` 自动部署（或 Actions 页手动 Run workflow）。

部署地址：`https://<你的用户名>.github.io/kaoyan-core-vocab/`，部署后把该地址填入 Supabase Auth 的 Site URL / Redirect URLs。

---

## 常见问题（FAQ）

### 登录报 400（`Email not confirmed`）

注册后还没点确认邮件里的链接。去邮箱确认；或 Supabase → Authentication → Providers → Email 关闭 "Confirm email"（不推荐生产环境）。

### 登录报 400（`Invalid login credentials`）

账号不存在或密码错误，先注册再登录。

### 点"立即同步"报 400

大概率没执行 `202608210003_text_ids.sql` 迁移（id 类型不匹配）。执行后重试；若仍失败，把报错信息发来排查。

### 数据存哪？换电脑还有吗？

学习数据默认在**本机浏览器**（IndexedDB）。登录 Supabase 并同步后，换设备/清缓存可点"立即同步"恢复。

### 没有发音？

发音使用浏览器 TTS，需联网加载语音包；失败会自动回退在线发音。部分浏览器需先点一下页面再触发。

---

## 安全须知

- 绝不提交 `.env` 或任何密钥。
- 前端只使用 Supabase anon public key。
- 旧版 `legacy-index.html` 曾含 GitHub Token（已视为泄露并撤销），保留仅作数据备份，不参与构建。

---

## 测试

```bash
npm test
```

覆盖：词条规范化、FSRS 包装与状态推导、答题选项、评分写回、真题语料检索、查词合并、Excel 导入导出、本地仓库、旧数据迁移、同步合并与增量上传、认证校验、页面组件、端到端本地学习流程。

---

## 相关文档

- [部署指南（详细）](docs/deployment.md)
- [发布检查清单](docs/release-checklist.md)
