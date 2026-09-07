import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clubs = readFileSync(
  'src/views/ClubsView.vue',
  'utf8',
)

const clubView = readFileSync(
  'src/views/ClubView.vue',
  'utf8',
)

const hero = readFileSync(
  'src/components/club/ClubIdentityHero.vue',
  'utf8',
)

const clubCss = readFileSync(
  'src/assets/club-reference32.css',
  'utf8',
)

test('club directory stays stacked while join and create remain side by side', () => {
  assert.match(
    clubs,
    /\.club-entry-options[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  )

  assert.match(
    clubs,
    /\.club-directory-section \.ref-club-directory[\s\S]*grid-template-columns:\s*1fr/,
  )

  assert.doesNotMatch(
    clubs,
    /\.club-directory-section \.ref-club-directory[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  )
})

test('club directory uses filled surfaces instead of card strokes', () => {
  assert.match(
    clubs,
    /\.ref-club-directory-row[\s\S]*border:\s*0;[\s\S]*background:\s*#f7f9f7/,
  )

  assert.match(
    clubs,
    /\.ref-club-directory-row\.active[\s\S]*background:\s*#edf7ef/,
  )

  assert.doesNotMatch(
    clubs,
    /box-shadow:\s*inset\s+3px\s+0\s+0/,
  )
})

test('club directory differentiates the primary create action', () => {
  assert.match(
    clubs,
    /club-entry-option--create/,
  )

  assert.match(
    clubs,
    /\.club-entry-option--create[\s\S]*background:\s*#163d2b/,
  )

  assert.match(
    clubs,
    /\.club-entry-option--create \.club-entry-option__arrow[\s\S]*color:\s*#d8ff47/,
  )
})

test('active club profile uses a borderless two-column destination layout', () => {
  assert.match(
    clubView,
    /class="club-profile"/,
  )

  assert.match(
    clubView,
    /\.club-profile \.ref-choice-stack[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[\s\S]*border:\s*0/,
  )

  assert.match(
    clubView,
    /@media \(max-width: 760px\)[\s\S]*grid-template-columns:\s*1fr/,
  )
})

test('club identity hero is profile-shaped rather than an outlined card', () => {
  assert.match(
    hero,
    /\.club-identity-hero[\s\S]*border:\s*0;[\s\S]*background:\s*transparent/,
  )

  assert.match(
    hero,
    /\.club-identity-hero__cover[\s\S]*border-radius:\s*20px/,
  )

  assert.match(
    hero,
    /\.club-identity-hero__stats[\s\S]*grid-template-columns:\s*repeat\(3,\s*max-content\)/,
  )
})

test('club visual feedback is deliberate and accessibility gated', () => {
  assert.match(
    clubs,
    /@media \(hover: hover\) and \(pointer: fine\)/,
  )

  assert.match(
    clubs,
    /@media \(prefers-reduced-motion: reduce\)/,
  )

  assert.doesNotMatch(clubs, /transition:\s*all/)
  assert.doesNotMatch(clubView, /transition:\s*all/)
  assert.doesNotMatch(hero, /transition:\s*all/)
})

test('shared Club headings do not reintroduce decorative strokes', () => {
  assert.match(
    clubCss,
    /GORRA CLUB LIVING SURFACES/,
  )

  assert.match(
    clubCss,
    /\.ref-section-heading,[\s\S]*border-bottom:\s*0/,
  )
})
