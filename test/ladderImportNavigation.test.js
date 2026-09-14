import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LADDER_IMPORT_ORIGINS,
  ladderImportBackRoute,
  normalizeLadderImportOrigin,
} from '../src/utils/ladderImportNavigation.js'

test('ladder import accepts only known internal origins', () => {
  assert.equal(
    normalizeLadderImportOrigin('setup-members'),
    LADDER_IMPORT_ORIGINS.SETUP_MEMBERS,
  )

  assert.equal(
    normalizeLadderImportOrigin('ladder'),
    LADDER_IMPORT_ORIGINS.LADDER,
  )

  assert.equal(
    normalizeLadderImportOrigin('https://evil.example'),
    LADDER_IMPORT_ORIGINS.LADDER,
  )

  assert.equal(
    normalizeLadderImportOrigin('/some/random/route'),
    LADDER_IMPORT_ORIGINS.LADDER,
  )
})

test('ladder origin returns to the same selected ladder', () => {
  assert.deepEqual(
    ladderImportBackRoute({
      origin: 'ladder',
      ladderId: 'open-singles',
    }),
    {
      name: 'Rankings',
      query: {
        ladder: 'open-singles',
      },
    },
  )
})

test('setup origin returns to the same ladder add-people step', () => {
  assert.deepEqual(
    ladderImportBackRoute({
      origin: 'setup-members',
      ladderId: 'mens-singles',
    }),
    {
      name: 'LadderSetup',
      params: {
        ladderId: 'mens-singles',
        step: 'members',
      },
    },
  )
})

test('missing ladder id falls back to Ladder home', () => {
  assert.deepEqual(
    ladderImportBackRoute({
      origin: 'https://evil.example',
      ladderId: '',
    }),
    {
      name: 'Rankings',
    },
  )
})
