// 清理上次按词频导入的词条释义：仅保留首个核心中文释义。
// 规则（仅对 category 为 最高频词 / 高频词 的新词条生效，遗留词条不动）：
//   1) 从 ⚡ 处截断，丢弃全部熟词僻义注释
//   2) 再从首个次级词性标记（" v. "、" n. "、" adj. " 等）处截断，
//      保证 meaning 只剩第一词性下的中文
//   3) 去除尾部残留的标点 / 空白
//
// 用法：node scripts/clean-freq-meaning.mjs
import { readFile, writeFile } from 'node:fs/promises'
import vm from 'node:vm'

const PRIMARY_CATS = new Set(['最高频词', '高频词'])

const POS_TOKENS = [
  'modal',
  'aux',
  'prep',
  'conj',
  'pron',
  'adj',
  'adv',
  'art',
  'num',
  'vt',
  'vi',
  'v',
  'n'
]

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// " v. "、" n. "、" adj. "、" n./v. "（可能多个词性斜杠）后跟空白
// 前导用 lookbehind 允许中文 / 标点 / 空白 / 行首，但不消耗这个字符
const SECONDARY_POS_RE = new RegExp(
  `(?<=^|[^A-Za-z0-9])(?:${POS_TOKENS.map(escapeRe).join('|')})\\.(?:\\s*\\/\\s*(?:${POS_TOKENS.map(escapeRe).join('|')})\\.)*\\s+`
)

function cleanMeaning(raw) {
  let m = String(raw ?? '')

  // 1) 丢掉从 ⚡ 开始的所有内容
  const lightning = m.indexOf('⚡')
  if (lightning >= 0) m = m.slice(0, lightning)

  // 2) 丢次级词性：把所有 " POS. " 后面整段截掉（保留前面的中文核心意思）
  //    只取首个 POS 标记前的部分
  const firstSecondary = SECONDARY_POS_RE.exec(m)
  if (firstSecondary) {
    m = m.slice(0, firstSecondary.index)
  }

  // 3) 尾部残留分号 / 逗号 / 空白
  m = m.replace(/[\s;,；，]+$/, '').trim()
  return m
}

async function main() {
  const src = await readFile('data.js', 'utf8')
  const cleaned = src.replace(/^\uFEFF/, '')
  const ctx = vm.createContext(Object.create(null))
  const { VOCAB_DATA } = vm.runInContext(`${cleaned}\n;({VOCAB_DATA})`, ctx)
  if (!Array.isArray(VOCAB_DATA)) throw new Error('VOCAB_DATA must be an array')

  // 补抽：原 md 中"词性紧贴全角括号"的情况（如 `v.（~ to）归因于`），
  // 导入脚本的正则因为只认 \s+，把整段 POS 留在了释义里。这里补一次。
  const LEADING_INLINE_POS_RE = /^([a-z]+\.)(（[\s\S]+)$/i

  let touched = 0
  let emptied = 0
  const next = VOCAB_DATA.map((entry) => {
    let working = entry

    // A. 补抽被遗漏的词性
    if (!working.type && LEADING_INLINE_POS_RE.test(working.meaning)) {
      const match = working.meaning.match(LEADING_INLINE_POS_RE)
      working = {
        ...working,
        type: match[1],
        meaning: match[2]
      }
    }

    // B. 已有清理（⚡ 截断 + 次级 POS 截断 + 尾部标点）
    if (PRIMARY_CATS.has(working.category)) {
      const cleanedMeaning = cleanMeaning(working.meaning)
      if (cleanedMeaning !== working.meaning) {
        working = { ...working, meaning: cleanedMeaning }
      }
    }

    if (working.meaning !== entry.meaning || working.type !== entry.type) {
      touched += 1
      if (!working.meaning) emptied += 1
    }
    return working
  })

  console.log(`cleaned ${touched} entries; ${emptied} ended up with empty meaning (kept as-is for review)`)

  await writeFile(
    'data.js',
    `\uFEFFconst VOCAB_DATA = ${JSON.stringify(next)}\n`,
    'utf8'
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})