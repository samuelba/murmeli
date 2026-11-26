import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ESZETT = /[ßẞ]/u
const TEXT_EXTENSIONS = new Set(['.json', '.yaml', '.yml', '.hbs', '.md', '.ts', '.html', '.txt', '.svg'])
const SKIP_FILE = /\.(spec|test)\.[cm]?[jt]s$/
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.angular', '.git', '.jj', 'internal'])

export const CHECKED_PATHS = [
  'frontend/public/i18n',
  'frontend/src',
  'backend/src',
  'content',
  'brand',
  'docs/site',
]

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  if (!fs.existsSync(dir)) return []
  if (fs.statSync(dir).isFile()) return [dir]
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return []
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    if (SKIP_FILE.test(entry.name)) return []
    return TEXT_EXTENSIONS.has(path.extname(entry.name)) ? [full] : []
  })
}

/**
 * @param {string} root
 * @returns {{ file: string, line: number, text: string }[]}
 */
export function findEszett(root) {
  return CHECKED_PATHS.flatMap((relative) => walk(path.join(root, relative))).flatMap((file) =>
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((text, index) =>
        ESZETT.test(text) ? [{ file: path.relative(root, file), line: index + 1, text: text.trim() }] : [],
      ),
  )
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const root = path.resolve(SCRIPT_DIR, '..')
  const hits = findEszett(root)
  if (hits.length > 0) {
    console.error('Swiss German uses "ss" instead of "ß". Found:')
    for (const hit of hits) console.error(`  ${hit.file}:${hit.line}  ${hit.text}`)
    process.exit(1)
  }
}
