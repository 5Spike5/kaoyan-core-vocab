import { Rating, createEmptyCard, fsrs, type Card, type Grade } from 'ts-fsrs'

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export type SerializedFsrsCard = {
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

const ratingMap: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy
}

const scheduler = fsrs()

export function serializeCard(card: Card): SerializedFsrsCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString()
  }
}

export function hydrateCard(saved: SerializedFsrsCard): Card {
  return {
    due: new Date(saved.due),
    stability: saved.stability,
    difficulty: saved.difficulty,
    elapsed_days: saved.elapsed_days,
    scheduled_days: saved.scheduled_days,
    learning_steps: saved.learning_steps,
    reps: saved.reps,
    lapses: saved.lapses,
    state: saved.state,
    last_review: saved.last_review ? new Date(saved.last_review) : undefined
  }
}

export function createNewCard(now = new Date()): SerializedFsrsCard {
  return serializeCard(createEmptyCard(now))
}

export function applyRating(
  card: SerializedFsrsCard,
  rating: ReviewRating,
  now: Date
): SerializedFsrsCard {
  return serializeCard(scheduler.next(hydrateCard(card), now, ratingMap[rating]).card)
}

export function isDue(card: SerializedFsrsCard, now: Date) {
  return new Date(card.due).getTime() <= now.getTime()
}
