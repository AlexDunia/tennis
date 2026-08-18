import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const router = fs.readFileSync('src/router/index.js', 'utf8')
const layout = fs.readFileSync('src/layouts/DefaultLayout.vue', 'utf8')
const friendlyFlow = fs.readFileSync('src/views/FriendlyMatchFlowView.vue', 'utf8')
const matchDetails = fs.readFileSync('src/views/MatchDetailsView.vue', 'utf8')
const api = fs.readFileSync('src/services/ApiService.js', 'utf8')

test('direct Compete challenge creation preserves the application shell', () => {
  assert.match(router, /path: '\/create-challenge'[\s\S]*component: CompeteChallengeCreateView/)
  assert.doesNotMatch(
    router,
    /path: '\/create-challenge'[\s\S]{0,180}redirect:[\s\S]{0,180}ladder-match\/type/,
  )
  assert.match(layout, /'ChallengeDetails',[\s\S]*'CreateChallenge'/)
})

test('active Play-side challenges open the exact Challenge Details record', () => {
  assert.match(friendlyFlow, /const activeLadderChallenge = computed/)
  assert.match(
    friendlyFlow,
    /name: 'ChallengeDetails',[\s\S]*params: \{ challengeId: activeLadderChallenge\.id \}/,
  )
})

test('result reporting requires a visible preview and participant identity', () => {
  assert.match(matchDetails, /resultPreviewOpen/)
  assert.match(matchDetails, /Review before submitting/)
  assert.match(matchDetails, /submittedBy: playerStore\.currentPlayer\?\.id/)
})

test('the mock challenge API implements accepted, schedule, start, and cancellation cleanup', () => {
  assert.match(api, /challenge\.status = acceptedSchedule \? 'scheduled' : 'accepted'/)
  assert.match(api, /\/challenges\\\/\[\^\/\]\+\\\/schedule/)
  assert.match(api, /\/challenges\\\/\[\^\/\]\+\\\/start/)
  assert.match(api, /cancelledMatch\.status = 'cancelled'/)
})
