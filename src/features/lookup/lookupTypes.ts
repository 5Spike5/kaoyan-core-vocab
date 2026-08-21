import type { ExamExample, PublicVocabEntry } from '../../types/domain'

export type PartOfSpeechGroup = {
  label: string
  meanings: string[]
}

export type WordLookupResult = {
  term: string
  normalizedTerm: string
  phonetic?: string
  audioUrl?: string
  partsOfSpeech: PartOfSpeechGroup[]
  publicEntry?: PublicVocabEntry
  dictionary?: DictionaryResult
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

export type DictionaryResult = {
  term: string
  phonetic?: string
  audioUrl?: string
  partsOfSpeech: PartOfSpeechGroup[]
  source: string
}

export type DictionaryProvider = {
  lookup(term: string): Promise<DictionaryResult>
}
