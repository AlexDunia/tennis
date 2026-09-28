import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sharedTableStyles = readFileSync(
  'src/assets/app-consistency.css',
  'utf8',
)
const importStyles = readFileSync(
  'src/assets/club-reference32.css',
  'utf8',
)
const standings = readFileSync(
  'src/components/tournament/StandingsTable.vue',
  'utf8',
)
const importView = readFileSync(
  'src/views/ClubMemberImportView.vue',
  'utf8',
)

test('data tables use the Members directory treatment', () => {
  assert.match(sharedTableStyles, /\.gorra-directory-table/)
  assert.match(sharedTableStyles, /border-spacing:\s*0 10px/)
  assert.match(standings, /class="gorra-directory-table"/)
  assert.match(importView, /gorra-data-grid--members/)
  assert.match(importView, /gorra-data-table--members/)
  assert.match(importStyles, /\.gorra-data-grid--members/)
})
