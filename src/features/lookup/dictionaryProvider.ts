import type { DictionaryProvider, DictionaryResult, PartOfSpeechGroup } from './lookupTypes'

const FREE_DICTIONARY_ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en/'

export class DictionaryNotFoundError extends Error {
  constructor(term: string) {
    super(`词典中未找到「${term}」`)
    this.name = 'DictionaryNotFoundError'
  }
}

export class DictionaryServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DictionaryServiceError'
  }
}

type FreeDictionaryDefinition = {
  definition?: string
}

type FreeDictionaryMeaning = {
  partOfSpeech?: string
  definitions?: FreeDictionaryDefinition[]
}

type FreeDictionaryEntry = {
  word?: string
  phonetic?: string
  phonetics?: Array<{ text?: string; audio?: string }>
  meanings?: FreeDictionaryMeaning[]
}

function firstAudio(entry: FreeDictionaryEntry): string | undefined {
  const audio = entry.phonetics?.find((item) => item.audio)
  return audio?.audio
}

function mapEntry(entry: FreeDictionaryEntry): DictionaryResult {
  const groups: PartOfSpeechGroup[] = []

  for (const meaning of entry.meanings ?? []) {
    const definitions = (meaning.definitions ?? [])
      .map((item) => item.definition?.trim())
      .filter((item): item is string => Boolean(item))

    if (!meaning.partOfSpeech && definitions.length === 0) {
      continue
    }

    const existing = groups.find((group) => group.label === (meaning.partOfSpeech ?? ''))
    if (existing) {
      existing.meanings.push(...definitions)
    } else {
      groups.push({ label: meaning.partOfSpeech ?? '', meanings: definitions })
    }
  }

  return {
    term: entry.word ?? '',
    phonetic: entry.phonetic,
    audioUrl: firstAudio(entry),
    partsOfSpeech: groups,
    source: 'dictionaryapi.dev'
  }
}

export function createDictionaryProvider(fetcher: typeof fetch = fetch): DictionaryProvider {
  return {
    async lookup(term: string) {
      const endpoint = `${FREE_DICTIONARY_ENDPOINT}${encodeURIComponent(term.trim())}`

      let response: Response
      try {
        response = await fetcher(endpoint, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8000)
        })
      } catch (error) {
        throw new DictionaryServiceError(
          `词典服务不可用：${error instanceof Error ? error.message : '网络错误'}`
        )
      }

      if (response.status === 404) {
        throw new DictionaryNotFoundError(term)
      }

      if (!response.ok) {
        throw new DictionaryServiceError(`词典服务返回异常状态：${response.status}`)
      }

      let payload: FreeDictionaryEntry | FreeDictionaryEntry[]
      try {
        payload = (await response.json()) as FreeDictionaryEntry | FreeDictionaryEntry[]
      } catch {
        throw new DictionaryServiceError('词典服务返回了无法解析的数据')
      }

      const entries = Array.isArray(payload) ? payload : [payload]
      const entry = entries.find((item) => item.word) ?? entries[0]

      if (!entry) {
        return { term: '', partsOfSpeech: [], source: 'dictionaryapi.dev' }
      }

      return mapEntry(entry)
    }
  }
}
