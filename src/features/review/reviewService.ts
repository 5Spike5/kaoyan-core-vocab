import { normalizeTerm } from '../../lib/normalizeTerm'
import type { ReviewAnswerInput, ReviewOption, ReviewRating } from './reviewTypes'

type ReviewCandidate = {
  term: string
  meaning: string
}

export function buildReviewOptions(
  current: ReviewCandidate,
  candidates: ReviewCandidate[]
): ReviewOption[] {
  const currentKey = normalizeTerm(current.term)
  const options = new Map<string, ReviewOption>()

  options.set(current.meaning, {
    meaning: current.meaning,
    sourceTerm: current.term,
    isCorrect: true
  })

  for (const candidate of candidates) {
    if (options.size >= 4) {
      break
    }

    if (normalizeTerm(candidate.term) === currentKey || !candidate.meaning.trim()) {
      continue
    }

    options.set(candidate.meaning, {
      meaning: candidate.meaning,
      sourceTerm: candidate.term,
      isCorrect: false
    })
  }

  if (options.size < 4) {
    throw new Error('At least four distinct review options are required')
  }

  return Array.from(options.values()).slice(0, 4)
}

export function rateReviewAnswer(input: ReviewAnswerInput): ReviewRating {
  if (!input.correct) {
    return 'again'
  }

  if (input.attempts > 1) {
    return 'hard'
  }

  return 'good'
}
