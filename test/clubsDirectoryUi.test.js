import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routes = readFileSync('src/router/index.js', 'utf8')
const clubsView = readFileSync('src/views/ClubsView.vue', 'utf8')
const clubView = readFileSync('src/views/ClubView.vue', 'utf8')
const layoutView = readFileSync('src/layouts/DefaultLayout.vue', 'utf8')
const clubReferenceCss = readFileSync('src/assets/club-reference32.css', 'utf8')

function clubsRoute() {
  const start = routes.indexOf("path: '/clubs'")
  const end = routes.indexOf("path: '/clubs/:clubId", start)
  return routes.slice(start, end)
}

function selectClubSource() {
  const start = clubsView.indexOf('async function selectClub')
  const end = clubsView.indexOf('\n}', start) + 2
  return clubsView.slice(start, end)
}

test('Club is one normal directory within the Club primary section', () => {
  const route = clubsRoute()

  assert.match(route, /name: 'Clubs'/)
  assert.match(route, /title: 'Club'/)
  assert.match(route, /primarySection: 'club'/)
  assert.match(clubsView, /class="club-directory-hub"/)
  assert.match(clubsView, /Open a club you belong to\./)
})

test('Join and Create are always visible on the normal Club directory', () => {
  assert.match(clubsView, /<strong>Join a club<\/strong>/)
  assert.match(clubsView, /<strong>Create a club<\/strong>/)
  assert.match(clubsView, /Use an invitation from a club\./)
  assert.match(clubsView, /Start a new club you manage\./)
  assert.doesNotMatch(clubsView, /directory-add/)
})

test('existing clubs render underneath the actions as one club per row', () => {
  assert.match(clubsView, /id="your-clubs-heading">Your clubs<\/h2>/)
  assert.match(clubsView, /class="ref-club-directory"/)
  assert.match(clubsView, /class="ref-club-directory-row"/)
  assert.match(clubsView, /class="ref-club-directory-logo"/)
  assert.match(
    clubsView,
    /\.club-directory-section \.ref-club-directory[\s\S]*grid-template-columns:\s*1fr/,
  )
  assert.match(clubReferenceCss, /\.ref-club-directory/)
})

test('active clubs open Club while other directory clubs open ClubVisit without switching state', () => {
  assert.match(
    clubsView,
    /:to="club\.isActive[\s\S]*name: 'Club'[\s\S]*name: 'ClubVisit'/,
  )

  const selectClub = selectClubSource()
  assert.match(selectClub, /clubId === adminStore\.activeClubId/)
  assert.match(selectClub, /name: 'Club'/)
  assert.match(selectClub, /name: 'ClubVisit'/)
  assert.doesNotMatch(selectClub, /adminStore\.switchClub/)
})

test('the Club landing does not duplicate Members with a second Add members state card', () => {
  assert.doesNotMatch(clubView, /const clubState = computed/)
  assert.doesNotMatch(clubView, /class="ref-club-state"/)
  assert.match(clubView, /canManage\s*\?\s*'Manage your club'/)
  assert.match(clubView, /name: 'ClubMembers'/)
})

test('the one sidebar Club item opens the directory', () => {
  assert.match(layoutView, /to: \{ name: 'Clubs' \}, section: 'club', label: 'Club'/)
  assert.doesNotMatch(layoutView, /to: \{ name: 'Club' \}, section: 'club', label: 'Club'/)
  assert.match(layoutView, />All clubs<\/span>/)
})

test('the Club directory uses the shell heading while nested Club screens own theirs', () => {
  assert.match(layoutView, /const clubOwnsPageHeading = computed/)
  assert.doesNotMatch(layoutView, /name === 'Clubs' \|\|/)
  assert.match(layoutView, /name === 'ClubMembers'/)
  assert.match(layoutView, /name === 'ClubSettingsHub'/)
  assert.match(clubsView, /class="club-directory-hub"/)
})

test('Join and Create share a two-column decision surface before the vertical club list', () => {
  assert.match(
    clubsView,
    /\.club-entry-options[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  )
  assert.match(
    clubsView,
    /\.club-directory-section \.ref-club-directory[\s\S]*grid-template-columns:\s*1fr/,
  )
})
