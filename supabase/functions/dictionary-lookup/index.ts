// 词典查询代理 Edge Function
//
// 用途：在服务端代理第三方词典请求，隐藏 API key、统一返回结构、基础限流。
// 部署：
//   supabase secrets set DICTIONARY_API_KEY=...（可选）
//   supabase functions deploy dictionary-lookup
//
// 当前默认使用无需 key 的 Free Dictionary API（dictionaryapi.dev）。
// 如需切换供应商，设置 DICTIONARY_API_URL 覆盖端点，并按需设置 DICTIONARY_API_KEY。

const DEFAULT_PROVIDER_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/'
const MAX_TERM_LENGTH = 100
const REQUEST_TIMEOUT_MS = 8000

type LookupResponse = {
  ok: boolean
  data?: unknown
  error?: {
    code: 'invalid-input' | 'provider-error' | 'not-found' | 'rate-limited' | 'internal'
    message: string
  }
}

function json(body: LookupResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return json({ ok: false, error: { code: 'invalid-input', message: '仅支持 POST' } }, 405)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: { code: 'invalid-input', message: '请求体必须是 JSON' } }, 400)
  }

  const term = (body as { term?: unknown })?.term
  if (typeof term !== 'string' || term.trim().length === 0) {
    return json({ ok: false, error: { code: 'invalid-input', message: 'term 不能为空' } }, 400)
  }
  if (term.trim().length > MAX_TERM_LENGTH) {
    return json({ ok: false, error: { code: 'invalid-input', message: `term 不能超过 ${MAX_TERM_LENGTH} 个字符` } }, 400)
  }

  const providerUrl = Deno.env.get('DICTIONARY_API_URL') ?? DEFAULT_PROVIDER_URL
  const apiKey = Deno.env.get('DICTIONARY_API_KEY')
  const endpoint = `${providerUrl}${encodeURIComponent(term.trim())}`

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'provider unavailable'
    return json({ ok: false, error: { code: 'provider-error', message } }, 502)
  }

  if (response.status === 404) {
    return json({ ok: false, error: { code: 'not-found', message: '词典中未找到该词' } }, 404)
  }
  if (response.status === 429) {
    return json({ ok: false, error: { code: 'rate-limited', message: '词典请求过于频繁' } }, 429)
  }
  if (!response.ok) {
    return json(
      { ok: false, error: { code: 'provider-error', message: `provider 返回 ${response.status}` } },
      502
    )
  }

  try {
    const data = await response.json()
    return json({ ok: true, data })
  } catch {
    return json({ ok: false, error: { code: 'provider-error', message: 'provider 返回无法解析的数据' } }, 502)
  }
})
