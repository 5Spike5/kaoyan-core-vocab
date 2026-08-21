import * as XLSX from 'xlsx'
import { normalizeTerm } from './normalizeTerm'
import type { UserWord, UserWordStatus } from '../types/domain'

const EXPORT_HEADERS = ['单词', '词性', '释义', '状态', '下次复习时间', '笔记', '标签'] as const

const STATUS_LABELS: Record<UserWordStatus, string> = {
  new: '新词',
  learning: '学习中',
  reviewing: '复习中',
  mastered: '已掌握',
  suspended: '暂停'
}

export type ImportedVocabRow = {
  term: string
  meaning: string
}

export type VocabImportResult = {
  imported: ImportedVocabRow[]
  skipped: number
  failed: number
  duplicates: number
  errors: string[]
}

function statusLabel(status: UserWordStatus) {
  return STATUS_LABELS[status] ?? status
}

function rowValue(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })]
  if (cell == null) {
    return ''
  }
  const value = cell.v
  if (value == null) {
    return ''
  }
  return String(value).trim()
}

/** 计算实际数据范围：合并 !ref 与所有已写入单元格的行列。 */
function effectiveRange(sheet: XLSX.WorkSheet): { minRow: number; maxRow: number; maxCol: number } {
  let minRow = 0
  let maxRow = 0
  let maxCol = 0

  if (sheet['!ref']) {
    const range = XLSX.utils.decode_range(sheet['!ref'])
    minRow = range.s.r
    maxRow = range.e.r
    maxCol = range.e.c
  }

  for (const key of Object.keys(sheet)) {
    const match = /^([A-Z]+)(\d+)$/.exec(key)
    if (!match) {
      continue
    }
    const col = XLSX.utils.decode_col(match[1])
    const row = Number(match[2]) - 1
    if (row > maxRow) {
      maxRow = row
    }
    if (col > maxCol) {
      maxCol = col
    }
  }

  return { minRow, maxRow, maxCol }
}

function findColumn(headers: string[], names: string[]): number {
  const lower = headers.map((header) => header.toLowerCase())
  for (const name of names) {
    const index = lower.indexOf(name.toLowerCase())
    if (index !== -1) {
      return index
    }
  }
  return -1
}

export function parseVocabWorkbook(workbook: XLSX.WorkBook): VocabImportResult {
  const result: VocabImportResult = { imported: [], skipped: 0, failed: 0, duplicates: 0, errors: [] }
  const sheetName = workbook.SheetNames[0]

  if (!sheetName) {
    result.errors.push('工作簿中没有工作表')
    return result
  }

  const sheet = workbook.Sheets[sheetName]
  const { minRow, maxRow, maxCol } = effectiveRange(sheet)

  if (maxRow < minRow) {
    result.errors.push('工作表为空')
    return result
  }

  const headers: string[] = []
  for (let col = 0; col <= maxCol; col += 1) {
    headers.push(rowValue(sheet, minRow, col))
  }

  const wordCol = findColumn(headers, ['单词', 'word', 'term'])
  const meaningCol = findColumn(headers, ['释义', 'meaning'])

  if (wordCol === -1) {
    result.errors.push('缺少"单词"列')
    return result
  }

  const seenTerms = new Set<string>()

  for (let row = minRow + 1; row <= maxRow; row += 1) {
    const word = wordCol <= maxCol ? rowValue(sheet, row, wordCol) : ''
    const meaning = meaningCol !== -1 && meaningCol <= maxCol ? rowValue(sheet, row, meaningCol) : ''

    if (!word) {
      result.skipped += 1
      continue
    }

    if (!meaning) {
      result.failed += 1
      continue
    }

    const normalized = normalizeTerm(word)
    if (seenTerms.has(normalized)) {
      result.duplicates += 1
      continue
    }

    seenTerms.add(normalized)
    result.imported.push({ term: word, meaning })
  }

  return result
}

export function exportVocabWorkbook(words: UserWord[]): XLSX.WorkBook {
  const rows: string[][] = [EXPORT_HEADERS as unknown as string[]]

  for (const word of words) {
    const meaning = word.meanings.map((item) => item.text).join('；')
    rows.push([
      word.term,
      word.meanings[0]?.senseLabel ?? '',
      meaning,
      statusLabel(word.status),
      word.nextReviewAt ? new Date(word.nextReviewAt).toISOString() : '',
      word.notes ?? '',
      word.tags.join('，')
    ])
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '生词库')

  return workbook
}

export function downloadVocabWorkbook(words: UserWord[], filename = `生词库-${new Date().toISOString().slice(0, 10)}.xlsx`) {
  const workbook = exportVocabWorkbook(words)
  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function readVocabWorkbookFile(file: File): Promise<VocabImportResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  return parseVocabWorkbook(workbook)
}
