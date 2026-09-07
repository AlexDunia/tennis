import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clubs = readFileSync(
  'src/views/ClubsView.vue',
  'utf8',
)

const clubCss = readFileSync(
  'src/assets/club-reference32.css',
  'utf8',
)

test('club directory uses a useful two-column desktop composition', () => {
  assert.match(
    clubs,
    /\.club-directory-section \.ref-club-directory[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  )

  assert.match(
    clubs,
    /@media \(max-width: 900px\)[\s\S]*grid-template-columns:\s*1fr/,
  )
})

test('club directory avoids the AI grouped-list treatment', () => {
  assert.match(
    clubs,
    /\.ref-club-directory[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none/,
  )

  assert.doesNotMatch(
    clubs,
    /box-shadow:\s*inset\s+3px\s+0\s+0/,
  )
})

test('current club remains clear without a green slab', () => {
  assert.match(
    clubs,
    /\.ref-club-directory-row\.active[\s\S]*border-color:\s*rgba\(8,\s*173,\s*43,\s*0\.26\)/,
  )

  assert.match(
    clubs,
    /Current club/,
  )
})

test('club cards use deliberate feedback and accessibility gates', () => {
  assert.match(
    clubs,
    /@media \(hover: hover\) and \(pointer: fine\)/,
  )

  assert.match(
    clubs,
    /:active:not\(:disabled\)[\s\S]*scale\(0\.985\)/,
  )

  assert.match(
    clubs,
    /@media \(prefers-reduced-motion: reduce\)/,
  )

  assert.doesNotMatch(
    clubs,
    /transition:\s*all/,
  )
})

test('club section hierarchy uses useful composition instead of decorative kicker UI', () => {
  assert.match(
    clubs,
    /club-section-heading__rule/,
  )

  assert.match(
    clubs,
    /club-section-heading__count/,
  )

  assert.match(
    clubCss,
    /GORRA CLUB SECTION HIERARCHY/,
  )

  assert.match(
    clubCss,
    /\.ref-section-heading::after[\s\S]*height:\s*1px/,
  )
})
