import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clubsView = readFileSync(
  'src/views/ClubsView.vue',
  'utf8',
)

const layoutView = readFileSync(
  'src/layouts/DefaultLayout.vue',
  'utf8',
)

test('zero-club state exposes Join and Create immediately', () => {
  assert.match(
    clubsView,
    /clubDirectoryState === 'empty'/,
  )

  assert.match(
    clubsView,
    /<strong>Join a club<\/strong>/,
  )

  assert.match(
    clubsView,
    /<strong>Create a club<\/strong>/,
  )
})

test('existing clubs use the compact left-mark and stacked-copy card pattern', () => {
  assert.match(
    clubsView,
    /class="club-directory-card__mark"/,
  )

  assert.match(
    clubsView,
    /class="club-directory-card__copy"/,
  )

  assert.match(
    clubsView,
    /clubInitials\(club\.name\)/,
  )

  assert.match(
    clubsView,
    /relationshipLabel\(club\.role\)/,
  )
})

test('existing-club directory progressively discloses Join and Create behind Add club', () => {
  assert.match(
    clubsView,
    /class="add-club-button"/,
  )

  assert.match(
    clubsView,
    /@click="showAddClubDecision"/,
  )

  assert.match(
    clubsView,
    /routeView === 'directory-add'/,
  )

  assert.match(
    clubsView,
    /Back to your clubs/,
  )
})

test('directory cards keep icon or club mark beside title and supporting copy', () => {
  assert.match(
    clubsView,
    /grid-template-columns:\s*48px minmax\(0,\s*1fr\) 20px/,
  )

  assert.match(
    clubsView,
    /directory-choice-card__icon/,
  )

  assert.match(
    clubsView,
    /directory-choice-card__copy/,
  )
})

test('the club chooser does not render active-club contextual navigation', () => {
  assert.match(
    layoutView,
    /route\.name !== 'Clubs'/,
  )
})
