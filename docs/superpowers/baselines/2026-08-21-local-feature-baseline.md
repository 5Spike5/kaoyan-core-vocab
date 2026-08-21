# Legacy Local Feature Baseline

- `index.html` opens as a browser page without a build step.
- Login is a local username marker, not remote authentication.
- New-word learning uses four answer options.
- Review uses FSRS-6 through `ts-fsrs@5.4.1`.
- Keyboard shortcuts: `1-4` select, `Enter` continues, `Escape` exits.
- In-progress sessions are persisted and can be resumed.
- `data.js` contains the checked-in public vocabulary.
- `sentences.js` contains the checked-in exam sentences and translations.
- Excel import and export are available through SheetJS.
- User progress is stored in localStorage and IndexedDB.
- Browser-side GitHub repository access is removed before the rewrite.

## 新应用对照（2026-08-21 重构后）

| 旧版行为 | 状态 | 新应用中的实现 | 验证 |
| --- | --- | --- | --- |
| 页面无需构建直接打开 | intentionally changed | Vite + React 构建应用，`npm run dev` / `npm run build` | `npm run build` 成功 |
| 登录为本地用户名标记 | intentionally changed | Supabase 邮箱密码认证（本地模式保留匿名学习） | `tests/features/auth/auth-service.test.ts` |
| 新词学习四选一 | migrated | `ReviewPage` 四选一释义题 | `tests/features/review/review-page.test.tsx`、`tests/e2e/local-flow.test.tsx` |
| FSRS-6（ts-fsrs@5.4.1） | preserved | `src/lib/fsrs.ts` 官方调度器包装 | `tests/lib/fsrs.test.ts` |
| 快捷键 1-4 / Enter / Escape | migrated | `useReviewKeyboard` hook | `tests/features/review/review-page.test.tsx` |
| 会话持久化与恢复 | migrated | Dexie `studySessions` + `ReviewPage.persistSession` | `tests/repositories/local-repository.test.ts` |
| `data.js` 公开词库 | migrated | `src/data/publicVocab.ts`（约 1,398 词条） | `tests/data/public-vocab.test.ts` |
| `sentences.js` 真题句子 | migrated | `src/data/examExamples.ts` + `corpusIndex` 检索 | `tests/data/corpus-index.test.ts`、`tests/features/lookup/lookup-service.test.ts` |
| Excel 导入导出（SheetJS） | preserved | `src/lib/csv.ts`（导出列：单词/词性/释义/状态/下次复习时间/笔记/标签） | `tests/lib/csv.test.ts` |
| 进度存 localStorage/IndexedDB | migrated | Dexie repository + `migrateLegacyData` 旧数据迁移 | `tests/migrations/legacy-storage.test.ts`、`tests/repositories/local-repository.test.ts` |
| 浏览器端 GitHub 直写 | intentionally changed | 已移除；部署走 GitHub → Vercel，用户数据入 Supabase | `tests/security/no-client-secrets.test.ts` |
