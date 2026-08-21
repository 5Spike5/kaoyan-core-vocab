# 考研英语核心词重构 Implementation Plan

> **实施状态（2026-08-21 更新）：** Task 1–5 与 Task 6–11 已实现并提交（分支 `codex/rebuild-react-supabase`，commit 见 `git log`）。Task 6/9 中的真实浏览器验证与 Task 8 的 `supabase db reset` 依赖 Supabase 项目配置，待用户按 `docs/deployment.md` 建好项目后补充；Task 12 的代码审查由用户集成前进行。测试共 42 个全部通过，`npm run build` 成功。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前单文件考研词汇网页重构为 React + Vite + TypeScript 应用，在保留四选一复习和 FSRS-6 的基础上，增加本地数据迁移、邮箱登录、Supabase 云同步、查词、考研语料统计和 GitHub/Vercel 部署能力。

**Architecture:** 先建立可独立运行的 React 本地模式，公开词库和真题语料仍作为构建时数据导入，用户进度通过本地 repository 保存。之后用 Supabase repository 实现认证和云端数据同步，用本地操作队列支持离线使用；词典查询通过可替换的 provider 和 Edge Function 代理接入，避免第三方 API 绑死 UI。

**Tech Stack:** React 19, Vite, TypeScript, React Router, TanStack Query, React Hook Form, Zod, Dexie, Vitest, Testing Library, ts-fsrs 5.4.x, Supabase JS, Supabase Edge Functions, Lucide React, Vercel, GitHub Actions.

---

## 文件结构总览

实施完成后，项目文件按以下职责组织：

```text
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
  components/
    AppShell.tsx
    BottomNav.tsx
    EmptyState.tsx
    LoadingState.tsx
    SyncStatus.tsx
    WordAudioButton.tsx
  features/
    auth/
      AuthPage.tsx
      authService.ts
      authTypes.ts
    dashboard/
      DashboardPage.tsx
      dashboardSelectors.ts
    lookup/
      LookupPage.tsx
      lookupService.ts
      lookupTypes.ts
    review/
      ReviewPage.tsx
      reviewService.ts
      reviewTypes.ts
    vocab/
      VocabListPage.tsx
      vocabService.ts
      vocabTypes.ts
    corpus/
      CorpusPage.tsx
    stats/
      StatsPage.tsx
    settings/
      SettingsPage.tsx
  data/
    publicVocab.ts
    examExamples.ts
    examSenseOccurrences.ts
    corpusIndex.ts
  lib/
    date.ts
    normalizeTerm.ts
    result.ts
    fsrs.ts
    csv.ts
  repositories/
    repositoryTypes.ts
    localDb.ts
    localRepository.ts
    supabaseClient.ts
    supabaseRepository.ts
    syncQueue.ts
    syncService.ts
  migrations/
    legacyStorage.ts
    migrateLegacyData.ts
  styles/
    tokens.css
    globals.css
    shell.css
    pages.css
  types/
    domain.ts
  main.tsx
tests/
  setup.ts
  lib/
  features/
  repositories/
  migrations/
data/
  vocab/
  exam/
supabase/
  migrations/
  functions/dictionary-lookup/
.github/workflows/ci.yml
.env.example
vite.config.ts
tsconfig.json
package.json
```

`data.js` 和 `sentences.js` 在迁移完成前保留为源数据输入；迁移脚本将它们转换为 `src/data` 可导入的结构。原始文件不删除，避免丢失已有资料。

## Fork 工作流

- `origin` 是用户 fork：`https://github.com/5Spike5/kaoyan-core-vocab.git`。
- `upstream` 是原作者仓库：`https://github.com/SOGOOD-ONE/kaoyan-core-vocab.git`。
- 本地已将 `upstream` 的 push URL 设置为 `DISABLED`，避免误推原作者仓库。
- 所有重构提交落在 `codex/rebuild-react-supabase`。
- 默认只推送到 `origin`，不直接向 `upstream` 推送。
- 需要同步原作者更新时，先执行 `git fetch upstream`，再在当前重构分支上人工合并或变基并解决冲突。

### Task 1: 建立安全基线、备份和重构分支

**Files:**
- Modify: `index.html:3057-3088`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docs/superpowers/baselines/2026-08-21-local-feature-baseline.md`
- Test: `tests/security/no-client-secrets.test.ts`

- [x] **Step 1: Write the failing secret-scan test**

Create `tests/security/no-client-secrets.test.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('client secret safety', () => {
  it('does not contain a GitHub personal access token in the legacy page', async () => {
    const html = await readFile(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html).not.toMatch(/ghp_[A-Za-z0-9_]+/)
    expect(html).not.toMatch(/Authorization:\s*`token/)
  })
})
```

- [x] **Step 2: Run the focused test and verify the expected failure**

Run:

```powershell
npx vitest run tests/security/no-client-secrets.test.ts
```

Expected: `FAIL` because the current legacy page contains a hard-coded GitHub token and browser-side GitHub API request.

- [x] **Step 3: Remove the browser-side GitHub write/read code**

Delete the `loadRemoteVocab` function and its invocation from `index.html`. The legacy page must load only its checked-in `data.js` and `sentences.js` data. Do not replace the token with an empty token or a different token.

Add `.gitignore`:

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
.vercel/
.superpowers/
*.local.json
```

Add `.env.example`:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

- [x] **Step 4: Run the security test and verify it passes**

Run:

```powershell
npx vitest run tests/security/no-client-secrets.test.ts
```

Expected: `PASS`.

- [x] **Step 5: Record the legacy behavior baseline**

Create `docs/superpowers/baselines/2026-08-21-local-feature-baseline.md` with the currently observed behaviors:

```markdown
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
```

- [x] **Step 6: Commit the security baseline**

Run:

```powershell
git add index.html .gitignore .env.example docs/superpowers/baselines/2026-08-21-local-feature-baseline.md tests/security/no-client-secrets.test.ts
git commit -m "security: remove browser github credential path"
```

### Task 2: Scaffold the Vite React TypeScript application

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/router.tsx`
- Create: `src/app/providers.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/globals.css`
- Test: `tests/app/app-shell.test.tsx`

- [x] **Step 1: Add the package manifest and scripts**

Create `package.json`:

```json
{
  "name": "kaoyan-core-vocab",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.56.0",
    "@tanstack/react-query": "^5.85.0",
    "clsx": "^2.1.1",
    "dexie": "^4.2.0",
    "lucide-react": "^0.468.0",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "react-hook-form": "^7.62.0",
    "react-router-dom": "^7.8.2",
    "ts-fsrs": "5.4.1",
    "zod": "^4.0.17"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^24.3.0",
    "@types/react": "^19.1.10",
    "@types/react-dom": "^19.1.7",
    "@vitejs/plugin-react": "^5.0.2",
    "eslint": "^9.33.0",
    "jsdom": "^26.1.0",
    "typescript": "~5.9.2",
    "vite": "^7.1.3",
    "vitest": "^3.2.4"
  }
}
```

- [x] **Step 2: Add the Vite and TypeScript configuration**

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    globals: true
  }
})
```

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" }
  ]
}
```

Create `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests"]
}
```

- [x] **Step 3: Write the failing app shell test**

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Create `tests/app/app-shell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../../src/app/App'

describe('app shell', () => {
  it('renders the dashboard navigation and main learning action', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('研词 Core')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '今日学习' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查词' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始今日复习' })).toBeInTheDocument()
  })
})
```

- [x] **Step 4: Run the test and verify it fails because the shell does not exist**

Run:

```powershell
npm install
npx vitest run tests/app/app-shell.test.tsx
```

Expected: `FAIL` with a module-not-found error for `src/app/App`.

- [x] **Step 5: Implement the minimal application shell**

Create `src/app/router.tsx`:

```tsx
import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from '../features/dashboard/DashboardPage'
import LookupPage from '../features/lookup/LookupPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/lookup" element={<LookupPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

Create `src/app/providers.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } }
})

export function AppProviders({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

Create `src/app/App.tsx`:

```tsx
import { NavLink } from 'react-router-dom'
import { AppRoutes } from './router'
import { AppProviders } from './providers'
import '../styles/tokens.css'
import '../styles/globals.css'

export default function App() {
  return (
    <AppProviders>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <strong>研词 Core</strong>
            <span>考研英语词汇系统</span>
          </div>
          <nav aria-label="主导航">
            <NavLink to="/" end>今日学习</NavLink>
            <NavLink to="/lookup">查词</NavLink>
          </nav>
        </aside>
        <main className="app-main"><AppRoutes /></main>
      </div>
    </AppProviders>
  )
}
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter><App /></BrowserRouter>
  </StrictMode>
)
```

Create placeholder pages with real headings:

```tsx
// src/features/dashboard/DashboardPage.tsx
export default function DashboardPage() {
  return (
    <section>
      <p className="eyebrow">TODAY'S STUDY</p>
      <h1>今天，先攻下 24 个词</h1>
      <button type="button">开始今日复习</button>
    </section>
  )
}

// src/features/lookup/LookupPage.tsx
export default function LookupPage() {
  return <section><h1>查词</h1></section>
}
```

Create `index.html` with only the Vite mount point:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>研词 Core</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Add `src/styles/tokens.css` with the approved restrained palette and `src/styles/globals.css` with the shell layout, focus states, responsive breakpoint, and button styles.

- [x] **Step 6: Run the app shell test and build**

Run:

```powershell
npx vitest run tests/app/app-shell.test.tsx
npm run typecheck
npm run build
```

Expected: all commands pass.

- [x] **Step 7: Commit the scaffold**

Run:

```powershell
git add package.json package-lock.json vite.config.ts tsconfig.json tsconfig.app.json index.html src tests/setup.ts tests/app/app-shell.test.tsx
git commit -m "refactor: scaffold react application"
```

### Task 3: Convert the checked-in public vocabulary and exam corpus

**Files:**
- Create: `scripts/convert-legacy-data.mjs`
- Create: `src/types/domain.ts`
- Create: `src/data/publicVocab.ts`
- Create: `src/data/examExamples.ts`
- Create: `src/data/examSenseOccurrences.ts`
- Create: `src/data/corpusIndex.ts`
- Test: `tests/data/public-vocab.test.ts`
- Test: `tests/data/corpus-index.test.ts`

- [x] **Step 1: Define the domain types and write failing data tests**

Create `src/types/domain.ts` with `PublicVocabEntry`, `ExamExample`, `ExamSenseOccurrence`, `WordMeaning`, `UserWord`, `ReviewLog`, and `StudySession` types matching the approved design.

Create `tests/data/public-vocab.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { publicVocab } from '../../src/data/publicVocab'

describe('public vocabulary import', () => {
  it('contains normalized unique terms and preserves the legacy corpus size', () => {
    const keys = publicVocab.map((entry) => entry.key)
    expect(publicVocab.length).toBeGreaterThanOrEqual(1_398)
    expect(new Set(keys).size).toBe(keys.length)
    expect(publicVocab.find((entry) => entry.term === 'address')).toMatchObject({
      normalizedTerm: 'address'
    })
  })
})
```

Create `tests/data/corpus-index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { searchExamCorpus } from '../../src/data/corpusIndex'

describe('exam corpus index', () => {
  it('finds matching examples without requiring a network request', () => {
    const result = searchExamCorpus('address')
    expect(result.totalOccurrences).toBeGreaterThan(0)
    expect(result.examples.length).toBeGreaterThan(0)
    expect(result.examples[0].sentence.toLowerCase()).toContain('address')
  })
})
```

- [x] **Step 2: Run the data tests to verify they fail**

Run:

```powershell
npx vitest run tests/data/public-vocab.test.ts tests/data/corpus-index.test.ts
```

Expected: `FAIL` because the new typed data modules do not exist.

- [x] **Step 3: Implement the conversion script**

Create `scripts/convert-legacy-data.mjs` that:

1. Reads `data.js` and evaluates only the `VOCAB_DATA` declaration in a `vm` context.
2. Reads `sentences.js` and extracts `EXAM_SENTENCES`, `SENTENCE_TRANSLATIONS`, and `WORD_EXAMPLES` declarations.
3. Normalizes terms with lowercase, trimmed whitespace, and collapsed internal spaces.
4. Writes deterministic JSON modules into `src/data`.
5. Leaves unknown sentence metadata optional.

The script must reject malformed declarations rather than writing partial files. Its core conversion API must be exported for testing:

```js
export function normalizeLegacyTerm(term) {
  return term.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function toPublicEntry(raw, index) {
  const term = String(raw.word ?? '').trim()
  if (!term) throw new Error(`Missing word at index ${index}`)
  return {
    key: normalizeLegacyTerm(term),
    term,
    normalizedTerm: normalizeLegacyTerm(term),
    partOfSpeech: raw.type || undefined,
    meanings: raw.meaning ? [{ text: raw.meaning, source: 'curated' }] : [],
    category: raw.category || '核心词',
    source: 'legacy-data.js'
  }
}
```

- [x] **Step 4: Generate the typed data modules and corpus index**

Run:

```powershell
node scripts/convert-legacy-data.mjs
```

Implement `src/data/corpusIndex.ts` with a pre-built normalized list and this API:

```ts
export type CorpusSearchResult = {
  totalOccurrences: number
  exampleCount: number
  examples: ExamExample[]
}

export function searchExamCorpus(term: string): CorpusSearchResult
```

Matching rules:

- Normalize the query.
- Match word boundaries for one-word terms.
- Match normalized phrase substrings for phrases.
- Deduplicate identical sentence IDs.
- Return at most 20 examples for the first result page.

- [x] **Step 5: Run data tests and typecheck**

Run:

```powershell
npx vitest run tests/data/public-vocab.test.ts tests/data/corpus-index.test.ts
npm run typecheck
```

Expected: all pass; the test output must report no duplicate normalized vocabulary keys.

- [x] **Step 6: Commit the public data migration**

Run:

```powershell
git add scripts/convert-legacy-data.mjs src/types/domain.ts src/data tests/data
git commit -m "refactor: type public vocabulary and exam corpus"
```

### Task 4: Extract normalization, FSRS, and local domain services

**Files:**
- Create: `src/lib/normalizeTerm.ts`
- Create: `src/lib/date.ts`
- Create: `src/lib/fsrs.ts`
- Create: `src/features/review/reviewTypes.ts`
- Create: `src/features/review/reviewService.ts`
- Create: `src/features/vocab/vocabService.ts`
- Test: `tests/lib/normalize-term.test.ts`
- Test: `tests/lib/fsrs.test.ts`
- Test: `tests/features/review/review-service.test.ts`
- Test: `tests/features/vocab/vocab-service.test.ts`

- [x] **Step 1: Write failing pure-logic tests**

Create `tests/lib/normalize-term.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeTerm } from '../../src/lib/normalizeTerm'

describe('normalizeTerm', () => {
  it('normalizes case, spaces, and surrounding whitespace', () => {
    expect(normalizeTerm('  Account   For ')).toBe('account for')
    expect(normalizeTerm('BULL-RUN')).toBe('bull-run')
  })
})
```

Create `tests/features/review/review-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildReviewOptions, rateReviewAnswer } from '../../../src/features/review/reviewService'

describe('review service', () => {
  it('creates four options with one correct answer', () => {
    const card = { term: 'address', meaning: '处理，应对' }
    const options = buildReviewOptions(card, [
      { term: 'address', meaning: '处理，应对' },
      { term: 'fetch', meaning: '售得' },
      { term: 'bid', meaning: '出价' },
      { term: 'peak', meaning: '顶峰' }
    ])
    expect(options).toHaveLength(4)
    expect(options.filter((option) => option.isCorrect)).toHaveLength(1)
  })

  it('maps a correct answer to a good FSRS rating', () => {
    expect(rateReviewAnswer({ correct: true, attempts: 1 })).toBe('good')
    expect(rateReviewAnswer({ correct: false, attempts: 1 })).toBe('again')
  })
})
```

- [x] **Step 2: Run the focused tests and verify they fail**

Run:

```powershell
npx vitest run tests/lib/normalize-term.test.ts tests/features/review/review-service.test.ts
```

Expected: `FAIL` because the extracted modules do not exist.

- [x] **Step 3: Implement normalization and FSRS wrappers**

Implement `normalizeTerm` as a pure function. Implement `src/lib/fsrs.ts` as a narrow wrapper around `ts-fsrs@5.4.1`:

```ts
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export function createNewCard(): SerializedFsrsCard
export function applyRating(card: SerializedFsrsCard, rating: ReviewRating, now: Date): SerializedFsrsCard
export function serializeCard(card: Card): SerializedFsrsCard
export function hydrateCard(saved: SerializedFsrsCard): Card
export function isDue(card: SerializedFsrsCard, now: Date): boolean
```

The wrapper must preserve the existing serialized fields and use the official scheduler. Do not implement scheduling math manually.

- [x] **Step 4: Implement review and vocabulary services**

`reviewService.ts` must expose:

```ts
export type ReviewOption = {
  meaning: string
  sourceTerm: string
  isCorrect: boolean
}

export function buildReviewOptions(
  current: { term: string; meaning: string },
  candidates: Array<{ term: string; meaning: string }>
): ReviewOption[]

export function rateReviewAnswer(input: {
  correct: boolean
  attempts: number
}): ReviewRating
```

`vocabService.ts` must expose:

```ts
export function mergePublicAndUserWords(
  publicEntries: PublicVocabEntry[],
  userWords: UserWord[]
): UserWord[]

export function createUserWordFromLookup(input: {
  term: string
  meaning: string
  sourceVocabKey?: string
}): UserWord
```

Duplicate user words are matched by `normalizedTerm`; user-entered notes, tags, and meanings override public defaults without deleting the public source key.

- [x] **Step 5: Run pure-logic tests and typecheck**

Run:

```powershell
npx vitest run tests/lib tests/features/review tests/features/vocab
npm run typecheck
```

Expected: all tests pass.

- [x] **Step 6: Commit the domain services**

Run:

```powershell
git add src/lib src/features/review src/features/vocab tests/lib tests/features/review tests/features/vocab
git commit -m "refactor: extract vocabulary and fsrs services"
```

### Task 5: Build the local IndexedDB repository and legacy migration

**Files:**
- Create: `src/repositories/repositoryTypes.ts`
- Create: `src/repositories/localDb.ts`
- Create: `src/repositories/localRepository.ts`
- Create: `src/migrations/legacyStorage.ts`
- Create: `src/migrations/migrateLegacyData.ts`
- Test: `tests/repositories/local-repository.test.ts`
- Test: `tests/migrations/legacy-storage.test.ts`

- [x] **Step 1: Define repository contracts and write failing tests**

Create `src/repositories/repositoryTypes.ts`:

```ts
export interface WordRepository {
  listUserWords(userId: string): Promise<UserWord[]>
  getUserWord(userId: string, normalizedTerm: string): Promise<UserWord | null>
  upsertUserWord(word: UserWord): Promise<UserWord>
  deleteUserWord(userId: string, wordId: string): Promise<void>
}

export interface ReviewRepository {
  appendReviewLog(log: ReviewLog): Promise<void>
  listReviewLogs(userId: string): Promise<ReviewLog[]>
}
```

Create `tests/repositories/local-repository.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createLocalRepository } from '../../src/repositories/localRepository'

describe('local repository', () => {
  it('upserts a word by user and normalized term', async () => {
    const repository = createLocalRepository({ name: `test-${crypto.randomUUID()}` })
    const first = await repository.upsertUserWord({
      id: 'word-1',
      userId: 'user-1',
      term: 'Address',
      normalizedTerm: 'address',
      meanings: [{ text: '处理，应对', source: 'user' }],
      status: 'new',
      fsrsCard: createEmptySerializedCard(),
      createdAt: 1,
      updatedAt: 1
    })
    const second = await repository.upsertUserWord({ ...first, id: 'word-2', notes: '重点复习', updatedAt: 2 })
    expect(second.id).toBe(first.id)
    expect(await repository.listUserWords('user-1')).toHaveLength(1)
    await repository.close()
  })
})
```

Create `tests/migrations/legacy-storage.test.ts` with an in-memory localStorage fixture containing one legacy progress record and one custom word. Assert that `readLegacyStorage` returns both records and does not throw on malformed unrelated keys.

- [x] **Step 2: Run the repository tests and verify they fail**

Run:

```powershell
npx vitest run tests/repositories/local-repository.test.ts tests/migrations/legacy-storage.test.ts
```

Expected: `FAIL` because the repository and migration modules do not exist.

- [x] **Step 3: Implement the Dexie database**

Create `src/repositories/localDb.ts` with tables for:

- `userWords` keyed by `[userId+normalizedTerm]`.
- `reviewLogs` keyed by `id` and indexed by `userId`.
- `studySessions` keyed by `id` and indexed by `userId`.
- `syncOperations` keyed by `id` and indexed by `userId`.
- `queryCache` keyed by normalized query.

Create `src/repositories/localRepository.ts` with `createLocalRepository(options)` returning the repository interfaces. All methods must scope reads and writes by `userId`; no method may query all users and filter afterward.

- [x] **Step 4: Implement legacy readers and migration**

Create `src/migrations/legacyStorage.ts`:

```ts
export type LegacyStorageSnapshot = {
  currentUser: string | null
  customVocab: unknown[]
  progressRecords: Array<{ key: string; value: unknown }>
  sessions: Array<{ key: string; value: unknown }>
}

export function readLegacyStorage(storage: Storage = window.localStorage): LegacyStorageSnapshot
```

Create `src/migrations/migrateLegacyData.ts`:

```ts
export type MigrationReport = {
  importedWords: number
  importedLogs: number
  importedSessions: number
  skippedRecords: number
  errors: string[]
}

export async function migrateLegacyData(
  snapshot: LegacyStorageSnapshot,
  repository: LocalRepository,
  userId: string
): Promise<MigrationReport>
```

Use the existing FSRS fields when present; create a new card only when the legacy record has no valid card. Never delete the original localStorage keys during migration.

- [x] **Step 5: Run migration and repository tests**

Run:

```powershell
npx vitest run tests/repositories tests/migrations
npm run typecheck
```

Expected: all tests pass.

- [x] **Step 6: Commit local persistence**

Run:

```powershell
git add src/repositories src/migrations tests/repositories tests/migrations
git commit -m "feat: add local repository and legacy migration"
```

### Task 6: Migrate the four-option review UI and dashboard

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Create: `src/features/review/ReviewPage.tsx`
- Create: `src/components/AppShell.tsx`
- Create: `src/components/SyncStatus.tsx`
- Modify: `src/styles/shell.css`
- Modify: `src/styles/pages.css`
- Test: `tests/features/review/review-page.test.tsx`
- Test: `tests/features/dashboard/dashboard-page.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Create `tests/features/review/review-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ReviewPage from '../../../src/features/review/ReviewPage'

describe('ReviewPage', () => {
  it('shows four answer options and reveals the result after selection', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ReviewPage /></MemoryRouter>)

    expect(screen.getAllByRole('button')).toHaveLength(5)
    expect(screen.getByText('address')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /处理，应对/ }))
    expect(screen.getByText(/正确答案/)).toBeInTheDocument()
    expect(screen.getByText(/真题例句/)).toBeInTheDocument()
  })
})
```

Create `tests/features/dashboard/dashboard-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import DashboardPage from '../../../src/features/dashboard/DashboardPage'

describe('DashboardPage', () => {
  it('prioritizes due reviews and new-word study', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '开始今日复习' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始新词学习' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查词' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the UI tests and verify they fail**

Run:

```powershell
npx vitest run tests/features/review/review-page.test.tsx tests/features/dashboard/dashboard-page.test.tsx
```

Expected: `FAIL` because the pages still contain placeholders.

- [ ] **Step 3: Implement dashboard and review state**

Implement `ReviewPage` with local sample data first, then replace the sample source with repository data:

```ts
type ReviewPageState = {
  cards: ReviewCard[]
  currentIndex: number
  selectedOption: number | null
  answered: boolean
  sessionId: string
}
```

Required behavior:

- Render exactly four answer buttons.
- Shuffle options without changing the correct meaning.
- Selecting an option sets `answered` and disables additional answer choices for the current card.
- Show correct/wrong state, one true exam example, and FSRS rating buttons after selection.
- `Enter` advances only after an answer exists.
- `Escape` navigates back to `/`.
- Persist the current session through the local repository before navigation.

Implement `DashboardPage` with due count, new count, accuracy, streak, and links/actions. Use stable button dimensions and avoid embedding repository calls directly in JSX; call a `dashboardSelectors` function with repository data.

- [ ] **Step 4: Add keyboard and mobile behavior**

Add a `useReviewKeyboard` hook inside `ReviewPage.tsx` or `src/features/review/useReviewKeyboard.ts` that maps `1-4`, `Enter`, and `Escape`. Add responsive styles so the four options use two columns on desktop and one column on narrow screens.

- [ ] **Step 5: Run UI tests and typecheck**

Run:

```powershell
npx vitest run tests/features/review tests/features/dashboard
npm run typecheck
```

Expected: all tests pass.

- [ ] **Step 6: Verify the local app in the browser**

Run:

```powershell
npm run dev -- --host 127.0.0.1
```

Open the Vite URL in the in-app browser and verify:

- dashboard loads;
- clicking `开始今日复习` opens the four-option page;
- clicking an answer reveals the result;
- `Enter` advances;
- `Escape` returns to the dashboard;
- mobile viewport shows one option per row without overflow.

- [ ] **Step 7: Commit the review migration**

Run:

```powershell
git add src/app src/components src/features/dashboard src/features/review src/styles tests/features
git commit -m "feat: migrate dashboard and four-option review"
```

### Task 7: Add vocabulary list, Excel import/export, and local lookup

**Files:**
- Create: `src/features/vocab/VocabListPage.tsx`
- Create: `src/features/lookup/LookupPage.tsx`
- Create: `src/features/lookup/lookupTypes.ts`
- Create: `src/features/lookup/lookupService.ts`
- Create: `src/lib/csv.ts`
- Modify: `src/app/router.tsx`
- Test: `tests/features/lookup/lookup-service.test.ts`
- Test: `tests/features/vocab/vocab-list-page.test.tsx`

- [ ] **Step 1: Write failing lookup and list tests**

Create `tests/features/lookup/lookup-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { lookupLocalWord } from '../../../src/features/lookup/lookupService'

describe('lookupLocalWord', () => {
  it('combines public meanings with exam corpus counts and examples', () => {
    const result = lookupLocalWord('address')
    expect(result.publicEntry?.term).toBe('address')
    expect(result.examStats.totalOccurrences).toBeGreaterThan(0)
    expect(result.examples.length).toBeGreaterThan(0)
  })
})
```

Create `tests/features/vocab/vocab-list-page.test.tsx` asserting that the list renders status filters, a search input, and an `导出 Excel` button.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
npx vitest run tests/features/lookup/lookup-service.test.ts tests/features/vocab/vocab-list-page.test.tsx
```

Expected: `FAIL` because lookup and vocabulary list modules do not exist.

- [ ] **Step 3: Implement local lookup**

Create `src/features/lookup/lookupTypes.ts` with `WordLookupResult` and `DictionaryResult`.

Implement `lookupLocalWord(term)`:

```ts
export function lookupLocalWord(term: string): WordLookupResult {
  const normalizedTerm = normalizeTerm(term)
  const publicEntry = publicVocab.find((entry) => entry.normalizedTerm === normalizedTerm)
  const corpus = searchExamCorpus(normalizedTerm)
  return {
    term: term.trim(),
    normalizedTerm,
    publicEntry,
    partsOfSpeech: publicEntry ? [{ label: publicEntry.partOfSpeech ?? '', meanings: publicEntry.meanings.map((item) => item.text) }] : [],
    examStats: {
      totalOccurrences: corpus.totalOccurrences,
      exampleCount: corpus.exampleCount,
      taggedSenseCounts: []
    },
    examples: corpus.examples,
    suggestions: [],
    sourceStatus: { localCorpus: corpus.totalOccurrences ? 'hit' : 'miss', dictionary: 'miss' }
  }
}
```

Implement `LookupPage` with an accessible search input, loading/error/empty states, local result display, source labels, and `加入生词库` action. The action must call `createUserWordFromLookup` and `upsertUserWord`.

- [ ] **Step 4: Implement vocabulary list and Excel export**

Use SheetJS only in the browser-facing export/import module. Export columns:

```text
单词,词性,释义,状态,下次复习时间,笔记,标签
```

Import parsing must:

- accept a `单词` or `word` column;
- accept a `释义` or `meaning` column;
- reject rows with empty words;
- normalize duplicate rows;
- report imported, skipped, and failed counts.

Render `VocabListPage` with search, status filters, row actions, import, export, and a compact mobile layout.

- [ ] **Step 5: Run lookup/list tests and typecheck**

Run:

```powershell
npx vitest run tests/features/lookup tests/features/vocab
npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit local lookup and vocabulary management**

Run:

```powershell
git add src/features/lookup src/features/vocab src/lib/csv.ts src/app/router.tsx tests/features/lookup tests/features/vocab
git commit -m "feat: add local lookup and vocabulary management"
```

### Task 8: Add Supabase authentication, schema, RLS, and sync queue

**Files:**
- Create: `src/repositories/supabaseClient.ts`
- Create: `src/repositories/supabaseRepository.ts`
- Create: `src/repositories/syncQueue.ts`
- Create: `src/repositories/syncService.ts`
- Create: `src/features/auth/authTypes.ts`
- Create: `src/features/auth/authService.ts`
- Create: `src/features/auth/AuthPage.tsx`
- Create: `supabase/migrations/202608210001_initial_schema.sql`
- Create: `supabase/migrations/202608210002_rls_policies.sql`
- Modify: `src/app/App.tsx`
- Modify: `src/app/router.tsx`
- Test: `tests/features/auth/auth-service.test.ts`
- Test: `tests/repositories/sync-service.test.ts`

- [ ] **Step 1: Write failing auth and sync tests**

Create `tests/features/auth/auth-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateAuthInput } from '../../../src/features/auth/authService'

describe('auth input validation', () => {
  it('requires a valid email and a password of at least eight characters', () => {
    expect(validateAuthInput({ email: 'bad', password: 'short' }).success).toBe(false)
    expect(validateAuthInput({ email: 'user@example.com', password: 'long-password' }).success).toBe(true)
  })
})
```

Create `tests/repositories/sync-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mergeReviewLogs, mergeUserWord } from '../../src/repositories/syncService'

describe('sync merge rules', () => {
  it('appends review logs and chooses the newer word record', () => {
    const local = { id: 'word-1', userId: 'user-1', normalizedTerm: 'address', updatedAt: 10 }
    const remote = { ...local, updatedAt: 20, notes: 'cloud note' }
    expect(mergeUserWord(local, remote)).toEqual(remote)
    expect(mergeReviewLogs([{ id: 'log-1' }], [{ id: 'log-1' }, { id: 'log-2' }])).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
npx vitest run tests/features/auth/auth-service.test.ts tests/repositories/sync-service.test.ts
```

Expected: `FAIL` because auth and sync modules do not exist.

- [ ] **Step 3: Add the initial Supabase schema**

Create `supabase/migrations/202608210001_initial_schema.sql` with tables:

- `profiles`.
- `user_words`.
- `review_logs`.
- `study_sessions`.
- `user_settings`.

Use UUID primary keys, `auth.users(id)` foreign keys, `timestamptz` timestamps, `jsonb` for meanings/tags/FSRS snapshots, and a unique constraint on `user_words(user_id, normalized_term)`.

- [ ] **Step 4: Add RLS policies**

Create `supabase/migrations/202608210002_rls_policies.sql`:

```sql
alter table public.user_words enable row level security;

create policy "users manage own words"
on public.user_words
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

Add equivalent policies for `review_logs`, `study_sessions`, and `user_settings`; for `profiles`, compare `id = auth.uid()`. Add indexes on every `user_id`, `normalized_term`, `next_review_at`, and `reviewed_at` column used in queries.

- [ ] **Step 5: Implement Auth and Supabase repositories**

Create `src/repositories/supabaseClient.ts` that reads only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; throw a clear configuration error when either is absent in a cloud-enabled environment.

Implement `authService.ts`:

```ts
export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export function validateAuthInput(input: unknown) {
  return authSchema.safeParse(input)
}

export async function signIn(email: string, password: string): Promise<AuthUser>
export async function signUp(email: string, password: string): Promise<AuthUser | null>
export async function requestPasswordReset(email: string): Promise<void>
export async function signOut(): Promise<void>
```

Implement `supabaseRepository.ts` with the same repository contracts as the local repository. Never expose the Supabase service role key in `src`.

- [ ] **Step 6: Implement sync queue and merge service**

Create `syncQueue.ts` for enqueueing idempotent operations:

```ts
type SyncOperation =
  | { id: string; userId: string; kind: 'upsert-word'; payload: UserWord }
  | { id: string; userId: string; kind: 'append-review-log'; payload: ReviewLog }
  | { id: string; userId: string; kind: 'upsert-session'; payload: StudySession }
```

Create `syncService.ts`:

```ts
export function mergeUserWord<T extends { updatedAt: number }>(local: T, remote: T): T {
  return local.updatedAt >= remote.updatedAt ? local : remote
}

export function mergeReviewLogs<T extends { id: string }>(local: T[], remote: T[]): T[] {
  return [...new Map([...remote, ...local].map((item) => [item.id, item])).values()]
}

export async function flushSyncQueue(userId: string): Promise<SyncResult>
```

`flushSyncQueue` must process operations in creation order, remove only successful operations, and retain failed operations with an error message.

- [ ] **Step 7: Add auth routes and account UI**

Add `/auth` route. `AuthPage` must provide login, registration, password reset mode, validation messages, loading state, and a link back to local mode. Add an authenticated user menu with sign-out and a `SyncStatus` indicator. When Supabase variables are absent, keep local mode usable and show “本地模式”.

- [ ] **Step 8: Run auth/sync tests and migration validation**

Run:

```powershell
npx vitest run tests/features/auth tests/repositories
npm run typecheck
```

Expected: all pass. If a Supabase project is configured locally, apply migrations with:

```powershell
npx supabase db reset
```

Expected: migration completes and `supabase db lint` reports no policy errors.

- [ ] **Step 9: Commit cloud authentication and sync**

Run:

```powershell
git add src/repositories src/features/auth supabase/migrations src/app tests/features/auth tests/repositories
git commit -m "feat: add supabase auth and cloud sync"
```

### Task 9: Add dictionary provider proxy and richer lookup results

**Files:**
- Create: `src/features/lookup/dictionaryProvider.ts`
- Create: `src/features/lookup/dictionaryApi.ts`
- Create: `supabase/functions/dictionary-lookup/index.ts`
- Create: `supabase/functions/dictionary-lookup/README.md`
- Modify: `src/features/lookup/lookupService.ts`
- Modify: `src/features/lookup/LookupPage.tsx`
- Test: `tests/features/lookup/dictionary-provider.test.ts`

- [ ] **Step 1: Write the failing provider contract test**

Create `tests/features/lookup/dictionary-provider.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createDictionaryProvider } from '../../../src/features/lookup/dictionaryProvider'

describe('dictionary provider', () => {
  it('maps provider response into stable application fields', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        word: 'address',
        phonetic: '/əˈdres/',
        meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: 'deal with' }] }]
      })
    })
    const provider = createDictionaryProvider(fetcher)
    await expect(provider.lookup('address')).resolves.toMatchObject({
      term: 'address',
      phonetic: '/əˈdres/'
    })
  })
})
```

- [ ] **Step 2: Run the provider test and verify it fails**

Run:

```powershell
npx vitest run tests/features/lookup/dictionary-provider.test.ts
```

Expected: `FAIL` because the provider adapter does not exist.

- [ ] **Step 3: Implement the provider adapter and cache**

Create `dictionaryProvider.ts`:

```ts
export interface DictionaryProvider {
  lookup(term: string): Promise<DictionaryResult>
}

export function createDictionaryProvider(
  fetcher: typeof fetch = fetch
): DictionaryProvider
```

The adapter must normalize success, not-found, timeout, and invalid JSON into stable errors. `dictionaryApi.ts` must check IndexedDB `queryCache` before making a request and cache successful responses with a bounded expiration.

- [ ] **Step 4: Implement the Edge Function proxy**

Create `supabase/functions/dictionary-lookup/index.ts` that:

1. Accepts `POST { "term": string }`.
2. Rejects empty input and terms longer than 100 characters.
3. Reads the provider URL and optional API key from Edge Function environment variables.
4. Calls the provider with a timeout.
5. Returns a stable JSON shape.
6. Never returns the provider secret.

Create `supabase/functions/dictionary-lookup/README.md` documenting local secrets and deployment:

```text
supabase secrets set DICTIONARY_API_KEY=...
supabase functions deploy dictionary-lookup
```

- [ ] **Step 5: Merge dictionary data into the lookup page**

Update `lookupService.ts` so local corpus results render immediately, then dictionary data enriches the result. If the provider fails, show the local result and a non-blocking status message. Display separate source labels:

- `考研真题语料`
- `公共词典`

Keep “出现次数” based only on local exam corpus records.

- [ ] **Step 6: Run provider tests and browser verification**

Run:

```powershell
npx vitest run tests/features/lookup
npm run typecheck
```

Verify in the browser:

- `address` shows local meaning and exam count without network access.
- a new term can enrich from the provider.
- provider failure does not blank the local result.
- clicking `加入生词库` creates a new local word.

- [ ] **Step 7: Commit dictionary lookup**

Run:

```powershell
git add src/features/lookup supabase/functions/dictionary-lookup tests/features/lookup
git commit -m "feat: add dictionary lookup and exam corpus results"
```

### Task 10: Add settings, statistics, sync controls, and export

**Files:**
- Create: `src/features/stats/StatsPage.tsx`
- Create: `src/features/settings/SettingsPage.tsx`
- Create: `src/components/SyncStatus.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/app/App.tsx`
- Test: `tests/features/stats/stats-page.test.tsx`
- Test: `tests/features/settings/settings-page.test.tsx`

- [ ] **Step 1: Write failing statistics and settings tests**

Create `tests/features/stats/stats-page.test.tsx` asserting that the page renders today’s study minutes, total learned words, review accuracy, and overdue count.

Create `tests/features/settings/settings-page.test.tsx` asserting that the page renders manual sync, export personal data, local/cloud mode, and sign-out controls.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
npx vitest run tests/features/stats tests/features/settings
```

Expected: `FAIL` because the pages do not exist.

- [ ] **Step 3: Implement statistics selectors and pages**

Create selectors that consume repository data rather than DOM state:

```ts
export function calculateAccuracy(logs: ReviewLog[]): number {
  if (!logs.length) return 0
  return Math.round((logs.filter((log) => log.rating >= 3).length / logs.length) * 100)
}

export function countDueWords(words: UserWord[], now = Date.now()): number {
  return words.filter((word) => word.nextReviewAt !== null && word.nextReviewAt <= now).length
}
```

Render compact metric blocks, a seven-day activity list, due/learning/mastered counts, and an error state when data cannot be loaded.

- [ ] **Step 4: Implement settings and sync actions**

Settings must:

- show local or cloud mode;
- show the latest successful sync time;
- expose a manual `立即同步` button;
- expose `导出个人数据`;
- expose `清理本地缓存` only after a confirmation step;
- expose sign out when authenticated;
- preserve local mode when Supabase configuration is absent.

- [ ] **Step 5: Run tests and typecheck**

Run:

```powershell
npx vitest run tests/features/stats tests/features/settings
npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit settings and statistics**

Run:

```powershell
git add src/features/stats src/features/settings src/components/SyncStatus.tsx src/app tests/features/stats tests/features/settings
git commit -m "feat: add statistics and sync settings"
```

### Task 11: Add CI, deployment documentation, and end-to-end verification

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`
- Create: `docs/deployment.md`
- Create: `tests/e2e/local-flow.test.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Write the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Add deployment documentation**

Create `docs/deployment.md` documenting:

1. Create a Supabase project.
2. Apply migrations.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` locally and in Vercel.
4. Configure Supabase Auth Site URL and redirect URLs for localhost, Vercel preview, and production.
5. Store dictionary provider secrets with Supabase secrets.
6. Connect the GitHub repository to Vercel.
7. Keep user data in Supabase, not GitHub.
8. Revoke any previously exposed GitHub token before deployment.

- [ ] **Step 3: Update README**

Replace the garbled legacy README with a concise Chinese README containing:

- product capabilities;
- local development commands;
- local-only mode behavior;
- Supabase setup;
- Vercel deployment;
- data ownership rules;
- security warning about not committing `.env` or user exports;
- migration instructions from the legacy page.

- [ ] **Step 4: Add local flow verification**

Create `tests/e2e/local-flow.test.ts` using Testing Library or the chosen browser test runner to verify:

1. Dashboard renders.
2. Start review.
3. Four options are present.
4. Select an answer.
5. Result and exam example appear.
6. Return to dashboard.
7. Open lookup.
8. Query `address`.
9. Add it to the local word repository.
10. Vocabulary list contains the word.

- [ ] **Step 5: Run the full verification suite**

Run:

```powershell
npm run typecheck
npm test
npm run build
```

Expected: zero type errors, zero test failures, and a successful `dist` build.

Then start the application:

```powershell
npm run dev -- --host 127.0.0.1
```

Use the in-app browser to verify desktop and mobile viewports. Confirm that no text overlaps, review options remain visible, lookup results are readable, and the page does not depend on external dictionary access for local corpus results.

- [ ] **Step 6: Run the final security scan**

Run:

```powershell
rg -n "ghp_|github_pat_|service_role|SUPABASE_SERVICE_ROLE|DICTIONARY_API_KEY|Authorization:\s*`token" --glob "!node_modules/**" --glob "!dist/**" .
```

Expected: no hard-coded credential values. Environment variable names and documentation placeholders are allowed; secret values are not.

- [ ] **Step 7: Commit CI and deployment docs**

Run:

```powershell
git add .github/workflows/ci.yml README.md docs/deployment.md tests/e2e .gitignore
git commit -m "ci: add deployment checks and documentation"
```

### Task 12: Final regression review and release handoff

**Files:**
- Modify: `docs/superpowers/baselines/2026-08-21-local-feature-baseline.md`
- Modify: `README.md`
- Create: `docs/release-checklist.md`

- [ ] **Step 1: Compare every baseline behavior against the new app**

For each baseline item, record one of `preserved`, `migrated`, or `intentionally changed`, with a test or browser verification reference. The four-option review, FSRS-6, session recovery, Excel import/export, and local corpus must be `preserved` or `migrated`, never silently omitted.

- [ ] **Step 2: Create the release checklist**

Create `docs/release-checklist.md`:

```markdown
# Release Checklist

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Supabase migrations applied
- [ ] RLS policies verified
- [ ] Auth redirect URLs configured
- [ ] Vercel environment variables configured
- [ ] Dictionary secrets stored outside the client bundle
- [ ] Legacy GitHub token revoked
- [ ] Desktop browser flow verified
- [ ] Mobile browser flow verified
- [ ] Offline review and later sync verified
- [ ] Legacy local data migration verified
- [ ] No user exports or `.env` files tracked by Git
```

- [ ] **Step 3: Run final verification before claiming completion**

Run:

```powershell
npm run typecheck
npm test
npm run build
git diff --check
git status --short
```

Expected: all verification commands pass. Any unrelated existing worktree change must remain untouched and be reported separately.

- [ ] **Step 4: Request code review before integration**

Review the final diff for:

- accidental deletion of legacy source data;
- loss of four-option review behavior;
- client-side secrets;
- missing RLS coverage;
- unscoped repository queries;
- sync operations that can be lost after partial failure;
- mobile layout overflow;
- tests that pass without exercising real behavior.

Only after this review should the branch be merged or pushed to GitHub.
