import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clubView = readFileSync('src/views/ClubView.vue', 'utf8')
const membersView = readFileSync('src/views/ClubMembersView.vue', 'utf8')
const importView = readFileSync('src/views/ClubMemberImportView.vue', 'utf8')
const importScenarioSource = readFileSync('src/utils/onboarding/memberImport.js', 'utf8')
const layout = readFileSync('src/layouts/DefaultLayout.vue', 'utf8')
const clubsView = readFileSync('src/views/ClubsView.vue', 'utf8')
const calendarView = readFileSync('src/views/ClubCalendarView.vue', 'utf8')
const router = readFileSync('src/router/index.js', 'utf8')

test('active club surface uses the requested profile hero and begins management with Members', () => {
  assert.match(clubView, /class="club-signature-hero"/)
  assert.match(clubView, /Everything that keeps the club moving, in one place\./)
  assert.match(clubView, /Invite member/)
  assert.doesNotMatch(clubView, /club-invite-menu__toggle/)
  assert.match(clubView, /ref="inviteMenuRoot" class="club-invite-menu"/)
  assert.match(clubView, /document\.addEventListener\('pointerdown', dismissInviteOptionsOnOutsidePointer\)/)
  assert.match(clubView, /!inviteMenuRoot\.value\?\.contains\(event\.target\)/)
  assert.match(clubView, /Change club/)
  assert.match(clubView, /Manage your club/)
  assert.doesNotMatch(clubView, /Bring your players in/)
  assert.doesNotMatch(clubView, /Members and the people who can manage the club\./)
  assert.match(clubView, /invite, import and manage people/)
  assert.match(clubView, /title: 'Competition'/)
  assert.match(clubView, /Everything that controls how members compete\./)
  assert.match(clubView, /title: 'Club'/)
  assert.match(clubView, /title: 'Club details'/)
  assert.match(clubView, /Name, location, logo and club appearance/)
  assert.match(clubView, /title: 'Calendar'/)
  assert.match(clubView, /to: \{ name: 'ClubCalendar' \}/)
  assert.doesNotMatch(clubView, /title: 'Courts'/)
  assert.doesNotMatch(clubView, /title: 'Appearance'/)
  assert.doesNotMatch(clubView, /appearance: true/)
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

test('Members uses the detailed Club invitation menu', () => {
  assert.match(membersView, /class="club-invite-menu"/)
  assert.match(membersView, /club-invite-menu__panel/)
  assert.match(membersView, /Send a club invitation/)
  assert.match(membersView, /Bring in an existing list/)
  assert.match(membersView, /Create one member record/)
})

test('import flow carries exact Reference 32 scenario and work-page copy', () => {
  assert.match(importView, /What are you bringing in\?/)
  assert.match(importView, /Choose what is already in your file\./)
  assert.match(importView, /MEMBER_IMPORT_SCENARIOS/)
  assert.match(importScenarioSource, /title: 'Members only'/)
  assert.match(importScenarioSource, /title: 'Members \+ one ladder'/)
  assert.match(importScenarioSource, /title: 'Members \+ multiple ladders'/)
  assert.match(importView, /Import your member list/)
  assert.match(importView, /Optional fields:/)
  assert.match(importView, /Download template/)
  assert.match(importView, /Choose file/)
  assert.match(importView, /Paste spreadsheet/)
  assert.match(importView, /Search this list/)
  assert.match(importView, /Not importing/)
})

test('Club calendar belongs to the Club category and scopes scheduled match activity to the active club', () => {
  assert.match(router, /name: 'ClubCalendar'/)
  assert.match(calendarView, /Club calendar/)
  assert.match(calendarView, /scheduled Ladder and Tournament matches/)
  assert.match(calendarView, /match\.clubId === activeClubId\.value/)
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
