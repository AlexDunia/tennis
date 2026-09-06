import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const router = readFileSync(
  'src/router/index.js',
  'utf8',
)

const ladderSettings = readFileSync(
  'src/views/LadderSettingsView.vue',
  'utf8',
)

const tournamentSettings = readFileSync(
  'src/views/TournamentSettingsView.vue',
  'utf8',
)

test('Ladder settings are scoped to a concrete ladder', () => {
  assert.match(router, /path:\s*'\/rankings\/:ladderId\/settings'/)
  assert.match(router, /name:\s*'LadderSettings'/)
  assert.match(ladderSettings, /currentSetup\.ladders\.map/)
  assert.match(ladderSettings, /item\.id === ladder\.value\.id/)
  assert.match(ladderSettings, /matchRulesSnapshot/)
})

test('Tournament settings are scoped to a concrete tournament', () => {
  assert.match(
    router,
    /path:\s*'\/tournaments\/:tournamentId\/settings'/,
  )
  assert.match(router, /name:\s*'TournamentSettings'/)
  assert.match(tournamentSettings, /updateTournament/)
  assert.match(tournamentSettings, /THIS TOURNAMENT ONLY/)
})

