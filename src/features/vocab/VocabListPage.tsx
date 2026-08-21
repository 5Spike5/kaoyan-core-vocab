import { Download, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { publicVocab } from '../../data/publicVocab'
import { downloadVocabWorkbook, readVocabWorkbookFile, type VocabImportResult } from '../../lib/csv'
import { createLocalRepository } from '../../repositories/localRepository'
import type { UserWord, UserWordStatus } from '../../types/domain'
import { createUserWordFromLookup, mergePublicAndUserWords } from './vocabService'

const LOCAL_USER_ID = 'local'

const STATUS_FILTERS: Array<{ value: UserWordStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'new', label: '新词' },
  { value: 'learning', label: '学习中' },
  { value: 'reviewing', label: '复习中' },
  { value: 'mastered', label: '已掌握' },
  { value: 'suspended', label: '暂停' }
]

const STATUS_LABELS: Record<UserWordStatus, string> = {
  new: '新词',
  learning: '学习中',
  reviewing: '复习中',
  mastered: '已掌握',
  suspended: '暂停'
}

type ImportNotice = {
  kind: 'success' | 'error'
  message: string
}

export default function VocabListPage() {
  const [words, setWords] = useState<UserWord[]>([])
  const [statusFilter, setStatusFilter] = useState<UserWordStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<ImportNotice | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadWords = useCallback(async () => {
    const repository = createLocalRepository()
    try {
      const userWords = await repository.listUserWords(LOCAL_USER_ID)
      setWords(mergePublicAndUserWords(publicVocab, userWords))
    } finally {
      await repository.close()
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadWords()
  }, [loadWords])

  const filteredWords = useMemo(() => {
    const query = search.trim().toLowerCase()
    return words.filter((word) => {
      const matchesStatus = statusFilter === 'all' || word.status === statusFilter
      if (!matchesStatus) {
        return false
      }
      if (!query) {
        return true
      }
      const meaningText = word.meanings.map((item) => item.text).join(' ')
      return word.term.toLowerCase().includes(query) || meaningText.toLowerCase().includes(query)
    })
  }, [words, statusFilter, search])

  const handleExport = useCallback(() => {
    downloadVocabWorkbook(filteredWords)
  }, [filteredWords])

  const handleImportFile = useCallback(
    async (file: File) => {
      let result: VocabImportResult
      try {
        result = await readVocabWorkbookFile(file)
      } catch (error) {
        setNotice({ kind: 'error', message: `导入失败：${error instanceof Error ? error.message : '无法解析文件'}` })
        return
      }

      if (result.imported.length === 0) {
        setNotice({
          kind: 'error',
          message: `没有可导入的词条（跳过 ${result.skipped}，失败 ${result.failed}，重复 ${result.duplicates}）`
        })
        return
      }

      const repository = createLocalRepository()
      try {
        for (const row of result.imported) {
          await repository.upsertUserWord(createUserWordFromLookup({ term: row.term, meaning: row.meaning }))
        }
        await loadWords()
        setNotice({
          kind: 'success',
          message: `导入成功 ${result.imported.length} 条${result.skipped ? `，跳过 ${result.skipped} 条` : ''}${result.duplicates ? `，重复 ${result.duplicates} 条` : ''}${result.failed ? `，失败 ${result.failed} 条` : ''}`
        })
      } finally {
        await repository.close()
      }
    },
    [loadWords]
  )

  return (
    <section className="page vocab-page" aria-labelledby="vocab-title">
      <div className="page-heading">
        <p className="eyebrow">VOCABULARY</p>
        <h1 id="vocab-title">生词库</h1>
        <p className="lede">公开核心词库与个人生词合并展示，支持搜索、筛选、Excel 导入和导出。</p>
      </div>

      <div className="vocab-toolbar">
        <input
          type="search"
          className="vocab-search"
          aria-label="搜索生词"
          placeholder="搜索单词或释义"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="filter-row" role="group" aria-label="状态筛选">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`filter-chip ${statusFilter === filter.value ? 'filter-chip-active' : ''}`}
              aria-pressed={statusFilter === filter.value}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="vocab-actions">
          <button type="button" className="button button-secondary" onClick={handleExport}>
            <Download size={16} aria-hidden="true" />
            导出 Excel
          </button>
          <button type="button" className="button button-secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            导入
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden-file-input"
            aria-label="选择 Excel 文件"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleImportFile(file)
              }
              event.target.value = ''
            }}
          />
        </div>
      </div>

      {notice ? (
        <p role="status" className={`import-notice import-notice-${notice.kind}`}>
          {notice.message}
        </p>
      ) : null}

      {loading ? (
        <p className="page-note">正在加载生词库…</p>
      ) : (
        <ul className="vocab-list" aria-label="生词列表">
          {filteredWords.map((word, index) => (
            <li key={`${word.normalizedTerm}-${index}`} className="vocab-row">
              <div className="vocab-row-main">
                <strong>{word.term}</strong>
                <span className="vocab-meaning">{word.meanings.map((item) => item.text).join('；')}</span>
              </div>
              <span className={`status-badge status-${word.status}`}>{STATUS_LABELS[word.status]}</span>
            </li>
          ))}
        </ul>
      )}

      {!loading && filteredWords.length === 0 ? (
        <p className="page-note">没有符合条件的单词。</p>
      ) : null}
    </section>
  )
}
