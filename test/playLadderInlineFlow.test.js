import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const router = readFileSync('src/router/index.js', 'utf8')
const playHub = readFileSync('src/views/PlayHubView.vue', 'utf8')
const playLadder = readFileSync('src/views/PlayLadderMatchView.vue', 'utf8')
const friendlyStore = readFileSync('src/stores/friendlyMatch.js', 'utf8')
const friendlyFlow = readFileSync('src/views/FriendlyMatchFlowView.vue', 'utf8')

test('Play Ladder uses a normal-shell inline route without creating setup state on entry', () => {
  const route = router.match(/path: '\/play\/ladder'[\s\S]{0,320}/)?.[0] || ''

  assert.match(router, /import PlayLadderMatchView/)
  assert.match(route, /name: 'PlayLadderMatch'/)
  assert.match(route, /primarySection: 'play'/)
  assert.doesNotMatch(route, /friendlyFlow|immersive|hideBottomNav/)
  assert.match(playHub, /if \(mode === 'ladder'\) \{[\s\S]{0,100}name: 'PlayLadderMatch'/)
  assert.doesNotMatch(
    playHub.match(/function startMatch\(mode\)[\s\S]{0,360}/)?.[0] || '',
    /chooseMatchType\('ladder'\)/,
  )
})

test('inline Play Ladder uses scoped roster, canonical availability, and challenge-linked invitations', () => {
  assert.match(playLadder, /ladderRosterFromSetup/)
  assert.match(playLadder, /effectiveLadderRoster/)
  assert.match(playLadder, /getLadderPlayerAvailability/)
  assert.match(playLadder, /evaluateLadderMatchup/)
  assert.doesNotMatch(playLadder, /playerStore/)
  assert.match(playLadder, /createChallenge\(\{[\s\S]{0,900}notificationIntent: 'ladder_challenge_email'/)
  assert.match(playLadder, /createLadderInvitation\(identity\)/)
  assert.match(playLadder, /createInvitation: false/)
  assert.match(playLadder, /@save="saveCustomRules"/)
  assert.match(playLadder, /Save the custom rules before sending the challenge/)
})

test('Ladder invitation acceptance uses the signed-in invitee and never auto-starts play', () => {
  assert.match(friendlyStore, /function bindSetupClub/)
  assert.match(friendlyStore, /function createLadderInvitation/)
  assert.match(friendlyStore, /function chooseTiming\(timing, creator, options = \{\}\)/)
  assert.match(friendlyFlow, /async function joinAsCurrentUser/)
  assert.match(friendlyFlow, /acceptChallenge\([\s\S]{0,180}currentIdentity\.value\.id/)
  const joinHandler = friendlyFlow.match(/async function joinAsCurrentUser\(\)[\s\S]{0,2500}/)?.[0] || ''
  assert.doesNotMatch(joinHandler, /startOrResumeLadderMatch/)
})

