import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_INDENT = '      '

/**
 * @param {string} text
 */
function withSingleTrailingNewline(text) {
  return `${text.trimEnd()}\n`
}

/**
 * @param {string} compose
 * @param {string} name
 * @returns {string | null}
 */
export function extractConfigContent(compose, name) {
  const lines = compose.split('\n')
  const start = lines.findIndex((line) => line === `  ${name}:`)
  if (start === -1) return null
  const contentIndex = lines.findIndex((line, i) => i > start && line.trim() === 'content: |')
  if (contentIndex === -1) return null
  const body = []
  for (const line of lines.slice(contentIndex + 1)) {
    if (line !== '' && !line.startsWith(CONTENT_INDENT)) break
    body.push(line.slice(CONTENT_INDENT.length))
  }
  return withSingleTrailingNewline(body.join('\n')).replaceAll('$$', '$')
}

/**
 * @param {string} root
 */
export function checkComposeInit(root) {
  const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8')
  const script = fs.readFileSync(path.join(root, 'backend/docker/postgres-init/10-app-role.sh'), 'utf8')
  const inline = extractConfigContent(compose, 'postgres_app_role')
  return inline !== null && inline === withSingleTrailingNewline(script)
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain && !checkComposeInit(path.resolve(SCRIPT_DIR, '..'))) {
  console.error('docker-compose.yml configs.postgres_app_role differs from backend/docker/postgres-init/10-app-role.sh')
  console.error('Copy the script into the compose file, escaping every dollar sign by doubling it.')
  process.exit(1)
}
