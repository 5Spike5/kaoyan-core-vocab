// 从按词频排序的 Markdown 词表导入「最高频词（★★★★★）」和「高频词（★★★★）」
// 到 data.js 的 VOCAB_DATA（与现有词条去重），之后需运行 convert-legacy-data.mjs 重新生成
// src/data/publicVocab.ts。
//
// 用法：node scripts/import-freq-vocab.mjs <词表.md 路径>
import { readFile, writeFile } from 'node:fs/promises'
import vm from 'node:vm'

const root = process.cwd()
const mdPath = process.argv[2]
if (!mdPath) {
  console.error('Usage: node scripts/import-freq-vocab.mjs <markdown-vocab.md>')
  process.exit(1)
}

const SECTIONS = new Map([
  ['一、最高频词', '最高频词'],
  ['二、高频词', '高频词']
])

// 词性前缀，如 v. / n. / adj. / n./v. / n./adj.
const POS_RE =
  /^((?:n|v|adj|adv|prep|conj|pron|art|num|aux|vi|vt|modal)\.(?:\s*\/\s*(?:n|v|adj|adv|prep|conj|pron|art|num|aux|vi|vt|modal)\.)*)\s+/

function normalizeTerm(term) {
  return String(term).trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseMarkdown(markdown) {
  const entries = []
  let currentSection = null

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim()
    const heading = line.match(/^##\s+(.*)$/)
    if (heading) {
      currentSection = null
      for (const key of SECTIONS.keys()) {
        if (heading[1].includes(key)) {
          currentSection = key
          break
        }
      }
      continue
    }

    if (!currentSection) continue
    const entry = line.match(/^- \*\*(.+?)\*\*\s*(.*)$/)
    if (!entry) continue

    const term = entry[1].trim()
    const rest = entry[2].replace(/\s*｜\s*/g, '；').trim()
    const pos = rest.match(POS_RE)
    const type = pos ? pos[1].replace(/\s+/g, '') : ''
    const meaning = pos ? rest.slice(pos[0].length) : rest

    entries.push({ word: term, type, meaning, category: SECTIONS.get(currentSection) })
  }

  return entries
}

async function readVocabData() {
  const source = await readFile(`${root}/data.js`, 'utf8')
  const cleaned = source.replace(/^\uFEFF/, '')
  const { VOCAB_DATA } = vm.runInNewContext(`${cleaned}\n;({VOCAB_DATA})`)
  if (!Array.isArray(VOCAB_DATA)) {
    throw new Error('VOCAB_DATA must be an array')
  }
  return VOCAB_DATA
}

const existing = await readVocabData()
const existingTerms = new Set(existing.map((item) => normalizeTerm(item?.word ?? '')))

const parsed = parseMarkdown(await readFile(mdPath, 'utf8'))
console.log(`parsed entries from sections 一/二: ${parsed.length}`)

const added = []
const seen = new Set()
let dupInternal = 0
let dupExisting = 0

for (const entry of parsed) {
  const key = normalizeTerm(entry.word)
  if (seen.has(key)) {
    dupInternal += 1
    continue
  }
  if (existingTerms.has(key)) {
    dupExisting += 1
    continue
  }
  seen.add(key)
  added.push(entry)
}

console.log(`duplicates within import: ${dupInternal}`)
console.log(`duplicates vs existing data.js: ${dupExisting}`)
console.log(`new entries to add: ${added.length}`)

if (added.length === 0) {
  console.log('nothing to add; data.js left unchanged')
  process.exit(0)
}

const merged = [...existing, ...added]
const mergedSource = `\uFEFFconst VOCAB_DATA = ${JSON.stringify(merged)}`
await writeFile(`${root}/data.js`, `${mergedSource}\n`, 'utf8')
console.log(`data.js updated: ${existing.length} -> ${merged.length} entries`)
