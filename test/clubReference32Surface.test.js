import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clubView = readFileSync('src/views/ClubView.vue', 'utf8')
const membersView = readFileSync('src/views/ClubMembersView.vue', 'utf8')
const importView = readFileSync('src/views/ClubMemberImportView.vue', 'utf8')
const layout = readFileSync('src/layouts/DefaultLayout.vue', 'utf8')
const clubsView = readFileSync('src/views/ClubsView.vue', 'utf8')

test('active club surface carries the Reference 32 club identity and direct management choices', () => {
  assert.match(clubView, /Manage your club/)
  assert.doesNotMatch(clubView, /Bring your players in/)
  assert.doesNotMatch(clubView, /class="ref-club-state"/)
  assert.match(clubView, /Invite, import and manage your people\./)
  assert.match(clubView, /Positions, rules, challenges and activity\./)
  assert.match(clubView, /Events, draws, fixtures and results\./)
})

test('member directory uses one searchable list, a quiet zero state, and progressive Add people choices', () => {
  assert.match(membersView, /All members of/)
  assert.match(membersView, /You currently have no active members/)
  assert.match(membersView, /People added to this club will appear here\./)
  assert.match(membersView, /Search name or email/)
  assert.match(membersView, /Needs information/)
  assert.match(membersView, /Connected accounts/)
  assert.match(membersView, /Bring your data to Gorra/)
  assert.match(membersView, /Add someone manually/)
})

test('import flow carries exact Reference 32 scenario and work-page copy', () => {
  assert.match(importView, /What are you bringing in\?/)
  assert.match(importView, /Choose what is already in your file\./)
  assert.match(importView, /Members only/)
  assert.match(importView, /Members \+ one ladder/)
  assert.match(importView, /Members \+ multiple ladders/)
  assert.match(importView, /Import your member list/)
  assert.match(importView, /Optional fields:/)
  assert.match(importView, /Download template/)
  assert.match(importView, /Choose file/)
  assert.match(importView, /Paste spreadsheet/)
  assert.match(importView, /Search this list/)
  assert.match(importView, /Not importing/)
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
