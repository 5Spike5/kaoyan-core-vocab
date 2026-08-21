import { describe, expect, it } from 'vitest'
import { exportVocabWorkbook, parseVocabWorkbook } from '../../src/lib/csv'
import type { UserWord } from '../../src/types/domain'

function makeWord(term: string, meaning: string): UserWord {
  return {
    id: `word-${term}`,
    userId: 'local',
    term,
    normalizedTerm: term,
    meanings: [{ text: meaning, source: 'user' }],
    status: 'new',
    tags: ['重点'],
    notes: '例句复习',
    nextReviewAt: 1780000000000,
    createdAt: 1,
    updatedAt: 2
  }
}

describe('vocab excel round-trip', () => {
  it('exports and re-imports words with the expected columns', () => {
    const workbook = exportVocabWorkbook([makeWord('address', '处理，应对'), makeWord('fetch', '售得')])
    const result = parseVocabWorkbook(workbook)

    expect(result.imported).toHaveLength(2)
    expect(result.imported[0]).toMatchObject({ term: 'address', meaning: '处理，应对' })
    expect(result.imported[1]).toMatchObject({ term: 'fetch', meaning: '售得' })
    expect(result.skipped).toBe(0)
    expect(result.failed).toBe(0)
  })

  it('skips empty rows and rejects rows without a word', () => {
    const workbook = exportVocabWorkbook([makeWord('address', '处理，应对')])
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const header = '单词'
    const addressRow = 'address'
    const meaningHeader = '释义'

    // 追加两行：一行只有释义没有单词，一行空行
    worksheet[`A${3}`] = { t: 's', v: '' }
    worksheet[`B${3}`] = { t: 's', v: '没有单词的释义' }
    worksheet[`A${4}`] = { t: 's', v: '' }
    worksheet[`B${4}`] = { t: 's', v: '' }

    const result = parseVocabWorkbook({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: worksheet }
    } as unknown as ReturnType<typeof exportVocabWorkbook>)

    expect(result.imported).toHaveLength(1)
    expect(result.skipped).toBeGreaterThanOrEqual(2)
  })

  it('normalizes duplicate rows by term', () => {
    const workbook = exportVocabWorkbook([makeWord('address', '处理，应对'), makeWord('Address', '地址')])
    const result = parseVocabWorkbook(workbook)

    expect(result.imported).toHaveLength(1)
    expect(result.duplicates).toBe(1)
  })

  it('reports a failed row when the meaning column is missing', () => {
    const workbook = exportVocabWorkbook([makeWord('address', '处理，应对')])
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    // 覆盖表头，使“释义”列不存在
    worksheet.A1 = { t: 's', v: '单词' }
    worksheet.B1 = { t: 's', v: '' }
    worksheet.C1 = { t: 's', v: '' }
    delete worksheet.B2
    delete worksheet.C2

    const result = parseVocabWorkbook({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: worksheet }
    } as unknown as ReturnType<typeof exportVocabWorkbook>)

    expect(result.failed).toBe(1)
  })
})
