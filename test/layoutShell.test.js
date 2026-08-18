import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync('src/layouts/DefaultLayout.vue', 'utf8')
const creation = readFileSync('src/views/TournamentCreate.vue', 'utf8')
const tournaments = readFileSync('src/views/compete/TournamentsListView.vue', 'utf8')

test('shell pages use one shared header and body width while focused flows keep their override', () => {
  assert.match(layout, /--app-shell-content-width:\s*min\(92%, 1280px\)/)
  assert.match(layout, /\.header-content\s*{[^}]*width:\s*var\(--app-shell-content-width\)/s)
  assert.match(layout, /\.content\s*{[^}]*width:\s*var\(--app-shell-content-width\)/s)
  assert.match(layout, /\.content--fullscreen,[^{]*\.content--public\s*{[^}]*width:\s*100%/s)
})

test('tournament creation keeps the normal shell and fills its shared content area', () => {
  assert.doesNotMatch(layout, /usesTournamentCreateRail/)
  assert.match(
    layout,
    /showSidebar = computed\(\(\) => showAppChrome\.value && !isMobileViewport\.value\)/,
  )
  assert.match(creation, /\.tournament-creation-shell\s*{[^}]*width:\s*100%/s)
  assert.doesNotMatch(creation, /width:\s*min\(620px, 100%\)/)
})

test('Compete children live in the desktop sidebar and remain reachable in mobile navigation', () => {
  assert.match(layout, /class="nav-submenu"/)
  assert.match(layout, /label: 'Ladder'/)
  assert.match(layout, /label: 'Challenges'/)
  assert.match(layout, /label: 'Tournaments'/)
  assert.match(layout, /showCompeteSectionShell && isMobileViewport/)
})

test('the tournaments route owns its body heading and creation action', () => {
  assert.match(tournaments, /<h1>Tournament playground<\/h1>/)
  assert.match(tournaments, /:to="{ name: 'TournamentCreate' }"/)
  assert.match(tournaments, /class="tournament-filters"/)
})
