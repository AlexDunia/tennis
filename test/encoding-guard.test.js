import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TextDecoder } from 'node:util'

const target = new URL(
  '../src/components/ladder/LadderBulkScheduler.vue',
  import.meta.url,
)

test('LadderBulkScheduler source stays valid, small UTF-8', () => {
  const raw = readFileSync(target)

  assert.ok(
    raw.length < 500 * 1024,
    `LadderBulkScheduler.vue unexpectedly grew to ${raw.length} bytes`,
  )

  const source = new TextDecoder('utf-8', { fatal: true }).decode(raw)
  const longestLine = Math.max(
    0,
    ...source.split(/\r?\n/).map((line) => line.length),
  )

  assert.ok(
    longestLine < 10_000,
    `LadderBulkScheduler.vue contains an abnormally long line: ${longestLine} chars`,
  )

  for (const signature of ['Ãƒ', 'Ã‚', 'â€', 'â‚¬', 'Æ’']) {
    assert.equal(
      source.includes(signature),
      false,
      `LadderBulkScheduler.vue contains mojibake signature: ${signature}`,
    )
  }
})
