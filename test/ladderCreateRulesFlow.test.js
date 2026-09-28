import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const createView = readFileSync(
  'src/views/LadderCreateView.vue',
  'utf8',
)

const settingsView = readFileSync(
  'src/views/LadderSettingsView.vue',
  'utf8',
)

const ladderWorkspaceStyles = readFileSync(
  'src/assets/ladder-workspace.css',
  'utf8',
)

test('new ladders proceed to rule setup before player setup', () => {
  assert.match(createView, /name: 'LadderSettings'/)
  assert.match(createView, /setup: 'rules'/)
  assert.doesNotMatch(
    createView,
    /Challenge and match rules can be reviewed or customized after the Ladder is created/,
  )
})

test('saving rules during creation proceeds to player setup', () => {
  assert.match(settingsView, /const isSetupFlow/)
  assert.match(settingsView, /Save rules and add players/)
  assert.match(settingsView, /name: 'LadderSetup'/)
  assert.match(settingsView, /step: 'members'/)
})

test('create ladder uses the shared form rhythm and responsive control layout', () => {
  assert.match(createView, /ladder-workspace-page--create/)
  assert.match(createView, /lw-create-form/)
  assert.match(createView, /Ladder details/)
  assert.match(ladderWorkspaceStyles, /\.lw-create-form \.lw-choice:has\(input:checked\)/)
  assert.match(ladderWorkspaceStyles, /@media \(max-width: 760px\)[\s\S]*\.lw-create-form \.lw-choice-row/)
})