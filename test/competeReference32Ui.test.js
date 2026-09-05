import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const mainSource = readFileSync('src/main.js', 'utf8')
const layoutSource = readFileSync('src/layouts/DefaultLayout.vue', 'utf8')
const ladderSource = readFileSync('src/views/compete/LadderView.vue', 'utf8')
const queueSource = readFileSync('src/views/compete/ChallengesQueueView.vue', 'utf8')
const createSource = readFileSync('src/views/compete/CompeteChallengeCreateView.vue', 'utf8')
const detailsSource = readFileSync('src/views/ChallengeDetailsView.vue', 'utf8')
const competeCss = readFileSync('src/assets/compete-reference32.css', 'utf8')

test('Compete presentation stylesheet is loaded without replacing domain architecture', () => {
  assert.match(mainSource, /compete-reference32\.css/)
  assert.match(competeCss, /\.gorra-compete-ref/)
  assert.match(ladderSource, /gorra-compete-ref gorra-ladder-ref ladder-view/)
})

test('Ladder keeps existing service-owned eligibility and canonical live-match flow', () => {
  assert.match(ladderSource, /getEligibleLadderOpponents/)
  assert.match(ladderSource, /isEligibleLadderOpponent/)
  assert.match(ladderSource, /startOrResumeLadderMatch/)
  assert.match(ladderSource, /AdminLadderMatchDrawer/)

  assert.doesNotMatch(
    competeCss,
    /challengeRangeUp\s*:/,
  )
})

test('Ladder page removes redundant breadcrumb and exposes Challenges clearly', () => {
  assert.doesNotMatch(
    ladderSource,
    /class="ladder-breadcrumb"/,
  )

  assert.match(
    ladderSource,
    /class="compete-secondary"[\s\S]*name: 'Challenges'/,
  )

  assert.match(
    ladderSource,
    /class="compete-primary"[\s\S]*name: 'CreateChallenge'/,
  )
})

test('challenge queue is one-click rows rather than rows plus View details buttons', () => {
  assert.match(queueSource, /class="gorra-compete-ref compete-page challenge-queues"/)
  assert.match(queueSource, />Challenges<\/h1>/)
  assert.match(queueSource, /Challenges you send and receive\./)
  assert.match(queueSource, /@click="openChallenge\(challenge\)"/)
  assert.match(queueSource, /<FlowIcon name="arrow-right"/)

  assert.doesNotMatch(
    queueSource,
    />View details<\/button>/,
  )
})

test('challenge creation remains gated by the existing access and eligibility contracts', () => {
  assert.match(createSource, /verifyLadderCreationAccess/)
  assert.match(createSource, /ladderWindowFor/)
  assert.match(createSource, /ladderMovementFor/)
  assert.match(createSource, /ACTIVE_LADDER_CHALLENGE_STATUSES/)
  assert.match(createSource, /challengeStore\.createChallenge/)

  assert.match(createSource, />New challenge<\/h1>/)
  assert.match(createSource, />Choose opponent<\/h2>/)
  assert.match(createSource, />When will you play\?<\/h2>/)
})

test('challenge details keeps every lifecycle action while removing duplicate status chrome', () => {
  assert.match(detailsSource, /acceptChallenge/)
  assert.match(detailsSource, /declineChallenge/)
  assert.match(detailsSource, /withdrawChallenge/)
  assert.match(detailsSource, /scheduleChallenge/)
  assert.match(detailsSource, /startChallenge/)
  assert.match(detailsSource, /continueMatch/)
  assert.match(detailsSource, /confirmResult/)
  assert.match(detailsSource, /finalizeResultAsAdmin/)

  assert.doesNotMatch(
    detailsSource,
    /class="status-pill"/,
  )

  assert.match(
    detailsSource,
    /<h1>\{\{ stateCopy\.title \}\}<\/h1>/,
  )
})

test('Compete routes own their heading instead of duplicating the shell caption', () => {
  assert.match(layoutSource, /const competeOwnsPageHeading = computed/)
  assert.match(layoutSource, /name === 'Challenges'/)
  assert.match(layoutSource, /name === 'CreateChallenge'/)
  assert.match(layoutSource, /name === 'ChallengeDetails'/)
  assert.match(layoutSource, /!competeOwnsPageHeading\.value/)
})

test('responsive Compete CSS preserves single-column mobile flows and reduced motion', () => {
  assert.match(competeCss, /@media \(max-width: 820px\)/)
  assert.match(competeCss, /\.challenge-fields\s*\{[\s\S]*grid-template-columns:\s*1fr/)
  assert.match(competeCss, /@media \(prefers-reduced-motion: reduce\)/)
})
