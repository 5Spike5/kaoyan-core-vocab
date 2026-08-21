export type LegacyStorageSnapshot = {
  currentUser: string | null
  customVocab: unknown[]
  progressRecords: Array<{ key: string; value: unknown }>
  sessions: Array<{ key: string; value: unknown }>
}

function parseJson(value: string | null) {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function readJsonArray(storage: Storage, keys: string[]) {
  for (const key of keys) {
    const parsed = parseJson(storage.getItem(key))
    if (Array.isArray(parsed)) {
      return parsed
    }
  }

  return []
}

export function readLegacyStorage(storage: Storage = window.localStorage): LegacyStorageSnapshot {
  const progressRecords: Array<{ key: string; value: unknown }> = []
  const sessions: Array<{ key: string; value: unknown }> = []

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key) {
      continue
    }

    const parsed = parseJson(storage.getItem(key))

    if (key.startsWith('wordProgress:') || key.startsWith('vocabProgress:')) {
      progressRecords.push({ key, value: parsed })
    }

    if (key.startsWith('studySession:') || key.startsWith('reviewSession:')) {
      sessions.push({ key, value: parsed })
    }
  }

  return {
    currentUser: storage.getItem('currentUser') ?? storage.getItem('kaoyan.currentUser'),
    customVocab: readJsonArray(storage, ['customVocab', 'customVocabulary', 'kaoyan.customVocab']),
    progressRecords,
    sessions
  }
}
