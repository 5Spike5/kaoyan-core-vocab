# 研词 Core · 考研英语词汇系统

基于 **FSRS-6 间隔重复算法**的考研英语词汇学习应用，内置核心词库（约 1,400 词条）与 2010–2026 年真题例句语料。支持四选一复习、查词、个人生词库、Excel 导入导出、邮箱登录与云端同步。

## 功能

- **四选一复习**：新词学习与到期复习均为四选一释义题，支持 `1-4` 选择、`Enter` 继续、`Esc` 退出，错词自动重试。
- **FSRS-6 调度**：基于 `ts-fsrs` 官方实现，回答后显示下一次复习信息。
- **查词**：输入单词或短语，先展示本地考研语料出现次数与真题例句，再异步补充公共词典（Free Dictionary API，免 key）音标、释义与发音。
- **生词库**：查词结果一键加入；支持搜索、状态筛选、Excel 导入与导出（SheetJS）。
- **学习统计**：今日学习时长、正确率、词库状态分布、最近 7 天活动。
- **账号与云同步**：邮箱注册/登录/密码重置（Supabase Auth）；离线队列 + 云端合并，断网可学、恢复自动同步。
- **旧版数据迁移**：自动识别旧版 localStorage/IndexedDB 数据并导入新结构。

## 技术栈

React 19 · Vite · TypeScript · React Router · TanStack Query · Zod · Dexie (IndexedDB) · ts-fsrs · Supabase · SheetJS · Vitest

## 本地开发

```bash
npm install
npm run dev          # 启动开发服务器 http://localhost:5173
npm test             # 运行测试
npm run typecheck    # 类型检查
npm run build        # 生产构建（输出 dist/）
```

不配置任何环境变量即可使用：应用以**本地模式**运行，数据保存在浏览器 IndexedDB。

## 启用云同步（Supabase）

1. 在 [supabase.com](https://supabase.com) 创建项目。
2. 执行 `supabase/migrations/` 下两个 SQL 文件（Dashboard → SQL Editor，或 `supabase db push`）。
3. 复制 `.env.example` 为 `.env`，填入 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`。
4. 配置 Supabase Auth 的 Site URL 与 Redirect URLs（本地、预览、生产）。
5. 重新启动应用，进入"设置"页或侧边栏"登录"即可注册/登录。

详细步骤见 [docs/deployment.md](docs/deployment.md)。

## 部署到 GitHub + Vercel

1. 将本仓库推送到你的 GitHub（用户数据不会进入仓库）。
2. 在 Vercel 导入仓库，配置 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY` 环境变量。
3. 推送 `main` 自动部署；GitHub Actions 自动执行 typecheck / test / build。

## 数据归属

- **GitHub（公开）**：核心词库、真题语料、前端代码、SQL 迁移。
- **Supabase（用户私有，RLS 隔离）**：账号、个人生词、FSRS 状态、复习日志、学习会话、设置。
- **浏览器 IndexedDB**：离线副本、待同步队列、词典缓存。

## 安全须知

- 绝不提交 `.env`、本地导出文件或任何密钥。
- 前端只使用 Supabase anon public key；service role key 与词典供应商 key 只放服务端。
- 历史版本 `index.html` 中暴露过的 GitHub Token 已视为泄露，请前往 GitHub 撤销。
- 旧版页面保留在 `legacy-index.html` / `index.html`，仅作数据备份，不参与构建。

## 从旧版迁移

旧版（单文件 `index.html`）的学习进度存储在 localStorage 与 IndexedDB 中。新版首次启动会自动识别并迁移生词、复习状态与学习会话；旧数据保留，可在设置页手动清理。

## 测试

```bash
npm test
```

覆盖：词条规范化、FSRS 包装、真题语料检索、查词合并、Excel 导入导出、本地仓库、旧数据迁移、同步队列与合并规则、认证输入校验、页面组件、端到端本地学习流程。
