export type MeaningSource = 'curated' | 'dictionary' | 'user'

export type WordMeaning = {
  text: string
  source: MeaningSource
  senseLabel?: string
}

export type PublicVocabEntry = {
  key: string
  term: string
  normalizedTerm: string
  partOfSpeech?: string
  meanings: WordMeaning[]
  category: string
  source: string
}

export type ExamExample = {
  id: string
  sentence: string
  translation?: string
  source: string
}

export type ExamSenseOccurrence = {
  id: string
  term: string
  normalizedTerm: string
  sentence: string
  source: string
}

export type FsrsSnapshot = {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: string
}

export type UserWordStatus = 'new' | 'learning' | 'reviewing' | 'mastered' | 'suspended'

export type UserWord = {
  id: string
  userId: string
  term: string
  normalizedTerm: string
  meanings: WordMeaning[]
  status: UserWordStatus
  sourceVocabKey?: string
  notes?: string
  tags: string[]
  fsrs?: FsrsSnapshot
  nextReviewAt: number | null
  createdAt: number
  updatedAt: number
}

export type ReviewRating = 1 | 2 | 3 | 4

export type ReviewLog = {
  id: string
  userId: string
  wordId: string
  normalizedTerm: string
  rating: ReviewRating
  answeredCorrectly: boolean
  reviewedAt: number
  elapsedMs: number
}

export type StudySession = {
  id: string
  userId: string
  mode: 'new' | 'due' | 'wrong' | 'free'
  wordIds: string[]
  currentIndex: number
  startedAt: number
  completedAt: number | null
}
