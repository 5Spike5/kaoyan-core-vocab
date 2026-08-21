# 考研英语核心词重构设计

**日期：** 2026-08-21

## 1. 项目背景

当前项目是一个单文件静态网页应用，主要文件如下：

- `index.html`：页面结构、样式、状态管理、FSRS-6 复习逻辑、导入导出和数据持久化全部集中在一个文件中。
- `data.js`：约 1,398 条核心词和短语。
- `sentences.js`：真题英文句子、中文翻译和部分词汇到例句的映射，文件约 803 KB。
- `README.md`：项目说明。

当前已经具备的核心能力：

- 新词学习。
- 四选一释义题。
- FSRS-6 间隔复习。
- 到期复习、错词复习和自主复习。
- 学习计时、连续学习天数和学习统计。
- 浏览器本地持久化和未完成会话恢复。
- Excel 词汇导入、筛选和导出。
- 本地真题句子匹配。

当前主要问题：

- 页面、业务逻辑、数据访问和样式全部集中在 `index.html`，难以维护和测试。
- 当前“登录”只是本地用户名标记，不是真正的身份认证。
- 用户学习数据依赖浏览器本地存储，不能跨设备同步。
- 公开词库和个人生词没有清晰的数据边界。
- 查词、公共词典数据、考研语料统计尚未形成独立模块。
- 当前页面内存在浏览器端 GitHub Token，属于必须移除的安全风险。
- 真题句子的年份、试卷、文章和词义标注不够结构化，不能直接生成可靠的按年份或按义项统计。

## 2. 目标

本次重构的目标是建立一个个人优先、可扩展到多用户的考研英语词汇学习应用：

1. 保留当前四选一复习体验和 FSRS-6 调度行为。
2. 增加真实的邮箱密码注册、登录、退出和密码重置。
3. 支持用户生词、复习状态、复习日志和设置的云端同步。
4. 支持离线学习，恢复网络后自动同步。
5. 支持输入单词或短语后查询词典信息。
6. 支持从本地考研语料统计出现次数并展示真题句子。
7. 支持查询结果一键加入生词库。
8. 保留核心词库、真题句子、Excel 导入导出和本地数据迁移能力。
9. 代码进入 React + Vite + TypeScript 工程，形成可测试、可部署的模块边界。
10. 支持 GitHub 代码托管和 Vercel 自动部署。

## 3. 非目标

第一期不包含以下内容：

- Google、微信或其他第三方登录。
- 面向公众的管理后台。
- 把个人学习记录提交到 GitHub。
- 直接让浏览器写入 GitHub 仓库。
- 依赖大语言模型自动生成未经审核的考研义项统计。
- 立即把所有真题语料迁移到云数据库。
- 重新实现 FSRS 算法。

## 4. 总体架构

采用以下技术栈：

- 前端：React、Vite、TypeScript。
- 路由：React Router。
- 服务端状态和请求缓存：TanStack Query。
- 表单与校验：React Hook Form、Zod。
- 样式：项目内 CSS Modules 或按页面拆分的 CSS，避免在组件中堆积大段内联样式。
- 图标：Lucide React。
- 复习算法：继续使用 `ts-fsrs` 的 FSRS-6 实现。
- 本地存储：IndexedDB，使用轻量数据访问封装。
- 云端认证和数据库：Supabase Auth、Supabase Postgres、Supabase Row Level Security。
- 公共词典查询：通过词典查询适配器接入，不让页面直接依赖某一个供应商。
- 部署：GitHub 保存代码，Vercel 构建和发布前端，Supabase 承担认证和用户数据。

### 4.1 分层

```text
React UI
  -> feature services
  -> repositories
  -> local IndexedDB / Supabase

公开词库和真题数据
  -> 构建时导入
  -> 浏览器本地索引

词典查询
  -> query adapter
  -> Supabase Edge Function proxy
  -> public dictionary provider
```

UI 层只负责展示和触发用户操作。复习调度、词条合并、频次统计、同步和迁移逻辑分别放在独立模块中，避免组件直接操作 `localStorage` 或 Supabase。

## 5. 数据归属

### 5.1 GitHub 公开数据

GitHub 仓库存放可公开、可版本管理的数据：

- 初始核心词库。
- 真题英文句子和中文翻译。
- 经过整理的真题元数据。
- 本地索引构建脚本。
- Supabase 数据库迁移文件。
- 前端源代码和测试。

### 5.2 Supabase 用户数据

Supabase 存放需要身份隔离和跨设备同步的数据：

- 用户账号和认证状态。
- 用户新增生词。
- 用户对公开词条的个人释义覆盖。
- 用户笔记、标签和收藏状态。
- FSRS 卡片状态。
- 复习日志。
- 学习会话。
- 用户设置。

### 5.3 本地 IndexedDB

IndexedDB 作为离线工作区和缓存：

- 当前登录用户的本地数据副本。
- 未完成学习会话。
- 待上传的同步操作队列。
- 公开语料的搜索索引。
- 词典查询缓存。

匿名用户可以在本地模式下学习，但不能使用云同步。登录后，本地数据进入一次性合并流程。

## 6. 数据模型

### 6.1 公开词条

公开词条使用构建时数据结构：

```ts
type PublicVocabEntry = {
  key: string
  term: string
  normalizedTerm: string
  partOfSpeech?: string
  meanings: Array<{
    text: string
    source: 'curated' | 'dictionary' | 'user'
  }>
  category?: '核心词' | '长难词' | '难词' | '短语'
  source?: string
}
```

`key` 由规范化词形生成，同一词条的大小写、空格和连字符变化不能创建重复核心词。

### 6.2 真题句子

```ts
type ExamExample = {
  id: string
  sentence: string
  translation: string
  year?: number
  exam?: '考研英语一' | '考研英语二'
  passage?: string
  source: 'official-corpus' | 'user-imported'
}
```

当前 `sentences.js` 中缺少的年份、试卷和文章字段先保持可选。没有可靠来源时只显示“本地考研语料出现次数”，不展示伪造的年份分布。

### 6.3 义项出现记录

```ts
type ExamSenseOccurrence = {
  exampleId: string
  vocabKey: string
  sense: string
  confidence: 'manual' | 'reviewed' | 'estimated'
}
```

只有存在义项记录时才展示“某义项出现了几次”。自动匹配可以产生 `estimated`，但默认以总出现次数为主，不把估计值包装成精确统计。

### 6.4 Supabase 表

#### `profiles`

```text
id              uuid primary key references auth.users
display_name    text
avatar_url      text
created_at      timestamptz
updated_at      timestamptz
```

#### `user_words`

```text
id                  uuid primary key
user_id             uuid not null
term                text not null
normalized_term     text not null
source_vocab_key    text
part_of_speech      text
meanings            jsonb not null default '[]'
notes               text
tags                jsonb not null default '[]'
status              text not null
fsrs_card           jsonb not null
fsrs_state          text
stability           numeric
difficulty          numeric
next_review_at      timestamptz
last_review_at      timestamptz
created_at          timestamptz
updated_at          timestamptz
```

唯一约束：`(user_id, normalized_term)`。

#### `review_logs`

```text
id                  uuid primary key
user_id             uuid not null
user_word_id        uuid not null
session_id          uuid
selected_option     integer
correct_option      integer
rating              integer
card_before         jsonb not null
card_after          jsonb not null
reviewed_at         timestamptz
```

复习日志只追加，不通过更新旧日志来保存新状态。

#### `study_sessions`

```text
id                  uuid primary key
user_id             uuid not null
type                text not null
started_at          timestamptz
completed_at        timestamptz
total_cards         integer
correct_count       integer
wrong_count         integer
duration_seconds    integer
```

#### `user_settings`

```text
user_id             uuid primary key
daily_new_goal      integer
daily_review_goal   integer
theme               text
sound_enabled       boolean
updated_at          timestamptz
```

所有用户表启用 RLS。读取、插入、更新和删除策略都要求目标行的 `user_id` 等于当前登录用户的身份 ID；`profiles` 和 `user_settings` 使用对应的主键身份关系。

## 7. 核心数据流

### 7.1 登录

1. 用户输入邮箱和密码。
2. Supabase Auth 返回会话。
3. 前端读取当前用户的云端设置、用户词条、FSRS 状态和必要的复习日志。
4. 本地缓存切换到当前 `userId` 的命名空间。
5. 执行本地与云端合并。
6. 页面进入首页，显示同步状态。

### 7.2 离线学习和同步

1. 用户答题后先更新本地 FSRS 卡片和复习日志。
2. 写入待同步操作队列。
3. 页面立即更新统计。
4. 网络恢复后按操作顺序上传。
5. 上传成功的操作从队列删除。
6. 失败操作保留并记录可读错误。

### 7.3 冲突处理

- 复习日志：追加合并，不覆盖历史。
- 用户词条普通字段：按 `updated_at` 采用最后修改版本。
- FSRS 状态：按最后一条复习日志的 `reviewed_at` 重新计算或采用更新版本，不能仅凭客户端时间覆盖较新的云端复习。
- 同一词条重复创建：使用 `(user_id, normalized_term)` 唯一约束和前端合并。
- 冲突无法自动判断时，保留云端版本并在设置页显示需要处理的同步提示。

### 7.4 本地数据迁移

迁移程序识别当前旧版存储键：

- `currentUser`
- `customVocab`
- 用户相关的 `vocabProgress_*`
- 用户相关的 `vocabSession_*`
- IndexedDB 中的旧进度、复习日志和自定义词库

迁移步骤：

1. 读取旧数据并校验 JSON。
2. 转换成新的 `user_words`、`review_logs` 和 `study_sessions` 结构。
3. 生成迁移报告：成功条数、跳过条数、错误条数。
4. 在本地迁移成功后再上传云端。
5. 旧数据保留，直到用户确认迁移完成；之后由设置页提供清理入口。

## 8. 查词系统

### 8.1 查询结果结构

```ts
type WordLookupResult = {
  term: string
  normalizedTerm: string
  phonetic?: string
  audioUrl?: string
  partsOfSpeech: Array<{
    label: string
    meanings: string[]
  }>
  publicEntry?: PublicVocabEntry
  examStats: {
    totalOccurrences: number
    exampleCount: number
    taggedSenseCounts: Array<{
      sense: string
      count: number
      confidence: 'manual' | 'reviewed' | 'estimated'
    }>
  }
  examples: ExamExample[]
  suggestions: string[]
  sourceStatus: {
    localCorpus: 'hit' | 'miss'
    dictionary: 'hit' | 'miss' | 'error'
  }
}
```

### 8.2 查询顺序

1. 规范化输入，保留原始展示词形。
2. 查询本地公开词条索引。
3. 查询本地真题句子索引。
4. 如果通用资料缺少，再请求查询代理函数。
5. 将结果合并并缓存。
6. 展示来源标签，区分“考研真题语料”和“公共词典”。

### 8.3 API 适配器

前端只依赖以下接口，不直接依赖供应商返回格式：

```ts
interface DictionaryProvider {
  lookup(term: string): Promise<DictionaryResult>
}
```

第一期实现一个公共英文词典适配器。拼写纠错和相关短语作为可选适配器，任何供应商更换都不能影响 UI 和本地语料统计。

私密 API key 只放在 Supabase Edge Function 的 secret 中。Edge Function 负责：

- 代理第三方请求。
- 过滤和统一字段。
- 短期缓存。
- 基础限流。
- 隐藏第三方 key。
- 返回可读的错误状态。

第三方接口不可用时，页面仍显示本地核心词库和真题语料结果。

## 9. UI 和页面结构

### 9.1 全局导航

桌面端使用左侧导航，移动端切换为底部导航：

- 今日学习。
- 查词。
- 生词库。
- 真题语料。
- 学习统计。
- 设置与同步。

### 9.2 今日学习页

首屏优先显示：

- 今日待复习数量。
- 今日新词目标和完成进度。
- 正确率。
- 连续学习天数。
- 开始到期复习按钮。
- 开始新词学习按钮。
- 查词输入框。

### 9.3 复习页

必须保留当前四选一模式：

- 当前单词、音标和词性。
- 四个释义选项。
- 选择后显示正确答案。
- 真题例句和中文翻译。
- FSRS 评价和下一次复习信息。
- 错词自动重试。
- `1-4` 选择、`Enter` 继续、`Esc` 退出。
- 退出时保存未完成会话。

### 9.4 查词页

查询结果按以下顺序展示：

1. 词形、音标和发音按钮。
2. 词典释义。
3. 考研语料总次数和示例句数量。
4. 可用的义项频次。
5. 真题例句和中文翻译。
6. 加入生词库按钮。

加入前允许编辑中文释义、标签和笔记，加入后立即创建新词卡片。

### 9.5 生词库和统计页

生词库支持状态筛选、搜索、标签筛选、批量导入和导出。

统计页展示：

- 每日学习量。
- 复习完成率。
- 正确率趋势。
- 已掌握、学习中和待复习数量。
- 易错词。
- 真题义项统计中具有人工或审核标记的部分。

视觉方向：

- 深蓝用于导航和主要文字。
- 蓝色用于主要操作和学习进度。
- 青绿色用于真题语料。
- 橙色用于待复习和提醒。
- 以紧凑的工具型布局为主，避免营销式大 hero、过度装饰和层层嵌套卡片。
- 所有按钮、输入框和卡片在移动端保持稳定尺寸，长单词和长短语允许换行。

## 10. 安全设计

必须完成以下事项：

1. 立即撤销当前 `index.html` 中已经暴露的 GitHub Token。
2. 删除浏览器端 GitHub 直写逻辑。
3. 新 Token 只放 GitHub Secrets 或服务端 secret，绝不进入前端源代码。
4. 前端只使用 Supabase URL 和 publishable key。
5. 不把 Supabase service role key、第三方词典 key 或数据库管理 key 编译到前端。
6. 所有用户表启用 RLS。
7. 不把用户生词、复习记录和个人笔记写入 GitHub。
8. 对查询代理做输入长度限制、基础限流和错误脱敏。
9. 日志中不打印邮箱、Token、完整用户数据或第三方响应中的敏感字段。

## 11. 测试策略

### 11.1 单元测试

覆盖以下纯逻辑：

- 词条规范化和去重。
- 真题句子匹配。
- 出现次数统计。
- 义项频次统计。
- FSRS 卡片序列化和反序列化。
- 复习评价映射。
- 本地旧数据迁移。
- 同步冲突合并。
- 查询结果适配器。

### 11.2 集成测试

- 登录状态切换。
- 本地数据仓库与云端仓库的读写。
- 离线队列上传和失败重试。
- 新词加入后生成 FSRS 卡片。
- 复习完成后生成复习日志。
- Excel 导入后去重并进入生词库。

### 11.3 浏览器验收

至少验证：

- 未登录状态。
- 注册、登录、退出和密码重置入口。
- 首页进入四选一复习。
- 选择四个答案并显示结果。
- 复习中途退出并恢复。
- 查词、查看频次和例句。
- 加入生词库后出现在待学习列表。
- 手机宽度下选项不溢出。
- 断网学习后恢复网络同步。

### 11.4 TDD 约束

每个新的业务函数先写一个能够失败的测试，再实现最小行为。重构期间不把测试全部推迟到最后。

## 12. GitHub 和 Vercel 发布

当前本地仓库来自 fork：

- `origin` 指向用户 fork：`https://github.com/5Spike5/kaoyan-core-vocab.git`。
- `upstream` 指向原作者仓库：`https://github.com/SOGOOD-ONE/kaoyan-core-vocab.git`。
- 本地已将 `upstream` 的 push URL 设置为 `DISABLED`，防止误推原作者仓库。
- 重构工作在 `codex/rebuild-react-supabase` 分支进行。
- 默认只向 `origin` 推送重构分支；除非用户明确要求，不向原作者仓库发起 PR 或推送。
- 如需同步原作者更新，先从 `upstream` 拉取，再人工处理冲突，不能覆盖本地重构提交。

GitHub 仓库结构目标：

```text
src/
  app/
  components/
  features/
  lib/
  repositories/
  services/
  types/
data/
  vocab/
  exam/
supabase/
  migrations/
  functions/
tests/
```

本地环境变量：

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Vercel 环境变量配置同名变量，分别设置 Development、Preview 和 Production。

GitHub Actions 至少执行：

```text
npm ci
npm run typecheck
npm run test
npm run build
```

发布前需要在 Supabase 中配置：

- 站点 URL。
- 本地开发回调地址。
- Vercel 生产地址。
- 密码重置回调地址。
- 邮件确认策略。

## 13. 分阶段实施

### 阶段 0：安全、备份和分支

- 保留现有前端压缩备份。
- 新建重构分支或隔离工作区。
- 删除浏览器端 GitHub Token 和直写逻辑。
- 记录旧版行为基线。

验收：旧版仍可回退，源码中不再出现 GitHub 访问 Token。

### 阶段 1：React 工程和本地功能迁移

- 创建 Vite + React + TypeScript 工程。
- 拆分首页、复习页、生词库和设置页。
- 迁移公开词库和真题语料。
- 迁移 FSRS-6、四选一、错词重试、学习计时和会话恢复。
- 迁移 Excel 导入导出。

验收：未配置 Supabase 时，用户仍可以完成本地学习和复习。

### 阶段 2：本地数据仓库和迁移

- 建立统一的本地 repository 接口。
- 抽离 IndexedDB。
- 建立旧版存储迁移器。
- 增加词条规范化、频次统计和同步操作类型。

验收：旧版已有学习进度可以在新前端恢复，且迁移报告可读。

### 阶段 3：Supabase 登录和同步

- 创建认证和数据库迁移。
- 创建 RLS 策略。
- 接入邮箱密码注册、登录、退出和密码重置。
- 实现登录后的本地云端合并。
- 实现离线队列和自动同步。

验收：同一账号在两个浏览器中可以看到一致的生词和复习状态。

### 阶段 4：查词与真题统计

- 建立公开语料索引。
- 实现本地查词和总出现次数。
- 增加词典查询适配器。
- 增加 Edge Function 代理、缓存和限流。
- 加入拼写建议、短语搜索和查询结果缓存。
- 支持查词结果加入生词库。

验收：输入单词或短语后能区分本地考研语料和公共词典数据，API 失败时本地结果仍可用。

### 阶段 5：视觉完善和上线

- 完成桌面端和移动端适配。
- 增加统计图表和同步状态。
- 配置 GitHub Actions、Vercel 和 Supabase 回调。
- 做浏览器验收和构建检查。
- 更新 README 和部署说明。

验收：测试通过，生产构建成功，登录、学习、查词和同步主流程可用。

## 14. 风险和取舍

### 风险：当前真题元数据不完整

处理：第一期只承诺语料总次数和句子展示；年份、试卷和词义频次在有可靠标注后逐步开放。

### 风险：第三方词典接口不稳定

处理：通过 `DictionaryProvider` 适配器和 Edge Function 代理隔离供应商；本地词库和真题统计不依赖第三方接口。

### 风险：FSRS 状态跨设备冲突

处理：复习日志追加保存，卡片状态以最新有效复习事件为依据，避免直接覆盖历史。

### 风险：迁移损坏旧进度

处理：迁移前保留旧数据，迁移程序输出报告，并提供导出和回滚前的本地快照。

### 风险：公开仓库误提交私有数据

处理：用户数据只进入 Supabase；增加 `.env*`、本地导出文件和运行时缓存的忽略规则；在 CI 中加入敏感信息扫描。

## 15. 完成标准

当以下条件全部满足时，第一期重构才算完成：

- React + Vite + TypeScript 工程可以独立启动和构建。
- 原有四选一复习和 FSRS-6 行为可用。
- 原有本地学习进度能够迁移。
- 邮箱密码登录、退出和密码重置入口可用。
- 用户生词、FSRS 状态和复习日志可以云端同步。
- 断网时可以完成学习，恢复网络后可以同步。
- 查询单词或短语可以显示本地考研语料次数、例句和公共词典结果。
- 查询结果可以加入生词库并进入四选一学习。
- GitHub Actions 通过类型检查、测试和构建。
- Vercel 可以从 GitHub 自动部署。
- 源码中不存在浏览器端 GitHub Token 或私密 API key。
