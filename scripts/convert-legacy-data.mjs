import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = process.cwd()

export function normalizeLegacyTerm(term) {
  return String(term).trim().toLowerCase().replace(/\s+/g, ' ')
}

export function toPublicEntry(raw, index, duplicateNumber = 0) {
  const term = String(raw.word ?? '').trim()
  if (!term) {
    throw new Error(`Missing word at index ${index}`)
  }

  const normalizedTerm = normalizeLegacyTerm(term)

  return {
    key: duplicateNumber > 0 ? `${normalizedTerm}#${duplicateNumber + 1}` : normalizedTerm,
    term,
    normalizedTerm,
    partOfSpeech: raw.type || undefined,
    meanings: raw.meaning ? [{ text: String(raw.meaning), source: 'curated' }] : [],
    category: raw.category || '核心词',
    source: 'legacy-data.js'
  }
}

function readDeclarations(source, names) {
  const context = vm.createContext(Object.create(null))
  const expression = `\n;({${names.join(',')}})`
  const result = vm.runInContext(`${source}${expression}`, context, {
    timeout: 1_000
  })

  for (const name of names) {
    if (result[name] === undefined) {
      throw new Error(`Missing declaration: ${name}`)
    }
  }

  return result
}

function ensureArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`)
  }
  return value
}

function ensureObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

function toModule(items, exportName, typeName, typeImport) {
  return [
    `import type { ${typeName} } from '${typeImport}'`,
    '',
    `export const ${exportName} = ${JSON.stringify(items, null, 2)} satisfies ${typeName}[]`,
    ''
  ].join('\n')
}

function buildPublicVocab(rawVocab) {
  const seen = new Map()

  return rawVocab.map((raw, index) => {
    const normalizedTerm = normalizeLegacyTerm(raw?.word ?? '')
    const duplicateNumber = seen.get(normalizedTerm) ?? 0
    seen.set(normalizedTerm, duplicateNumber + 1)
    return toPublicEntry(raw, index, duplicateNumber)
  })
}

function buildExamExamples(sentences, translations) {
  return sentences.map((sentence, index) => {
    const text = String(sentence)
    const translation = translations[text]

    return {
      id: `exam-sentence-${String(index + 1).padStart(4, '0')}`,
      sentence: text,
      translation: typeof translation === 'string' ? translation : undefined,
      source: 'legacy-sentences.js'
    }
  })
}

function buildSenseOccurrences(wordExamples) {
  return Object.entries(wordExamples)
    .flatMap(([term, sentences]) => {
      if (!Array.isArray(sentences)) {
        return []
      }

      const normalizedTerm = normalizeLegacyTerm(term)
      return sentences.map((sentence, index) => ({
        id: `${normalizedTerm}-${index + 1}`,
        term,
        normalizedTerm,
        sentence: String(sentence),
        source: 'legacy-word-examples'
      }))
    })
    .sort((left, right) => left.id.localeCompare(right.id))
}

async function writeGeneratedModule(path, content) {
  const target = resolve(root, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content, 'utf8')
}

export async function convertLegacyData() {
  const dataSource = await readFile(resolve(root, 'data.js'), 'utf8')
  const sentencesSource = await readFile(resolve(root, 'sentences.js'), 'utf8')

  const { VOCAB_DATA } = readDeclarations(dataSource, ['VOCAB_DATA'])
  const { EXAM_SENTENCES, SENTENCE_TRANSLATIONS, WORD_EXAMPLES } = readDeclarations(sentencesSource, [
    'EXAM_SENTENCES',
    'SENTENCE_TRANSLATIONS',
    'WORD_EXAMPLES'
  ])

  const publicVocab = buildPublicVocab(ensureArray(VOCAB_DATA, 'VOCAB_DATA'))
  const examExamples = buildExamExamples(
    ensureArray(EXAM_SENTENCES, 'EXAM_SENTENCES'),
    ensureObject(SENTENCE_TRANSLATIONS, 'SENTENCE_TRANSLATIONS')
  )
  const examSenseOccurrences = buildSenseOccurrences(ensureObject(WORD_EXAMPLES, 'WORD_EXAMPLES'))

  await writeGeneratedModule(
    'src/data/publicVocab.ts',
    toModule(publicVocab, 'publicVocab', 'PublicVocabEntry', '../types/domain')
  )
  await writeGeneratedModule(
    'src/data/examExamples.ts',
    toModule(examExamples, 'examExamples', 'ExamExample', '../types/domain')
  )
  await writeGeneratedModule(
    'src/data/examSenseOccurrences.ts',
    toModule(examSenseOccurrences, 'examSenseOccurrences', 'ExamSenseOccurrence', '../types/domain')
  )

  return {
    publicVocabCount: publicVocab.length,
    examExampleCount: examExamples.length,
    examSenseOccurrenceCount: examSenseOccurrences.length
  }
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  convertLegacyData()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2))
    })
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}
