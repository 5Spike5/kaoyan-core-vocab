import { searchExamCorpus } from '../../data/corpusIndex'
import { publicVocab } from '../../data/publicVocab'
import { normalizeTerm } from '../../lib/normalizeTerm'
import { DictionaryNotFoundError } from './dictionaryProvider'
import type {
  DictionaryProvider,
  DictionaryResult,
  PartOfSpeechGroup,
  WordLookupResult
} from './lookupTypes'

/** 释义文本上限：过长的词典释义会撑爆选项卡片，截断并加省略号。 */
export const LOOKUP_MEANING_MAX_LENGTH = 120

function joinMeanings(meanings: string[]): string {
  return meanings.map((text) => text.trim()).filter(Boolean).join('；')
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`
}

/** 公共词典（有道优先，英文词典兜底）的释义文本，保留词性前缀。 */
function dictionaryMeaning(groups?: PartOfSpeechGroup[]): string {
  if (!Array.isArray(groups) || groups.length === 0) {
    return ''
  }

  return groups
    .map((group) => {
      const meanings = joinMeanings(group.meanings ?? [])
      if (!meanings) {
        return ''
      }
      return group.label ? `${group.label} ${meanings}` : meanings
    })
    .filter(Boolean)
    .join('；')
}

/** 只从公共词典结果里取释义（补全历史空释义词时用）。 */
export function meaningFromDictionary(
  dictionary: DictionaryResult | undefined,
  maxLength = LOOKUP_MEANING_MAX_LENGTH
): string {
  return truncate(dictionaryMeaning(dictionary?.partsOfSpeech), maxLength)
}

/**
 * 取一份能用于背诵的释义。
 * 优先级：本地核心词库（人工校对的中文释义）→ 公共词典 → 已解析的词性分组。
 * 三者都没有时返回空串，调用方应拒绝入库（空释义的词进不了学习队列）。
 */
export function meaningFromLookupResult(
  result: WordLookupResult,
  maxLength = LOOKUP_MEANING_MAX_LENGTH
): string {
  const curated = joinMeanings(result.publicEntry?.meanings.map((item) => item.text) ?? [])
  const fromDictionary = dictionaryMeaning(result.dictionary?.partsOfSpeech)
  const fromGroups = dictionaryMeaning(result.partsOfSpeech)
  return truncate(curated || fromDictionary || fromGroups, maxLength)
}

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
