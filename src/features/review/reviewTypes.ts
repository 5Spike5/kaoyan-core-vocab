import type { ReviewRating } from '../../lib/fsrs'

export type ReviewOption = {
  meaning: string
  sourceTerm: string
  isCorrect: boolean
}

export type ReviewAnswerInput = {
  correct: boolean
  attempts: number
}

export type { ReviewRating }
