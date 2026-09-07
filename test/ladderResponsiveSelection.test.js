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

  assert.match(layout, /--app-shell-content-width:\s*80%/)
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
  assert.match(
    ladder,
    /\.ladder-row--selected[\s\S]*background:\s*#163d2b/,
  )
  assert.match(
    ladder,
    /\.ladder-row--eligible[\s\S]*background:\s*#fff/,
  )
  assert.doesNotMatch(ladder, />\s*Cancel\s*</)
})

test('challenge focus physically reflows the real cards instead of leaving blank ranked gaps', () => {
  assert.match(
    ladder,
    /const displayPlayers = computed\(\(\) =>[\s\S]*challengeSelectionActive\.value[\s\S]*challengeFocusPlayers\.value[\s\S]*players\.value/,
  )

  assert.match(
    ladder,
    /<TransitionGroup[\s\S]*name="ladder-focus"[\s\S]*class="ladder-list__rows"/,
  )

  assert.match(ladder, /v-for="player in displayPlayers"/)
  assert.match(ladder, /\.ladder-focus-move/)
  assert.match(ladder, /\.ladder-focus-leave-active/)
})

test('challenge backdrop fades instead of appearing as an abrupt modal layer', () => {
  assert.match(
    ladder,
    /<Transition name="challenge-backdrop">[\s\S]*challenge-selection-backdrop/,
  )

  assert.match(
    ladder,
    /\.challenge-backdrop-enter-active[\s\S]*transition:\s*opacity/,
  )
})

test('challenge focus uses controlled motion to align the compact stack below the header', () => {
  assert.match(ladder, /function animateChallengePageTo/)
  assert.match(ladder, /requestAnimationFrame/)
  assert.match(ladder, /Math\.pow\(1 - progress, 4\)/)
  assert.match(ladder, /list\.scrollTop = 0/)
  assert.match(ladder, /--challenge-window-max-height/)
  assert.doesNotMatch(ladder, /window\.scrollBy/)
  assert.doesNotMatch(ladder, /groupHeight > availableHeight/)
  assert.doesNotMatch(ladder, /hasRelevantAbove/)
  assert.doesNotMatch(ladder, /hasRelevantBelow/)
})

test('large challenge ranges scroll inside the compact focus stack without globally freezing the page', () => {
  assert.match(ladder, /overflow-y:\s*auto/)
  assert.match(ladder, /overscroll-behavior:\s*contain/)
  assert.match(ladder, /max-height:[\s\S]*--challenge-window-max-height/)

  assert.doesNotMatch(
    ladder,
    /document\.addEventListener\('wheel'/,
  )
  assert.doesNotMatch(
    ladder,
    /document\.addEventListener\('touchmove'/,
  )
  assert.doesNotMatch(
    ladder,
    /document\.documentElement[\s\S]*overflow[\s\S]*hidden/,
  )
})

test('cancelling challenge focus restores the player management context and original page position', () => {
  assert.match(ladder, /challengeOriginScrollY/)
  assert.match(ladder, /challengeOriginListScrollTop/)
  assert.match(ladder, /managedPlayerId\.value = playerId/)
  assert.match(
    ladder,
    /animateChallengePageTo\(\s*challengeOriginScrollY\.value/,
  )
})

test('player management actions remain visible lines without horizontal scrolling', () => {
  assert.match(
    playerOptions,
    /ladder-player-options__line--primary/,
  )
  assert.match(
    playerOptions,
    /ladder-player-options__line--secondary/,
  )
  assert.doesNotMatch(playerOptions, /overflow-x:\s*auto/)
})

