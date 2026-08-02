import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = process.cwd()

interface MarkdownLink {
  line: number
  target: string
}

interface LinkProblem {
  source: string
  line: number
  target: string
  reason: string
}

function repoPath(path: string): string {
  return relative(REPO_ROOT, path).split(sep).join('/')
}

function markdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(path)
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : []
  })
}

function allMarkdownFiles(): string[] {
  const rootFiles = readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => resolve(REPO_ROOT, entry.name))
  return [...rootFiles, ...markdownFiles(resolve(REPO_ROOT, 'docs'))].sort()
}

function visibleMarkdownLines(content: string): Array<{ line: number; text: string }> {
  let fence: '```' | '~~~' | null = null
  let htmlComment = false
  return content.split('\n').flatMap((text, index) => {
    const marker = text.match(/^\s*(```|~~~)/)?.[1] as '```' | '~~~' | undefined
    if (marker) {
      if (!fence) fence = marker
      else if (fence === marker) fence = null
      return []
    }
    if (fence) return []

    let visible = text
    while (visible.length > 0) {
      if (htmlComment) {
        const commentEnd = visible.indexOf('-->')
        if (commentEnd === -1) return []
        visible = visible.slice(commentEnd + 3)
        htmlComment = false
      }

      const commentStart = visible.indexOf('<!--')
      if (commentStart === -1) break
      const commentEnd = visible.indexOf('-->', commentStart + 4)
      if (commentEnd === -1) {
        visible = visible.slice(0, commentStart)
        htmlComment = true
        break
      }
      visible = `${visible.slice(0, commentStart)}${visible.slice(commentEnd + 3)}`
    }

    return [{ line: index + 1, text: visible.replace(/`[^`]*`/g, '') }]
  })
}

function markdownLinks(content: string): MarkdownLink[] {
  return visibleMarkdownLines(content).flatMap(({ line, text }) => {
    const links: MarkdownLink[] = []
    const inlineLink = /!?\[[^\]\n]*\]\((<[^>\n]+>|[^)\s]+)(?:\s+["'][^\n]*["'])?\)/g
    const referenceDefinition = /^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/g

    for (const pattern of [inlineLink, referenceDefinition]) {
      for (const match of text.matchAll(pattern)) {
        links.push({ line, target: match[1].replace(/^<|>$/g, '') })
      }
    }
    return links
  })
}

function isExternalTarget(target: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function headingSlug(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
}

function markdownAnchors(path: string): Set<string> {
  const counts = new Map<string, number>()
  const anchors = new Set<string>()
  const content = readFileSync(path, 'utf8')

  for (const { text } of visibleMarkdownLines(content)) {
    const heading = text.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/)?.[1]
    if (!heading) continue
    const slug = headingSlug(heading)
    const count = counts.get(slug) ?? 0
    counts.set(slug, count + 1)
    anchors.add(count === 0 ? slug : `${slug}-${count}`)
  }
  return anchors
}

function validateLink(source: string, link: MarkdownLink): LinkProblem | null {
  if (!link.target || isExternalTarget(link.target)) return null

  const [rawPath, ...fragmentParts] = link.target.split('#')
  const fragment = decode(fragmentParts.join('#'))
  const pathWithoutQuery = decode(rawPath.split('?')[0])
  const targetPath = pathWithoutQuery
    ? resolve(pathWithoutQuery.startsWith('/') ? REPO_ROOT : dirname(source), pathWithoutQuery.replace(/^\//, ''))
    : source
  const relativeTarget = repoPath(targetPath)

  if (relativeTarget === '..' || relativeTarget.startsWith('../')) {
    return { source: repoPath(source), line: link.line, target: link.target, reason: 'repository scope 外を参照している' }
  }
  if (!existsSync(targetPath)) {
    return { source: repoPath(source), line: link.line, target: link.target, reason: '参照先が存在しない' }
  }
  if (!fragment) return null

  const anchorFile = statSync(targetPath).isDirectory()
    ? resolve(targetPath, 'README.md')
    : targetPath
  if (extname(anchorFile).toLowerCase() !== '.md' || !existsSync(anchorFile)) return null
  if (!markdownAnchors(anchorFile).has(fragment)) {
    return { source: repoPath(source), line: link.line, target: link.target, reason: '見出しアンカーが存在しない' }
  }
  return null
}

describe('documentation link integrity', () => {
  it('keeps repository-relative Markdown targets and anchors valid', () => {
    const problems = allMarkdownFiles().flatMap((source) => {
      const content = readFileSync(source, 'utf8')
      return markdownLinks(content)
        .map((link) => validateLink(source, link))
        .filter((problem): problem is LinkProblem => problem !== null)
    })

    expect(problems).toEqual([])
  })
})
