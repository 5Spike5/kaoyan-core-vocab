import { ArrowLeft, ArrowRight, CheckCircle2, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchExamCorpus } from '../../data/corpusIndex'
import { createLocalRepository } from '../../repositories/localRepository'
import { buildReviewOptions, rateReviewAnswer } from './reviewService'
import type { ReviewOption } from './reviewTypes'

type ReviewCard = {
  id: string
  term: string
  meaning: string
}

const sampleCards: ReviewCard[] = [
  { id: 'address', term: 'address', meaning: '处理，应对' },
  { id: 'account-for', term: 'account for', meaning: '占比，占据' }
]

const optionCandidates = [
  { term: 'address', meaning: '处理，应对' },
  { term: 'fetch', meaning: '售得' },
  { term: 'bid', meaning: '出价' },
  { term: 'peak', meaning: '顶峰' },
  { term: 'account for', meaning: '占比，占据' },
  { term: 'crucial', meaning: '至关重要的' }
]

function orderOptions(options: ReviewOption[], term: string) {
  const offset = term.length % options.length
  return [...options.slice(offset), ...options.slice(0, offset)]
}

function useReviewKeyboard(input: {
  answered: boolean
  options: ReviewOption[]
  onSelect(index: number): void
  onAdvance(): void
  onExit(): void
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key >= '1' && event.key <= '4' && !input.answered) {
        input.onSelect(Number(event.key) - 1)
      }

      if (event.key === 'Enter' && input.answered) {
        input.onAdvance()
      }

      if (event.key === 'Escape') {
        input.onExit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [input])
}

export default function ReviewPage() {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const currentCard = sampleCards[currentIndex]
  const answered = selectedIndex !== null

  const options = useMemo(
    () =>
      orderOptions(
        buildReviewOptions(
          { term: currentCard.term, meaning: currentCard.meaning },
          optionCandidates
        ),
        currentCard.term
      ),
    [currentCard]
  )
  const selectedOption = selectedIndex === null ? null : options[selectedIndex]
  const isCorrect = selectedOption?.isCorrect ?? false
  const rating = answered ? rateReviewAnswer({ correct: isCorrect, attempts: 1 }) : null
  const example = searchExamCorpus(currentCard.term).examples[0]

  const persistSession = useCallback(async () => {
    try {
      const repository = createLocalRepository()
      await repository.upsertStudySession({
        id: 'local-review-session',
        userId: 'local',
        mode: 'due',
        wordIds: sampleCards.map((card) => card.id),
        currentIndex,
        startedAt: Date.now(),
        completedAt: null
      })
      await repository.close()
    } catch {
      // Local persistence should not block review navigation.
    }
  }, [currentIndex])

  const handleExit = useCallback(() => {
    void persistSession()
    navigate('/')
  }, [navigate, persistSession])

  const handleAdvance = useCallback(() => {
    if (!answered) {
      return
    }

    const nextIndex = currentIndex + 1
    if (nextIndex >= sampleCards.length) {
      void persistSession()
      navigate('/')
      return
    }

    setCurrentIndex(nextIndex)
    setSelectedIndex(null)
  }, [answered, currentIndex, navigate, persistSession])

  useReviewKeyboard({
    answered,
    options,
    onSelect: setSelectedIndex,
    onAdvance: handleAdvance,
    onExit: handleExit
  })

  return (
    <section className="page review-page" aria-labelledby="review-title">
      <button type="button" className="button button-secondary back-button" onClick={handleExit}>
        <ArrowLeft size={18} aria-hidden="true" />
        返回
      </button>

      <div className="review-card">
        <div className="review-meta">
          <span>
            {currentIndex + 1} / {sampleCards.length}
          </span>
          <span>{answered ? `FSRS: ${rating}` : '四选一复习'}</span>
        </div>

        <div className="review-prompt">
          <p className="eyebrow">CHOOSE MEANING</p>
          <h1 id="review-title">{currentCard.term}</h1>
        </div>

        <div className="option-grid" aria-label="答案选项">
          {options.map((option, index) => {
            const selected = selectedIndex === index
            const stateClass = answered
              ? option.isCorrect
                ? 'option-correct'
                : selected
                  ? 'option-wrong'
                  : ''
              : ''

            return (
              <button
                key={`${option.sourceTerm}-${option.meaning}`}
                type="button"
                className={`answer-option ${stateClass}`}
                disabled={answered}
                onClick={() => setSelectedIndex(index)}
              >
                <span>{index + 1}</span>
                <strong>{option.meaning}</strong>
              </button>
            )
          })}
        </div>
      </div>

      {answered ? (
        <div className="result-panel" role="status">
          <div className="result-heading">
            {isCorrect ? (
              <CheckCircle2 size={22} aria-hidden="true" />
            ) : (
              <XCircle size={22} aria-hidden="true" />
            )}
            <h2>{isCorrect ? '回答正确' : '回答错误'}</h2>
          </div>

          <p>
            正确答案：<strong>{currentCard.meaning}</strong>
          </p>

          {example ? (
            <blockquote>
              <span>真题例句</span>
              <p>{example.sentence}</p>
              {example.translation ? <cite>{example.translation}</cite> : null}
            </blockquote>
          ) : null}

          <div className="rating-row" aria-label="FSRS 评分">
            {(['again', 'hard', 'good', 'easy'] as const).map((item) => (
              <button key={item} type="button" className="button button-secondary" onClick={handleAdvance}>
                {item}
              </button>
            ))}
          </div>

          <button type="button" className="button button-primary" onClick={handleAdvance}>
            继续
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  )
}
