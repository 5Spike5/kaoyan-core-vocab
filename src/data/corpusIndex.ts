import { examExamples } from './examExamples'
import type { ExamExample } from '../types/domain'

export type CorpusSearchResult = {
  totalOccurrences: number
  exampleCount: number
  examples: ExamExample[]
}

const MAX_VISIBLE_EXAMPLES = 20

function normalizeCorpusText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countWordMatches(text: string, term: string) {
  const matcher = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi')
  return text.match(matcher)?.length ?? 0
}

function countPhraseMatches(text: string, phrase: string) {
  let count = 0
  let fromIndex = 0

  while (fromIndex < text.length) {
    const index = text.indexOf(phrase, fromIndex)
    if (index === -1) {
      break
    }
    count += 1
    fromIndex = index + phrase.length
  }

  return count
}

export function searchExamCorpus(term: string): CorpusSearchResult {
  const normalizedTerm = normalizeCorpusText(term)

  if (!normalizedTerm) {
    return { totalOccurrences: 0, exampleCount: 0, examples: [] }
  }

  const isPhrase = normalizedTerm.includes(' ')
  let totalOccurrences = 0
  const examples: ExamExample[] = []
  const seenIds = new Set<string>()

  for (const example of examExamples) {
    const normalizedSentence = normalizeCorpusText(example.sentence)
    const occurrences = isPhrase
      ? countPhraseMatches(normalizedSentence, normalizedTerm)
      : countWordMatches(normalizedSentence, normalizedTerm)

    if (occurrences === 0) {
      continue
    }

    totalOccurrences += occurrences

    if (!seenIds.has(example.id)) {
      seenIds.add(example.id)
      if (examples.length < MAX_VISIBLE_EXAMPLES) {
        examples.push(example)
      }
    }
  }

  return {
    totalOccurrences,
    exampleCount: seenIds.size,
    examples
  }
}
