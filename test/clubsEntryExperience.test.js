import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clubsView = readFileSync('src/views/ClubsView.vue', 'utf8')
const routerSource = readFileSync('src/router/index.js', 'utf8')
const clubCreatePanel = readFileSync('src/components/club/ClubCreatePanel.vue', 'utf8')

function clubsRoute() {
  const start = routerSource.indexOf("path: '/clubs'")
  const end = routerSource.indexOf("path: '/clubs/:clubId", start)
  return routerSource.slice(start, end)
}

function selectClubSource() {
  const start = clubsView.indexOf('async function selectClub')
  const end = clubsView.indexOf('\n}', start) + 2
  return clubsView.slice(start, end)
}

test('the Clubs directory is available in the normal authenticated application shell', () => {
  const route = clubsRoute()
  assert.match(route, /name: 'Clubs'/)
  assert.match(route, /primarySection: 'club'/)
  assert.doesNotMatch(route, /permission: 'club\.manage'/)
  assert.doesNotMatch(route, /onboardingFlow: true/)
})

test('the Clubs entry derives directory state from real club relationships', () => {
  assert.match(clubsView, /const directoryClubs = computed/)
  assert.match(clubsView, /adminStore\.clubs/)
  assert.match(clubsView, /const clubCount = computed\(\(\) => directoryClubs\.value\.length\)/)
  assert.match(clubsView, /v-for="club in directoryClubs"/)
  assert.match(clubsView, /club\.id === adminStore\.activeClubId/)
})

test('selecting a directory relationship does not silently switch the active club', () => {
  const selectClub = selectClubSource()
  assert.match(selectClub, /clubId === adminStore\.activeClubId/)
  assert.match(selectClub, /name: 'Club'/)
  assert.match(selectClub, /name: 'ClubVisit'/)
  assert.doesNotMatch(selectClub, /adminStore\.switchClub/)
})

test('the directory exposes direct Create and Join flows without a directory-add state', () => {
  assert.match(clubsView, /<strong>Join a club<\/strong>/)
  assert.match(clubsView, /<strong>Create a club<\/strong>/)
  assert.match(
    clubsView,
    /function openCreateClubFlow\(\) \{\s*router\.push\(\{ name: 'Clubs', query: \{ view: 'create' \} \}\)/,
  )
  assert.match(
    clubsView,
    /function openJoinClubFlow\(\) \{\s*router\.push\(\{ name: 'PlayerClubJoin' \}\)/,
  )
  assert.doesNotMatch(clubsView, /directory-add/)
})

test('Create and Join forms delegate relationship changes to AdminStore', () => {
  assert.match(clubCreatePanel, /const result = await adminStore\.createClub\(input\)/)
  assert.match(clubsView, /await adminStore\.previewInvite\(/)
  assert.match(clubsView, /await adminStore\.joinClub\(/)
})

test('the relationship directory does not initialize Create or Join domain state', () => {
  assert.match(
    clubsView,
    /await adminStore\.loadClubs\(\)\s*if \(isDirectoryExperience\.value\) \{[\s\S]*?return\s*}\s*await adminStore\.loadSetup\(\)/,
  )
})
