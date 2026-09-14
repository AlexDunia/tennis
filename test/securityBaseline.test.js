import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

async function text(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8')
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const output = []

  for (const entry of entries) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue

    const absolute = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      output.push(...(await sourceFiles(absolute)))
      continue
    }

    if (/\.(js|vue|html)$/.test(entry.name)) output.push(absolute)
  }

  return output
}

test('browser profiles and local env are ignored', async () => {
  const ignore = await text('.gitignore')

  assert.match(ignore, /\.dashboard-check-\*/)
  assert.match(ignore, /^\.env$/m)
})

test('deploy runs tests before build', async () => {
  const workflow = await text('.github/workflows/deploy.yml')
  const testIndex = workflow.indexOf('npm test')
  const buildIndex = workflow.indexOf('npm run build')

  assert.ok(testIndex >= 0)
  assert.ok(buildIndex >= 0)
  assert.ok(testIndex < buildIndex)
})

test('source does not introduce common unsafe DOM execution sinks', async () => {
  const files = await sourceFiles(path.join(root, 'src'))

  const forbidden = [
    /\.innerHTML\s*=/,
    /\bdocument\.write\s*\(/,
    /\beval\s*\(/,
    /\bnew\s+Function\s*\(/,
    /\bv-html\s*=/,
  ]

  const findings = []

  for (const file of files) {
    const source = await readFile(file, 'utf8')

    forbidden.forEach((pattern) => {
      if (pattern.test(source)) {
        findings.push(`${path.relative(root, file)}: ${pattern}`)
      }
    })
  }

  assert.deepEqual(findings, [])
})
