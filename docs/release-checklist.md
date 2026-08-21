# Release Checklist

上线前逐项确认：

## 代码与构建

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] 工作区无未提交的意外改动（`git status --short` 干净）

## Supabase

- [ ] `supabase/migrations/` 两个 SQL 已执行（`supabase db push` 或 SQL Editor）
- [ ] `profiles`、`user_words`、`review_logs`、`study_sessions`、`user_settings` 均启用 RLS
- [ ] Auth 配置：Site URL = 生产域名
- [ ] Redirect URLs 包含 `http://localhost:5173/**`、Vercel Preview、生产域名
- [ ] 邮件确认策略符合预期（建议开启）
- [ ] 词典 Edge Function 已部署（如切换供应商）：`supabase functions deploy dictionary-lookup`

## Vercel

- [ ] `VITE_SUPABASE_URL` 已配置（Development / Preview / Production）
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` 已配置（Development / Preview / Production）
- [ ] 仓库已连接 Vercel，推送 `main` 自动部署

## 安全

- [ ] 旧版 `index.html` 中泄露的 GitHub Token 已在 GitHub 撤销
- [ ] 源码无 `service_role`、词典供应商 key 等真实密钥（CI 自动扫描）
- [ ] `.env`、本地导出文件未被 Git 跟踪
- [ ] 词典供应商 key 只存在于 Supabase secrets

## 浏览器验收

- [ ] 未登录本地模式：复习、查词、生词库、统计、导出均可用
- [ ] 注册 → 邮件确认 → 登录 → 退出流程
- [ ] 两个浏览器登录同一账号，生词与复习状态一致（云同步）
- [ ] 断网完成复习，恢复网络后同步成功（设置页"立即同步"）
- [ ] 查词显示本地语料次数与例句；词典不可用时本地结果仍显示
- [ ] 查词结果加入生词库后出现在待学习列表
- [ ] 手机宽度下复习选项不溢出、导航可操作
- [ ] 旧版浏览器数据迁移成功且迁移报告可读
