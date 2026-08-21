import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('client secret safety', () => {
  it('does not contain a GitHub personal access token in the legacy page', async () => {
    const html = await readFile(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html).not.toMatch(/ghp_[A-Za-z0-9_]+/)
    expect(html).not.toMatch(/Authorization:\s*`token/)
  })
})
