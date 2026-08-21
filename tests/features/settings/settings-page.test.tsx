import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import SettingsPage from '../../../src/features/settings/SettingsPage'

describe('SettingsPage', () => {
  it('renders sync, export, mode, and sign-out controls', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/本地模式/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /立即同步/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /导出个人数据/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /清理本地缓存/ })).toBeInTheDocument()
  })
})
