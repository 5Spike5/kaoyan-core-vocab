import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import VocabListPage from '../../../src/features/vocab/VocabListPage'

describe('VocabListPage', () => {
  it('renders status filters, a search input, and an export button', () => {
    render(
      <MemoryRouter>
        <VocabListPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('searchbox', { name: /搜索/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /导出 Excel/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /导入/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /全部/ })).toBeInTheDocument()
  })

  it('lists merged public words after loading', async () => {
    render(
      <MemoryRouter>
        <VocabListPage />
      </MemoryRouter>
    )

    expect(await screen.findByText('address')).toBeInTheDocument()
  })

  it('filters the list by a search term', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <VocabListPage />
      </MemoryRouter>
    )

    await screen.findByText('address')
    await user.type(screen.getByRole('searchbox', { name: /搜索/ }), 'account for')

    expect(screen.getAllByText('account for').length).toBeGreaterThan(0)
    expect(screen.queryByText('address')).not.toBeInTheDocument()
  })
})
