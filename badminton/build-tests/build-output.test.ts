import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

const distDir = resolve(__dirname, '../dist')
const indexHtml = join(distDir, 'index.html')

describe('Build output verification', () => {
  it('dist/index.html should exist', () => {
    expect(existsSync(indexHtml)).toBe(true)
  })

  it('should not reference .tsx or .jsx source files', () => {
    const html = readFileSync(indexHtml, 'utf-8')
    const scriptTags = html.match(/<script[^>]*src="[^"]*"[^>]*>/g) ?? []
    for (const tag of scriptTags) {
      expect(tag).not.toMatch(/\.tsx/)
      expect(tag).not.toMatch(/\.jsx/)
    }
  })

  it('all referenced assets should exist in dist/', () => {
    const html = readFileSync(indexHtml, 'utf-8')
    const assetRefs = [...html.matchAll(/(?:src|href)="(\/badminton\/assets\/[^"]+)"/g)]
    expect(assetRefs.length).toBeGreaterThan(0)

    for (const [, assetPath] of assetRefs) {
      const relativePath = assetPath.replace('/badminton/', '')
      const fullPath = join(distDir, relativePath)
      expect(existsSync(fullPath), `Asset should exist: ${assetPath}`).toBe(true)
    }
  })
})
