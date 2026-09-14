import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dashboard = readFileSync('src/views/DashboardView.vue', 'utf8')
const hero = readFileSync('src/components/dashboard/HomePrioritySlot.vue', 'utf8')

test('dashboard renders one current priority with the Gorra green tennis treatment', () => {
  assert.equal((dashboard.match(/<HomePrioritySlot\b/g) || []).length, 1)
  assert.match(dashboard, /:priority="homeHero"/)
  assert.match(hero, /background:\s*#163d2b/)
  assert.match(hero, /home-priority__ball-mark/)
  assert.match(hero, /prefers-reduced-motion/)
  assert.doesNotMatch(hero, /setInterval|rotationIndex|progressWidth|priorities:/)
})

test('failed live recovery offers retry instead of silently returning to Home', () => {
  const flow = readFileSync('src/views/FriendlyMatchFlowView.vue', 'utf8')
  assert.match(flow, /!initializeCanonicalLiveSession\(\{ allowCreate: false \}\)[\s\S]*?liveEntryError.value[\s\S]*?return/)
  assert.ok(flow.indexOf("liveEntryError.value = 'This saved match") < flow.indexOf("step.value === 'live' && !initializeCanonicalLiveSession"))
  assert.match(flow, /primary-action-label="Try again"/)
  assert.match(flow, /watch\(\[step, requestedLiveMatchId\], configureStep\)/)
})
