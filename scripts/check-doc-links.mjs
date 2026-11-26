import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const FENCED_CODE = /```[\s\S]*?```/g
const MARKDOWN_LINK = /\]\(([^)\s]+)\)/g
const HEADING = /^#+ (.*)$/gm

/**
 * @param {string} heading
 */
export function slugify(heading) {
  return heading
    .replace(/`/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-')
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function markdownFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return markdownFiles(full)
    return entry.name.endsWith('.md') ? [full] : []
  })
}

/**
 * @param {string} file
 */
function withoutCode(file) {
  return fs.readFileSync(file, 'utf8').replace(FENCED_CODE, '')
}

/**
 * @param {string} file
 */
function anchorsOf(file) {
  return new Set([...withoutCode(file).matchAll(HEADING)].map((match) => slugify(match[1])))
}

/**
 * @param {string} root
 * @returns {{ file: string, link: string, reason: 'missing' | 'anchor' }[]}
 */
export function findBrokenLinks(root) {
  const files = [
    ...markdownFiles(path.join(root, 'docs', 'site')),
    path.join(root, 'README.md'),
    path.join(root, 'DEVELOPMENT.md'),
  ].filter((file) => fs.existsSync(file))
  return files.flatMap((file) =>
    [...withoutCode(file).matchAll(MARKDOWN_LINK)].flatMap((match) => {
      const link = match[1]
      if (/^[a-z]+:/i.test(link)) return []
      const [target, anchor] = link.split('#')
      const resolved = target ? path.resolve(path.dirname(file), target) : file
      const relative = path.relative(root, file)
      if (!fs.existsSync(resolved)) return [{ file: relative, link, reason: 'missing' }]
      if (anchor && resolved.endsWith('.md') && !anchorsOf(resolved).has(anchor)) {
        return [{ file: relative, link, reason: 'anchor' }]
      }
      return []
    }),
  )
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const broken = findBrokenLinks(path.resolve(SCRIPT_DIR, '..'))
  if (broken.length > 0) {
    for (const { file, link, reason } of broken) console.error(`${reason.padEnd(7)} ${file}: ${link}`)
    process.exit(1)
  }
}
