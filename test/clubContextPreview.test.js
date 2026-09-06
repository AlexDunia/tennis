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

test('creating a club keeps creator identity separate from the admin permission role', async () => {
  const originalWindow = globalThis.window
  const localStorage = createMemoryStorage()

  globalThis.window = {
    localStorage,
  }

  try {
    const result = await createClub(
      {
        name: 'Dunia Media',
        country: 'Nigeria',
        city: 'Port Harcourt',
      },
      {
        userId: 'alex',
      },
    )

    assert.equal(
      result.club.createdByUserId,
      'alex',
    )

    assert.equal(
      result.membership.role,
      'admin',
    )

    const directory =
      await getClubDirectory({
        userId: 'alex',
      })

    assert.equal(
      directory.clubs[0]
        .createdByUserId,
      'alex',
    )

    const persisted = JSON.parse(
      localStorage.getItem(
        CLUB_DIRECTORY_STORAGE_KEY,
      ),
    )

    assert.equal(
      persisted.clubs[0]
        .createdByUserId,
      'alex',
    )
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window
    } else {
      globalThis.window =
        originalWindow
    }
  }
})

test('non-active club preview is not a duplicate mini app', () => {
  const source = readFileSync(
    'src/views/ClubVisitView.vue',
    'utf8',
  )

  assert.doesNotMatch(
    source,
    /club-visit-nav/,
  )

  assert.doesNotMatch(
    source,
    /Visiting another club/,
  )

  assert.doesNotMatch(
    source,
    /Club settings/,
  )

  assert.doesNotMatch(
    source,
    /name:\s*'ClubMembers'/,
  )

  assert.doesNotMatch(
    source,
    /name:\s*'Rankings'/,
  )

  assert.doesNotMatch(
    source,
    /name:\s*'Tournaments'/,
  )

  assert.match(
    source,
    /Switch to this club/,
  )

  assert.match(
    source,
    /remains your active club/,
  )
})

test('active club and non-active club remain separate router contexts', () => {
  const router = readFileSync(
    'src/router/index.js',
    'utf8',
  )

  assert.match(
    router,
    /if\s*\(clubId === adminStore\.activeClubId\)[\s\S]*name:\s*'Club'/,
  )

  assert.match(
    router,
    /to\.params\.section[\s\S]*name:\s*'ClubVisit'/,
  )
})

test('club directory continues to route without switching as a side effect', () => {
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

  assert.doesNotMatch(
    selectBlock,
    /switchClub/,
  )
})

