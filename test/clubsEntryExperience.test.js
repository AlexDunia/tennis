import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clubsView = readFileSync('src/views/ClubsView.vue', 'utf8')
const routerSource = readFileSync('src/router/index.js', 'utf8')

test('the Clubs directory is available in the normal authenticated application shell', () => {
  const clubsRoute = routerSource.match(
    /path: '\/clubs',[\s\S]*?name: 'Clubs',[\s\S]*?primarySection: 'club',[\s\S]*?\n\s*},/,
  )?.[0]

  assert.ok(clubsRoute)
  assert.doesNotMatch(clubsRoute, /permission: 'club\.manage'/)
  assert.doesNotMatch(clubsRoute, /onboardingFlow: true/)
})

test('the Clubs entry derives zero, one, and multiple states from real relationships', () => {
  assert.match(clubsView, /const clubCount = computed\(\(\) => adminStore\.clubOptions\.length\)/)
  assert.match(clubsView, /if \(clubCount\.value === 0\) return 'empty'/)
  assert.match(clubsView, /if \(clubCount\.value === 1\) return 'single'/)
  assert.match(clubsView, /You are not in a club yet\./)
  assert.match(clubsView, /clubDirectoryState === 'single'/)
  assert.match(clubsView, /v-for="club in adminStore\.clubOptions"/)
  assert.match(clubsView, /relationshipLabel\(club\.role\)/)
})

test('selecting a relationship reuses the existing active-club switch', () => {
  assert.match(
    clubsView,
    /async function selectClub\(clubId\)[\s\S]*await adminStore\.switchClub\(clubId\)/,
  )
  assert.match(clubsView, /@click="selectClub\(club\.id\)"/)
  assert.match(clubsView, /club\.id === adminStore\.activeClubId/)
})

test('Add club exposes only the Create or Join decision', () => {
  assert.match(clubsView, /router\.push\(\{ name: 'Clubs', query: \{ view: 'add' \} \}\)/)
  assert.match(clubsView, /routeView === 'directory-add'/)
  assert.match(
    clubsView,
    /function openCreateClubFlow\(\) \{\s*router\.push\(\{ name: 'Clubs', query: \{ view: 'create' \} \}\)/,
  )
  assert.match(
    clubsView,
    /function openJoinClubFlow\(\) \{\s*router\.push\(\{ name: 'PlayerClubJoin' \}\)/,
  )
})

test('Create and Join forms delegate relationship changes to AdminStore', () => {
  assert.match(clubsView, /await adminStore\.createClub\(minimalClub\)/)
  assert.match(clubsView, /await adminStore\.previewInvite\(inviteCode\.value\)/)
  assert.match(clubsView, /await adminStore\.joinClub\(inviteCode\.value\)/)
})

test('the relationship directory does not initialize Create or Join domain state', () => {
  assert.match(
    clubsView,
    /await adminStore\.loadClubs\(\)\s*if \(isDirectoryExperience\.value\) \{[\s\S]*?return\s*}\s*await adminStore\.loadSetup\(\)/,
  )
})
