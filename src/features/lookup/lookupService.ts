import { searchExamCorpus } from '../../data/corpusIndex'
import { publicVocab } from '../../data/publicVocab'
import { normalizeTerm } from '../../lib/normalizeTerm'
import type { WordLookupResult } from './lookupTypes'

export function lookupLocalWord(term: string): WordLookupResult {
  const normalizedTerm = normalizeTerm(term)
  const publicEntry = publicVocab.find((entry) => entry.normalizedTerm === normalizedTerm)
  const corpus = searchExamCorpus(normalizedTerm)

  return {
    term: term.trim(),
    normalizedTerm,
    publicEntry,
    partsOfSpeech: publicEntry
      ? [
          {
            label: publicEntry.partOfSpeech ?? '',
            meanings: publicEntry.meanings.map((item) => item.text)
          }
        ]
      : [],
    examStats: {
      totalOccurrences: corpus.totalOccurrences,
      exampleCount: corpus.exampleCount,
      taggedSenseCounts: []
    },
    examples: corpus.examples,
    suggestions: [],
    sourceStatus: {
      localCorpus: corpus.totalOccurrences > 0 ? 'hit' : 'miss',
      dictionary: 'miss'
    }
  }
}
