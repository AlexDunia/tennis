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

test('admin challenge selection preserves selected, eligible and paused states', () => {
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
  assert.match(ladder, /@click="cancelChallengeSelection"/)
  assert.match(ladder, /\.ladder-row--selected[\s\S]*background:\s*#163d2b/)
  assert.match(ladder, /\.ladder-row--eligible[\s\S]*background:\s*#fff/)
  assert.match(ladder, /\.ladder-row--quiet[\s\S]*blur/)
  assert.doesNotMatch(ladder, />\s*Cancel\s*</)
})

test(
  'challenge selection is cancelled from the selected card and restores its options',
  () => {
    assert.match(
      ladder,
      /function cancelChallengeSelection/,
    )

    assert.match(
      ladder,
      /managedPlayerId\.value = playerId/,
    )

    assert.match(
      ladder,
      /ladder-row__cancel-selection/,
    )

    assert.match(
      ladder,
      /@click\.stop="cancelChallengeSelection"/,
    )

    assert.doesNotMatch(
      ladder,
      /class="selection-guide"/,
    )

    assert.doesNotMatch(
      ladder,
      /class="mobile-selection-context"/,
    )
  },
)

test(
  'player management actions use visible desktop lines and never horizontal scrolling',
  () => {
    assert.match(
      playerOptions,
      /ladder-player-options__line--primary/,
    )

    assert.match(
      playerOptions,
      /ladder-player-options__line--secondary/,
    )

    assert.doesNotMatch(
      playerOptions,
      /overflow-x:\s*auto/,
    )

    assert.match(
      playerOptions,
      /@media \(max-width: 767px\)[\s\S]*grid-template-columns/,
    )
  },
)
