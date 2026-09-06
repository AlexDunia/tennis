import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  createMinimalClubSetup,
} from '../src/config/admin.js'

import {
  normalizeClubSetup,
} from '../src/utils/admin/clubSetup.js'

const heroSource = readFileSync(
  'src/components/club/ClubIdentityHero.vue',
  'utf8',
)

const editorSource = readFileSync(
  'src/components/club/ClubMediaEditor.vue',
  'utf8',
)

const mediaSource = readFileSync(
  'src/utils/club/clubMedia.js',
  'utf8',
)

const clubViewSource = readFileSync(
  'src/views/ClubView.vue',
  'utf8',
)

const createSource = readFileSync(
  'src/components/club/ClubCreatePanel.vue',
  'utf8',
)

test('minimal club setup persists a safe cover preset without inventing club setup data', () => {
  const setup = normalizeClubSetup(
    createMinimalClubSetup({
      name: 'Greenview',
      country: 'Nigeria',
      city: 'Lagos',
      coverPreset: 'forest',
    }),
  )

  assert.equal(setup.workspace.coverPreset, 'forest')
  assert.deepEqual(setup.workspace.courts, [])
  assert.deepEqual(setup.ladders, [])
  assert.deepEqual(setup.rules, {})
})

test('unknown cover preset falls back to the Gorra default', () => {
  const setup = normalizeClubSetup(
    createMinimalClubSetup({
      name: 'Greenview',
      country: 'Nigeria',
      city: 'Lagos',
      coverPreset: 'random-neon',
    }),
  )

  assert.equal(setup.workspace.coverPreset, 'court-green')
})

test('club cover output is a fixed wide crop and the profile hero constrains banner height', () => {
  assert.match(
    mediaSource,
    /\{ width: 1440, height: 450/,
  )

  assert.match(
    heroSource,
    /height:\s*clamp\(90px,\s*9vw,\s*118px\)/,
  )

  assert.match(
    heroSource,
    /object-fit:\s*cover/,
  )
})

test('creation preview and real club profile reuse the same identity hero', () => {
  assert.match(
    createSource,
    /import ClubIdentityHero from '\.\/ClubIdentityHero\.vue'/,
  )

  assert.match(
    clubViewSource,
    /import ClubIdentityHero from '\.\.\/components\/club\/ClubIdentityHero\.vue'/,
  )

  assert.match(createSource, /<ClubIdentityHero/)
  assert.match(clubViewSource, /<ClubIdentityHero/)
})

test('club media editor offers both cropped uploads and curated cover presets', () => {
  assert.match(editorSource, /Crop club logo/)
  assert.match(editorSource, /Crop cover photo/)
  assert.match(editorSource, /Horizontal focus/)
  assert.match(editorSource, /Vertical focus/)
  assert.match(editorSource, /CLUB_COVER_PRESETS/)
})

