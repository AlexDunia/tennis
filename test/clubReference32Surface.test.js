import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clubView = readFileSync('src/views/ClubView.vue', 'utf8')
const membersView = readFileSync('src/views/ClubMembersView.vue', 'utf8')
const importView = readFileSync('src/views/ClubMemberImportView.vue', 'utf8')
const layout = readFileSync('src/layouts/DefaultLayout.vue', 'utf8')
const clubsView = readFileSync('src/views/ClubsView.vue', 'utf8')

test('active club surface carries the Reference 32 club identity and management copy', () => {
  assert.match(clubView, /Manage your club/)
  assert.match(clubView, /Bring your players in/)
  assert.match(clubView, /Invite people, import your current list or add someone yourself\./)
  assert.match(clubView, /Invite, import and manage your people\./)
  assert.match(clubView, /Positions, rules, challenges and activity\./)
  assert.match(clubView, /Events, draws, fixtures and results\./)
})

test('member directory uses one searchable list and progressive Add people choices', () => {
  assert.match(membersView, /All members of/)
  assert.match(membersView, /Search name or email/)
  assert.match(membersView, /Needs information/)
  assert.match(membersView, /Connected accounts/)
  assert.match(membersView, /Player name/)
  assert.match(membersView, /Ladder position/)
  assert.match(membersView, /Bring your data to Gorra/)
  assert.match(membersView, /Add someone manually/)
})

test('import flow contains the three Reference 32 scenarios and inline review controls', () => {
  assert.match(importView, /What are you bringing in\?/)
  assert.match(importView, /Members only/)
  assert.match(importView, /Members \+ one ladder/)
  assert.match(importView, /Members \+ multiple ladders/)
  assert.match(importView, /Search this list/)
  assert.match(importView, /All columns/)
  assert.match(importView, /Required/)
  assert.match(importView, /Optional/)
  assert.match(importView, /Not importing/)
  assert.match(importView, /Choose file/)
  assert.match(importView, /Paste spreadsheet/)
})

test('club routes do not show the old Overview Members Rules Manage contextual strip', () => {
  assert.match(
    layout,
    /activePrimarySection\.value !== 'club'/,
  )
})

test('Your clubs uses one vertical relationship list rather than a two-column club grid', () => {
  assert.match(
    clubsView,
    /\.club-directory-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/,
  )
  assert.doesNotMatch(
    clubsView,
    /\.club-directory-grid\s*\{[\s\S]{0,180}repeat\(2/,
  )
})
