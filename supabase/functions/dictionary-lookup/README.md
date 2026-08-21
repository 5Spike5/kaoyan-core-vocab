# dictionary-lookup Edge Function

在服务端代理公共词典查询，隐藏第三方 API key、统一返回结构。

## 本地开发

```bash
# 若使用需要 key 的词典供应商（可选）
supabase secrets set DICTIONARY_API_KEY=your-key

# 本地启动函数
supabase functions serve dictionary-lookup

# 测试
curl -X POST http://localhost:54321/functions/v1/dictionary-lookup \
  -H "Content-Type: application/json" \
  -d '{"term":"address"}'
```

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `DICTIONARY_API_URL` | 词典供应商端点前缀 | `https://api.dictionaryapi.dev/api/v2/entries/en/` |
| `DICTIONARY_API_KEY` | 可选，供应商 API key | 无 |

默认使用 Free Dictionary API（免 key）。切换供应商时，前端 `dictionaryProvider.ts` 的响应映射需要同步调整。

## 部署

```bash
supabase secrets set DICTIONARY_API_KEY=...
supabase functions deploy dictionary-lookup
```

## 请求 / 响应

```bash
POST { "term": "address" }
```

- `200` → `{ "ok": true, "data": <供应商原始数据> }`
- `400` → term 缺失或超过 100 字符
- `404` → 词典未找到
- `429` → 触发限流
- `502` → 供应商不可用或返回异常

前端从不直接接触供应商 key；供应商 key 只存在于 Supabase secrets 中。
