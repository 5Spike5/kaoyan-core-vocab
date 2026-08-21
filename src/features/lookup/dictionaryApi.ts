import { normalizeTerm } from '../../lib/normalizeTerm'
import { createLocalDb } from '../../repositories/localDb'
import type { DictionaryProvider, DictionaryResult } from './lookupTypes'

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export async function lookupWithCache(term: string, provider: DictionaryProvider): Promise<DictionaryResult> {
  const db = createLocalDb()
  try {
    const key = normalizeTerm(term)
    const cached = await db.queryCache.get(key)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload as DictionaryResult
    }

    const result = await provider.lookup(term)
    await db.queryCache.put({
      normalizedQuery: key,
      payload: result,
      createdAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS
    })
    return result
  } finally {
    db.close()
  }
}
