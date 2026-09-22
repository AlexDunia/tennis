import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const scheduler = fileURLToPath(
  new URL('../src/components/ladder/LadderBulkScheduler.vue', import.meta.url),
)
const mojibakeSignatures = [
  '\u00c3\u0192\u00c6\u2019',
  '\u00c3\u0192\u00e2\u20ac\u0161',
  '\u00c3\u201a',
  '\u00c3\u00a2\u00e2\u201a\u00ac',
  '\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00ac',
  '\u00c3\u2020\u2019',
]

test('LadderBulkScheduler remains valid, compact UTF-8 source', async () => {
  const bytes = await readFile(scheduler)
  assert.ok(bytes.length < 500 * 1024, 'scheduler must remain below 500 KB')

  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  assert.ok(
    Math.max(...source.split(/\r?\n/).map((line) => line.length)) < 10_000,
    'scheduler must not contain pathological source lines',
  )

  for (const signature of mojibakeSignatures) {
    assert.ok(!source.includes(signature), `scheduler contains mojibake: ${signature}`)
  }
})
