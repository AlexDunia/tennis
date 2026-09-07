import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  CLUB_DIRECTORY_STORAGE_KEY,
} from '../src/config/admin.js'

import {
  createClub,
  getClubDirectory,
} from '../src/services/AdminService.js'

function createMemoryStorage() {
  const values = new Map()

  return {
    getItem(key) {
      return values.has(key)
        ? values.get(key)
        : null
    },

    setItem(key, value) {
      values.set(key, String(value))
    },

    removeItem(key) {
      values.delete(key)
    },
  }
}

test('the club creator is simply an admin membership', async () => {
  const originalWindow = globalThis.window
  const localStorage = createMemoryStorage()

  globalThis.window = { localStorage }

  try {
    const result = await createClub(
      {
        name: 'Dunia Media',
        country: 'Nigeria',
        city: 'Port Harcourt',
      },
      { userId: 'alex' },
    )

    assert.equal(result.membership.role, 'admin')
    assert.equal('createdByUserId' in result.club, false)

    const directory = await getClubDirectory({
      userId: 'alex',
    })

    assert.equal(
      'createdByUserId' in directory.clubs[0],
      false,
    )

    const persisted = JSON.parse(
      localStorage.getItem(
        CLUB_DIRECTORY_STORAGE_KEY,
      ),
    )

    assert.equal(
      'createdByUserId' in persisted.clubs[0],
      false,
    )
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window
    } else {
      globalThis.window = originalWindow
    }
  }
})

test('non-active club preview uses the full-width shell context strip and accordion summaries', () => {
  const source = readFileSync(
    'src/views/ClubVisitView.vue',
    'utf8',
  )

  const layout = readFileSync(
    'src/layouts/DefaultLayout.vue',
    'utf8',
  )

  assert.match(
    source,
    /<Teleport to="#app-context-strip-root">/,
  )

  assert.match(
    layout,
    /id="app-context-strip-root"/,
  )

  assert.match(
    layout,
    /\.app-context-strip-root:not\(:empty\)[\s\S]*position:\s*sticky[\s\S]*top:\s*var\(--app-header-height\)/,
  )

  assert.match(
    source,
    /You’re viewing \{\{ club\.name \}\}\./,
  )

  assert.match(
    source,
    /is your active club\./,
  )

  assert.match(
    source,
    /Switch to \$\{club\.name\}/,
  )

  assert.match(
    source,
    /to use your \{\{ relationshipLabel \}\} access\./,
  )

  assert.match(
    source,
    /\.club-preview-context\s*\{[\s\S]*background:\s*#163d2b/,
  )

  assert.match(
    source,
    /\.club-preview-context__inner[\s\S]*width:\s*var\(--app-header-content-width\)/,
  )

  assert.match(
    source,
    /\.club-preview-context__link[\s\S]*color:\s*#d8ff47[\s\S]*text-decoration:\s*underline/,
  )

  assert.match(source, /FlowIcon name="users"/)
  assert.match(source, /FlowIcon name="ladder"/)
  assert.match(source, /FlowIcon name="trophy"/)
  assert.match(source, /FlowIcon name="chevron-down"/)

  assert.doesNotMatch(source, /People in this club/)
  assert.doesNotMatch(source, /Active ladders/)
  assert.doesNotMatch(source, /Club tournaments/)
  assert.doesNotMatch(source, /club-visit-nav/)
  assert.doesNotMatch(source, /Club settings/)
})

test('the nested page title still lives inside the one global application header', () => {
  const layout = readFileSync(
    'src/layouts/DefaultLayout.vue',
    'utf8',
  )

  assert.match(
    layout,
    /<header[\s\S]*class="app-header"/,
  )

  assert.match(
    layout,
    /<div v-if="nestedHeader" class="nested-header-context">/,
  )

  assert.match(
    layout,
    /\.app-header\s*\{[\s\S]*position:\s*fixed/,
  )

  assert.match(layout, /--app-header-height:\s*76px/)
  assert.match(
    layout,
    /@media \(max-width: 767px\)[\s\S]*--app-header-height:\s*80px/,
  )
})

test('club directory and active-club sections have quiet structural hierarchy', () => {
  const clubsView = readFileSync(
    'src/views/ClubsView.vue',
    'utf8',
  )

  const clubStyles = readFileSync(
    'src/assets/club-reference32.css',
    'utf8',
  )

  assert.match(
    clubsView,
    /\.club-directory-section \.ref-club-directory[\s\S]*gap:\s*0[\s\S]*overflow:\s*hidden/,
  )

  assert.match(
    clubsView,
    /\.ref-club-directory-row \+ \.ref-club-directory-row[\s\S]*border-top/,
  )

  assert.doesNotMatch(
    clubsView,
    /ref-club-directory-row:not\(:last-child\)[\s\S]*margin-bottom:\s*16px/,
  )

  assert.match(
    clubStyles,
    /\.ref-section-heading,[\s\S]*\.ref-members-head[\s\S]*border-bottom:\s*1px solid/,
  )

  assert.match(
    clubStyles,
    /\.ref-club-manage \.ref-choice-stack[\s\S]*overflow:\s*hidden/,
  )
})

test('active club keeps member-facing areas visible while management stays permission-gated', () => {
  const clubView = readFileSync(
    'src/views/ClubView.vue',
    'utf8',
  )

  const memberView = readFileSync(
    'src/views/ClubMembersView.vue',
    'utf8',
  )

  assert.match(clubView, /title:\s*'Members'/)
  assert.match(clubView, /title:\s*'Ladders'/)
  assert.match(clubView, /title:\s*'Tournaments'/)
  assert.match(
    clubView,
    /if \(canManage\.value\)[\s\S]*title:\s*'Club settings'/,
  )
  assert.match(
    memberView,
    /v-if="canManage"[\s\S]*id="member-add-people"/,
  )
})

test('club directory continues to preview a non-active club without switching as a side effect', () => {
  const clubsView = readFileSync(
    'src/views/ClubsView.vue',
    'utf8',
  )

  const selectBlock =
    clubsView.match(
      /async function selectClub\(clubId\)[\s\S]*?\n}/,
    )?.[0] || ''

  assert.match(
    selectBlock,
    /clubId === adminStore\.activeClubId/,
  )

  assert.match(
    selectBlock,
    /name:\s*'ClubVisit'/,
  )

  assert.doesNotMatch(selectBlock, /switchClub/)
})

