import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import DashboardPage from '../../../src/features/dashboard/DashboardPage'

describe('DashboardPage', () => {
  it('prioritizes due reviews and new-word study', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: '开始今日复习' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始新词学习' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查词' })).toBeInTheDocument()
  })
})
