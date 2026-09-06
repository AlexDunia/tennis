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

