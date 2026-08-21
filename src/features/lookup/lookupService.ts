import { searchExamCorpus } from '../../data/corpusIndex'
import { publicVocab } from '../../data/publicVocab'
import { normalizeTerm } from '../../lib/normalizeTerm'
import { DictionaryNotFoundError } from './dictionaryProvider'
import type { DictionaryProvider, WordLookupResult } from './lookupTypes'

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

/**
 * 用公共词典结果增强本地查询结果。
 * 词典服务失败或未命中时不影响本地结果，只更新来源状态。
 */
export async function enrichLookupWithDictionary(
  result: WordLookupResult,
  provider: DictionaryProvider
): Promise<WordLookupResult> {
  try {
    const dictionary = await provider.lookup(result.normalizedTerm)

    if (!dictionary.term) {
      return { ...result, sourceStatus: { ...result.sourceStatus, dictionary: 'miss' } }
    }

    return {
      ...result,
      phonetic: result.phonetic ?? dictionary.phonetic,
      audioUrl: result.audioUrl ?? dictionary.audioUrl,
      dictionary,
      sourceStatus: { ...result.sourceStatus, dictionary: 'hit' }
    }
  } catch (error) {
    if (error instanceof DictionaryNotFoundError) {
      return { ...result, sourceStatus: { ...result.sourceStatus, dictionary: 'miss' } }
    }
    return { ...result, sourceStatus: { ...result.sourceStatus, dictionary: 'error' } }
  }
}
