/**
 * scripts/optimize-screenshots.ts
 * Compress the portfolio PNGs in docs/screenshots/ in place so each stays within the
 * repo size budget (<300 KB), reporting before/after sizes. Uses `sharp` (declared as a
 * direct devDependency — do not rely on Next.js's transitive copy). No project env needed.
 *
 * Usage: npm run screenshots:optimize
 */

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const DIR = join(process.cwd(), 'docs', 'screenshots')
const BUDGET = 300 * 1024 // 300 KB
const MIN_WIDTH = 1200 // never shrink narrower than this (keep text legible)

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)}KB`

/** Encode a buffer as an optimised, palette-quantised PNG at an optional target width. */
async function encode(input: Buffer, width: number | null): Promise<Buffer> {
  let pipeline = sharp(input)
  if (width) pipeline = pipeline.resize({ width })
  return pipeline.png({ palette: true, compressionLevel: 9, effort: 10, quality: 90 }).toBuffer()
}

async function optimizeFile(file: string): Promise<void> {
  const path = join(DIR, file)
  const before = statSync(path).size
  const original = readFileSync(path)
  const originalWidth = (await sharp(original).metadata()).width ?? 0

  // Re-encode at full size first; only downscale if still over budget.
  let best = await encode(original, null)
  let width = originalWidth
  while (best.length > BUDGET && width > MIN_WIDTH) {
    width = Math.max(MIN_WIDTH, Math.round(width * 0.85))
    best = await encode(original, width)
  }

  // Keep whichever is smaller — never write a file larger than the source.
  if (best.length < before) {
    writeFileSync(path, best)
    const tag = width < originalWidth ? ` (resized ${originalWidth}→${width}px)` : ''
    console.log(`  ✅ ${file}: ${kb(before)} → ${kb(best.length)}${tag}`)
  } else {
    console.log(`  ⏭️  ${file}: ${kb(before)} — already optimal, kept`)
  }

  const finalSize = statSync(path).size
  if (finalSize > BUDGET) {
    console.warn(`  ⚠️  ${file} is ${kb(finalSize)} — still over the ${kb(BUDGET)} budget`)
  }
}

async function main(): Promise<void> {
  const pngs = readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.png')).sort()
  if (pngs.length === 0) {
    console.log('No PNGs in docs/screenshots/ — run `npm run screenshots` first.')
    return
  }
  console.log(`🗜️  Optimizing ${pngs.length} screenshot(s) (budget ${kb(BUDGET)})...`)
  for (const file of pngs) await optimizeFile(file)
  console.log('✨ Done.')
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
