import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(
  'src/views/DashboardView.vue',
  'utf8',
)

test('authenticated dashboard hero uses the Gorra green tennis treatment', () => {
  assert.match(source, /dashboard-hero/)
  assert.match(source, /dashboard-hero__ball/)
  assert.match(source, /background:\s*#078c2f/)
  assert.match(source, /@keyframes dashboard-ball-bounce/)
  assert.match(source, /prefers-reduced-motion/)
})

