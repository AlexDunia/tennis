import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const drawer = readFileSync(
  'src/components/ladder/AdminLadderMatchDrawer.vue',
  'utf8',
)

const settings = readFileSync(
  'src/views/LadderSettingsView.vue',
  'utf8',
)

test('challenge setup shows the complete authoritative scoring summary', () => {
  assert.match(drawer, /currentRulesSummary\.rows/)
  assert.match(drawer, /Scoring rules/)
  assert.match(settings, /7/)
  assert.match(settings, /10/)
  assert.match(settings, /MatchFormatEditor/)
})

test('unsupported points ranking is not presented as a working setting', () => {
  assert.match(
    settings,
    /Points ranking is not offered until Gorra has a real points formula/,
  )
  assert.doesNotMatch(
    settings,
    /value="points"/,
  )
})

