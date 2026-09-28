import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const emptyState = readFileSync('src/components/EmptyState.vue', 'utf8')
const playHub = readFileSync('src/views/PlayHubView.vue', 'utf8')

test('empty states use roomy, system-aligned paired actions when both paths matter', () => {
  assert.match(emptyState, /variant="secondary"/)
  assert.match(emptyState, /gap: 10px;[\s\S]*?margin-top: 8px;/)
  assert.match(emptyState, /min-height: var\(--app-button-height, 44px\);/)
  assert.match(emptyState, /border-radius: var\(--app-inner-radius, 9px\);/)
  assert.match(playHub, /primary-action-label="Friendly match"/)
  assert.match(playHub, /secondary-action-label="Ladder match"/)
})