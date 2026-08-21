import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { calculateAccuracy, countDueWords } from '../../../src/features/stats/statsSelectors'
import StatsPage from '../../../src/features/stats/StatsPage'

describe('stats selectors', () => {
  it('calculates accuracy from scored review logs', () => {
    expect(calculateAccuracy([])).toBe(0)
    expect(
      calculateAccuracy([
        { id: '1', rating: 3, answeredCorrectly: true },
        { id: '2', rating: 1, answeredCorrectly: false },
        { id: '3', rating: 4, answeredCorrectly: true }
      ] as never[])
    ).toBe(67)
  })

  it('counts due words by nextReviewAt', () => {
    const words = [
      { nextReviewAt: 100 },
      { nextReviewAt: 200 },
      { nextReviewAt: null }
    ] as never[]
    expect(countDueWords(words, 150)).toBe(1)
  })
})

describe('StatsPage', () => {
  it('renders today study minutes, learned count, accuracy, and overdue count', async () => {
    render(
      <MemoryRouter>
        <StatsPage />
      </MemoryRouter>
    )

    expect(await screen.findByText(/今日学习/)).toBeInTheDocument()
    expect(screen.getByText(/已学单词/)).toBeInTheDocument()
    expect(screen.getByText(/正确率/)).toBeInTheDocument()
    expect(screen.getByText(/待复习/)).toBeInTheDocument()
  })
})
