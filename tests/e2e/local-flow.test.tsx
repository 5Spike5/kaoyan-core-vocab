import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import App from '../../src/app/App'
import { createLocalRepository } from '../../src/repositories/localRepository'

describe('local learning flow', () => {
  beforeAll(() => {
    // 屏蔽真实网络请求：词典查询在本测试中一律视为未找到，
    // 验证本地语料结果不依赖网络。
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })
    )
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('walks through dashboard, review, lookup, and add-to-vocab', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    // 1. Dashboard renders.
    expect(screen.getByRole('link', { name: '今日学习' })).toBeInTheDocument()

    // 2. Start review.
    await user.click(screen.getByRole('button', { name: '开始今日复习' }))
    expect(await screen.findByText('address')).toBeInTheDocument()

    // 3. Four answer options are present.
    expect(screen.getByRole('button', { name: /处理，应对/ })).toBeInTheDocument()

    // 4. Select an answer.
    await user.click(screen.getByRole('button', { name: /处理，应对/ }))

    // 5. Result and exam example appear.
    expect(await screen.findByText(/正确答案/)).toBeInTheDocument()
    expect(screen.getByText(/真题例句/)).toBeInTheDocument()

    // 6. Escape returns to the dashboard.
    await user.keyboard('{Escape}')
    expect(await screen.findByRole('link', { name: '今日学习' })).toBeInTheDocument()

    // 7. Open lookup.
    const sidebar = screen.getByRole('complementary')
    await user.click(within(sidebar).getByRole('link', { name: '查词' }))
    expect(await screen.findByRole('heading', { name: '查词' })).toBeInTheDocument()

    // 8. Query `address`; local corpus results appear without network.
    const input = screen.getByRole('searchbox', { name: '输入单词或短语' })
    await user.type(input, 'address')
    await user.click(screen.getByRole('button', { name: '搜索' }))
    expect(await screen.findByText(/总出现次数/)).toBeInTheDocument()

    // 9. Add it to the local word repository.
    await user.click(screen.getByRole('button', { name: /加入生词库/ }))
    expect(await screen.findByText(/已加入生词库/)).toBeInTheDocument()

    // 10. The repository now contains the word.
    const repository = createLocalRepository()
    const saved = await repository.getUserWord('local', 'address')
    expect(saved).not.toBeNull()
    expect(saved?.normalizedTerm).toBe('address')
    await repository.close()
  })
})
