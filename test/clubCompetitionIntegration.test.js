import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routerSource = readFileSync('src/router/index.js', 'utf8')
const playHubSource = readFileSync('src/views/PlayHubView.vue', 'utf8')
const friendlySource = readFileSync('src/views/FriendlyMatchFlowView.vue', 'utf8')
const ladderSource = readFileSync('src/views/compete/LadderView.vue', 'utf8')
const challengeDetailsSource = readFileSync('src/views/ChallengeDetailsView.vue', 'utf8')
const challengeStoreSource = readFileSync('src/stores/challenge.js', 'utf8')
const challengeServiceSource = readFileSync('src/services/ChallengeService.js', 'utf8')
const tournamentListSource = readFileSync('src/views/compete/TournamentsListView.vue', 'utf8')
const tournamentStoreSource = readFileSync('src/stores/tournament.js', 'utf8')
const tournamentCategorySource = readFileSync('src/views/TournamentCategory.vue', 'utf8')
const authSource = readFileSync('src/stores/auth.js', 'utf8')
const playerSource = readFileSync('src/stores/player.js', 'utf8')
const loginSource = readFileSync('src/views/LoginView.vue', 'utf8')

test('Play and Friendly Match remain available without active-club permission gates', () => {
  const playRoute = routerSource.match(
    /path: '\/play',[\s\S]*?name: 'Play',[\s\S]*?primarySection: 'play',[\s\S]*?\n\s*},/,
  )?.[0]
  const friendlyTypeRoute = routerSource.match(
    /path: '\/friendly-match\/type',[\s\S]*?name: 'FriendlyMatchType',[\s\S]*?primarySection: 'play',[\s\S]*?\n\s*},/,
  )?.[0]

  assert.ok(playRoute)
  assert.ok(friendlyTypeRoute)
  assert.doesNotMatch(playRoute, /activeClubPermission|permission:/)
  assert.doesNotMatch(friendlyTypeRoute, /activeClubPermission|permission:/)
  assert.match(playHubSource, /chooseMatchType\('friendly'\)/)
  assert.match(friendlySource, /!draft\.clubId[\s\S]*!adminStore\.activeClubId/)
})

test('new zero-club accounts enter the real Clubs area without role-based onboarding', () => {
  assert.match(loginSource, /\? \{ name: 'Clubs', query: \{ view: 'join', invite:/)
  assert.match(loginSource, /: \{ name: 'Clubs' \}/)
  assert.doesNotMatch(
    loginSource,
    /const destination = isAdmin[\s\S]*name: 'AdminSetup'[\s\S]*name: 'PlayerClubJoin'/,
  )
})

test('Ladder uses active club context and the existing eligibility authority', () => {
  assert.match(ladderSource, /if \(!activeClub\.value\) return \[\]/)
  assert.match(ladderSource, /adminStore\.activeLadders/)
  assert.match(ladderSource, /adminStore\.hasActiveClubPermission\('club\.manage'\)/)
  assert.match(ladderSource, /adminStore\.hasActiveClubPermission\('challenges\.create'\)/)
  assert.match(ladderSource, /getEligibleLadderOpponents\(/)
  assert.match(ladderSource, /useChallengeStore\(\)/)
  assert.match(ladderSource, /player\.rank/)
})

test('Challenge lifecycle stays intact while admin finalization follows the active club', () => {
  assert.match(challengeDetailsSource, /adminStore\.hasActiveClubPermission\('club\.manage'\)/)
  assert.doesNotMatch(challengeDetailsSource, /authStore\.isAdmin|authStore\.user\?\.roleKey/)
  assert.match(challengeStoreSource, /resolveChallengeResultRequest/)
  assert.match(
    challengeServiceSource,
    /ApiService\.post\(`\/challenges\/\$\{challengeId\}\/resolve-result`/,
  )
})

test('Tournament keeps participants competition-specific and scopes tagged lists to active club', () => {
  assert.match(tournamentListSource, /tournament\.clubId === adminStore\.activeClubId/)
  assert.match(
    tournamentStoreSource,
    /adminStore\.hasActiveClubPermission\('tournaments\.manage'\)/,
  )
  assert.match(tournamentStoreSource, /payload\.clubId !== adminStore\.activeClubId/)
  assert.match(tournamentCategorySource, /entry\.group\.name[\s\S]*entry\.player\.seed/)
  assert.match(tournamentCategorySource, /group\.players\.find/)
})

test('account identity has not absorbed Ladder rank or Tournament seed', () => {
  assert.doesNotMatch(authSource, /ladderPosition|tournamentSeed|\brank\b/)
  assert.match(authSource, /id: APP_CURRENT_PLAYER\.id/)
  assert.match(playerSource, /APP_CURRENT_PLAYER\.id/)
})
