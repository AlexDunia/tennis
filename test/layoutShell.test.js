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

test('Ladder and Tournament are first-class destinations in desktop and five-item mobile navigation', () => {
  assert.doesNotMatch(layout, /class="nav-submenu"/)
  assert.match(layout, /section: 'home', label: 'Home'/)
  assert.match(layout, /section: 'play', label: 'Play'/)
  assert.match(layout, /section: 'ladder', label: 'Ladder'/)
  assert.match(layout, /section: 'tournament',[\s\S]*label: 'Tournament'/)
  assert.match(layout, /section: 'club', label: 'Club'/)
  assert.doesNotMatch(layout, /label: 'Challenges'/)
  assert.match(layout, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/)
})

test('admin match setup preserves and restores the previous desktop sidebar state', () => {
  assert.match(layout, /sidebarWasCollapsedBeforeAdminMatch/)
  assert.match(layout, /function beginAdminMatchDrawer\(\)/)
  assert.match(layout, /function endAdminMatchDrawer\(\)/)
  assert.match(layout, /sidebarCollapsed\.value = sidebarWasCollapsedBeforeAdminMatch\.value/)
})

test('the tournaments route owns its body heading and creation action', () => {
  assert.match(tournaments, /<h1>Tournament playground<\/h1>/)
  assert.match(tournaments, /:to="{ name: 'TournamentCreate' }"/)
  assert.match(tournaments, /class="tournament-filters"/)
})
