import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../../src/app/App'

describe('app shell', () => {
  it('renders the dashboard navigation and main learning action', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('研词 Core')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '今日学习' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查词' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始今日复习' })).toBeInTheDocument()
  })
})
