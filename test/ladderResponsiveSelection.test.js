import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const ladder = readFileSync(
  'src/views/compete/LadderView.vue',
  'utf8',
)

const layout = readFileSync(
  'src/layouts/DefaultLayout.vue',
  'utf8',
)

const playerOptions = readFileSync(
  'src/components/ladder/LadderPlayerOptions.vue',
  'utf8',
)

test('mobile Ladder does not shrink inside the already-80-percent shell', () => {
  assert.match(
    ladder,
    /@media \(max-width: 767px\)[\s\S]*\.ladder-workspace[\s\S]*width:\s*100%/,
  )

  assert.doesNotMatch(
    ladder,
    /@media \(max-width: 767px\)[\s\S]*\.ladder-workspace[\s\S]*width:\s*85%/,
  )

  assert.match(
    layout,
    /--app-shell-content-width:\s*80%/,
  )
})

test('admin challenge selection has strong selected, soft eligible, paused and mobile context states', () => {
  assert.match(ladder, /mobile-selection-context/)
  assert.match(ladder, /ladder-row--selected/)
  assert.match(ladder, /ladder-row--eligible/)
  assert.match(ladder, /ladder-row--paused/)
  assert.match(ladder, /resetChallengeSelection/)
  assert.doesNotMatch(ladder, />\s*Options open\s*</)
})

test('the normal dynamic application header is allowed on the Ladder route', () => {
  assert.match(
    layout,
    /const showRoutePageContext = computed\(\(\) =>\s*!clubOwnsPageHeading\.value\s*&&\s*!competeOwnsPageHeading\.value/,
  )
})

test('challenge focus uses toaster green and click-away backdrop', () => {
  assert.match(ladder, /challengeSelectionActive/)
  assert.match(ladder, /challenge-selection-backdrop/)
  assert.match(ladder, /@click="resetChallengeSelection"/)
  assert.match(ladder, /\.ladder-row--selected[\s\S]*background:\s*#163d2b/)
  assert.match(ladder, /\.ladder-row--eligible[\s\S]*background:\s*#fff/)
  assert.match(ladder, /\.ladder-row--quiet[\s\S]*blur/)
  assert.doesNotMatch(ladder, />\s*Cancel\s*</)
})

test('desktop player options stay on one row and only wrap responsively', () => {
  assert.match(playerOptions, /ladder-player-options__row/)
  assert.match(playerOptions, /\.ladder-player-options__row[\s\S]*display:\s*flex/)
  assert.match(playerOptions, /@media \(max-width: 767px\)[\s\S]*grid-template-columns/)
})
