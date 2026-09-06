import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routes = readFileSync('src/router/index.js', 'utf8')

const clubsView = readFileSync(
  'src/views/ClubsView.vue',
  'utf8',
)

const clubView = readFileSync(
  'src/views/ClubView.vue',
  'utf8',
)

const layoutView = readFileSync(
  'src/layouts/DefaultLayout.vue',
  'utf8',
)

const clubReferenceCss = readFileSync(
  'src/assets/club-reference32.css',
  'utf8',
)

test('Club is one simple directory with one heading and one paragraph', () => {
  assert.match(routes, /title: 'Club'/)
  assert.match(
    routes,
    /Join a club, create one, or open one you already belong to\./,
  )

  assert.doesNotMatch(
    clubsView,
    /<p class="eyebrow">Clubs<\/p>/,
  )
})

test('Join and Create are always visible on the normal Club directory', () => {
  assert.match(clubsView, /<strong>Join a club<\/strong>/)
  assert.match(clubsView, /<strong>Create a club<\/strong>/)
  assert.match(clubsView, /Use an invitation from a club\./)
  assert.match(clubsView, /Start a new club you manage\./)

  assert.doesNotMatch(
    clubsView,
    /routeView === 'directory-add'/,
  )
})

test('existing clubs render underneath the actions as one club per row', () => {
  assert.match(clubsView, /id="your-clubs-heading">Your clubs<\/h2>/)
  assert.match(clubsView, /class="ref-club-directory"/)
  assert.match(clubsView, /class="ref-club-directory-row"/)
  assert.match(clubsView, /class="ref-club-directory-logo"/)

  assert.match(
    clubReferenceCss,
    /\.ref-club-directory\s*\{[\s\S]*grid-template-columns:\s*1fr/,
  )

  assert.match(
    clubReferenceCss,
    /grid-template-columns:\s*66px minmax\(0,\s*1fr\) 18px/,
  )
})

test('the current club stays clickable and every club opens the real Club surface', () => {
  assert.match(
    clubsView,
    /if \(clubId !== adminStore\.activeClubId\)[\s\S]*await adminStore\.switchClub\(clubId\)/,
  )

  assert.match(
    clubsView,
    /await router\.push\(\{ name: 'Club' \}\)/,
  )

  assert.doesNotMatch(
    clubsView,
    /:disabled="adminStore\.isLoading \|\| club\.isActive"/,
  )
})

test('the Club landing does not duplicate Members with a second Add members state card', () => {
  assert.doesNotMatch(clubView, /const clubState = computed/)
  assert.doesNotMatch(clubView, /class="ref-club-state"/)

  assert.match(clubView, />Manage your club<\/h2>/)
  assert.match(clubView, /title: 'Members'/)
  assert.match(clubView, /name: 'ClubMembers'/)
})

test('the one sidebar Club item opens the directory, not a second hidden Club concept', () => {
  assert.match(
    layoutView,
    /to: \{ name: 'Clubs' \}, section: 'club', label: 'Club'/,
  )

  assert.doesNotMatch(
    layoutView,
    /to: \{ name: 'Club' \}, section: 'club', label: 'Club'/,
  )

  assert.match(layoutView, />All clubs<\/span>/)
})

test('the Club directory uses the normal shell title while nested Club screens own their header', () => {
  assert.match(layoutView, /const clubOwnsPageHeading = computed/)

  assert.doesNotMatch(
    layoutView,
    /name === 'Clubs' \|\|/,
  )

  assert.match(layoutView, /name === 'ClubMembers'/)
  assert.match(layoutView, /name === 'ClubSettingsHub'/)

  assert.match(
    clubsView,
    /ref-choice-stack ref-club-entry-grid/,
  )

  assert.doesNotMatch(
    clubsView,
    /<h1 ref="heading" tabindex="-1">\{\{ directoryHeading \}\}<\/h1>/,
  )
})

test('Join and Create share a two-column decision surface before the vertical club list', () => {
  assert.match(
    clubsView,
    /\.ref-club-entry-grid[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  )

  assert.match(
    clubReferenceCss,
    /\.ref-club-directory[\s\S]*grid-template-columns:\s*1fr/,
  )
})
