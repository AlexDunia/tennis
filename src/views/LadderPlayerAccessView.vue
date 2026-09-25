<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { resolveLadderConfigFromSetup } from '../config/ladder.js'
import { ladderRosterFromSetup } from '../domain/competitionScope.js'
import {
  getLadderSelfServiceActionLabel,
  getLadderSelfServiceAssignments,
  getLadderSelfServiceDestination,
} from '../domain/ladderPlayerSelfService.js'
import { effectiveLadderRoster } from '../services/LadderAdminService.js'
import {
  getEligibleLadderOpponents,
  verifyLadderCreationAccess,
} from '../services/LadderAccessService.js'
import { resolveLadderPlayerAccess } from '../services/LadderPlayerAccessService.js'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()
const playerStore = usePlayerStore()
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()

const pageState = ref('loading')
const pageMessage = ref('')
const accessRecord = ref(null)
const targetClub = ref(null)
const targetLadder = ref(null)
const creationAccess = ref({ allowed: false, message: '' })
const refreshing = ref(false)
const navigatingSingleAssignment = ref(false)

const token = computed(() => String(route.params.token || '').trim())
const ladderScope = computed(() => ({
  clubId: accessRecord.value?.clubId || '',
  ladderId: accessRecord.value?.ladderId || '',
}))
const setup = computed(() => adminStore.activeClub?.setup || adminStore.setup || {})
const rawRoster = computed(() => ladderRosterFromSetup({
  setup: setup.value,
  ladderId: ladderScope.value.ladderId,
}).roster)
const roster = computed(() => effectiveLadderRoster(ladderScope.value, rawRoster.value))
const config = computed(() => resolveLadderConfigFromSetup(setup.value, ladderScope.value.ladderId))

function sameIdentity(member, profile) {
  const memberIds = [member?.id, member?.userId, member?.playerId]
    .filter(Boolean)
    .map((value) => String(value))
  const profileIds = [
    profile?.id,
    profile?.userId,
    profile?.playerId,
    playerStore.currentPlayerId,
    authStore.user?.id,
    authStore.user?.userId,
    authStore.user?.playerId,
  ]
    .filter(Boolean)
    .map((value) => String(value))
  const email = String(profile?.email || authStore.user?.email || '').trim().toLowerCase()
  return memberIds.some((id) => profileIds.includes(id)) || Boolean(
    email && String(member?.email || '').trim().toLowerCase() === email,
  )
}

const currentPlayer = computed(() => roster.value.find((member) => sameIdentity(member, playerStore.currentPlayer)) || null)
const assignments = computed(() => getLadderSelfServiceAssignments({
  challenges: challengeStore.challenges,
  matches: matchStore.matches,
  clubId: ladderScope.value.clubId,
  ladderId: ladderScope.value.ladderId,
  playerId: currentPlayer.value?.id || '',
}))
const eligibleOpponents = computed(() => currentPlayer.value ? getEligibleLadderOpponents({
  challenger: currentPlayer.value,
  players: roster.value,
  challenges: challengeStore.challenges,
  config: config.value,
  clubId: ladderScope.value.clubId,
  ladderId: ladderScope.value.ladderId,
}) : [])
const positionSummary = computed(() => currentPlayer.value
  ? `#${currentPlayer.value.rank} of ${roster.value.length}`
  : '')
const recordSummary = computed(() => {
  const player = currentPlayer.value
  if (!player) return ''
  const matches = Number(player.matchesPlayed ?? player.matches ?? 0)
  return `${Number(player.wins || 0)} wins · ${Number(player.losses || 0)} losses · ${matches} matches`
})

function unavailable(message) {
  pageMessage.value = message
  pageState.value = 'unavailable'
}

function assignmentDestination(assignment) {
  return getLadderSelfServiceDestination({
    challenge: assignment.challenge,
    match: assignment.match,
    actorId: currentPlayer.value?.id,
  })
}

function assignmentActionLabel(assignment) {
  return getLadderSelfServiceActionLabel({
    challenge: assignment.challenge,
    match: assignment.match,
    actorId: currentPlayer.value?.id,
  })
}

function opponentFor(assignment) {
  const challenge = assignment.challenge || {}
  const opponentId = String(challenge.challengerId) === String(currentPlayer.value?.id)
    ? challenge.defenderId
    : challenge.challengerId
  return roster.value.find((player) => String(player.id) === String(opponentId))?.name || 'Opponent'
}

function statusLabel(status) {
  return ({ awaiting: 'Challenge pending', accepted: 'Challenge accepted', scheduled: 'Match scheduled', ready: 'Ready to play', live: 'Playing now', pending_review: 'Result pending' })[status] || 'Ladder match'
}

function scheduleLabel(assignment) {
  const value = assignment.match?.scheduledAt || assignment.challenge?.scheduledAt
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

async function checkCreationAccess() {
  if (!currentPlayer.value) return
  creationAccess.value = await verifyLadderCreationAccess({
    player: currentPlayer.value,
    challenges: challengeStore.challenges,
    config: config.value,
    clubId: ladderScope.value.clubId,
    ladderId: ladderScope.value.ladderId,
  })
}

async function continueSingleAssignment() {
  if (assignments.value.length !== 1 || navigatingSingleAssignment.value) return
  const destination = assignmentDestination(assignments.value[0])
  if (!destination) return
  navigatingSingleAssignment.value = true
  await router.replace(destination)
}

async function loadPage() {
  pageState.value = 'loading'
  pageMessage.value = ''
  navigatingSingleAssignment.value = false
  const access = resolveLadderPlayerAccess(token.value)
  if (!access) {
    unavailable('This player access code is no longer available.')
    return
  }
  accessRecord.value = access
  try {
    await adminStore.loadClubs()
  } catch {
    unavailable('This player access code is no longer available.')
    return
  }
  targetClub.value = adminStore.clubs.find((club) => String(club.id) === access.clubId) || null
  const membership = adminStore.membershipForClub(access.clubId)
  if (membership?.status !== 'active') {
    pageMessage.value = `This code belongs to ${targetClub.value?.name || access.clubId || 'this Club'}. You need an active Club membership to use this Ladder.`
    pageState.value = 'membership'
    return
  }
  if (!targetClub.value) {
    unavailable('This player access code is no longer available.')
    return
  }
  try {
    if (adminStore.activeClubId !== access.clubId) await adminStore.switchClub(access.clubId)
  } catch {
    unavailable('This player access code is no longer available.')
    return
  }
  targetClub.value = adminStore.activeClub
  targetLadder.value = (Array.isArray(setup.value.ladders) ? setup.value.ladders : [])
    .find((ladder) => String(ladder.id) === access.ladderId) || null
  if (!targetLadder.value || targetLadder.value.enabled === false || targetLadder.value.archived) {
    unavailable('This Ladder is no longer available.')
    return
  }
  await refreshPageData(false)
  if (!currentPlayer.value) {
    pageState.value = 'not-player'
    return
  }
  pageState.value = 'ready'
  await continueSingleAssignment()
}

async function refreshPageData(redirectSingle = true) {
  refreshing.value = true
  try {
    await Promise.all([
      playerStore.loadPlayers(),
      challengeStore.loadChallenges(),
      matchStore.loadMatches(),
    ])
    await checkCreationAccess()
    if (redirectSingle && pageState.value === 'ready') await continueSingleAssignment()
  } finally {
    refreshing.value = false
  }
}

function openAssignment(assignment) {
  const destination = assignmentDestination(assignment)
  if (destination) router.push(destination)
}

function openChallenge(opponent) {
  router.push({
    name: 'CreateChallenge',
    query: { ladder: ladderScope.value.ladderId, opponent: opponent.id },
  })
}

function openClub() {
  router.push({ name: 'ClubVisit', params: { clubId: accessRecord.value?.clubId || '' } })
}

watch(token, () => { loadPage() })
onMounted(loadPage)
</script>

<template>
  <main class="ladder-player-access">
    <section v-if="pageState === 'loading'" class="access-card access-card--loading" aria-label="Loading player access">
      <span v-for="index in 4" :key="index" class="access-skeleton"></span>
    </section>

    <section v-else-if="pageState === 'unavailable'" class="access-card access-card--state">
      <h1>Player access unavailable</h1>
      <p>{{ pageMessage }}</p>
      <button type="button" class="button-primary" @click="router.push({ name: 'Dashboard' })">Open GORRA</button>
    </section>

    <section v-else-if="pageState === 'membership'" class="access-card access-card--state">
      <h1>Club membership needed</h1>
      <p>{{ pageMessage }}</p>
      <div class="access-actions">
        <button type="button" class="button-primary" @click="openClub">Club</button>
        <button type="button" @click="router.push({ name: 'Clubs', query: { view: 'clubs' } })">View clubs</button>
      </div>
    </section>

    <section v-else-if="pageState === 'not-player'" class="access-card access-card--state">
      <h1>You’re not on {{ targetLadder?.name || 'this Ladder' }} yet.</h1>
      <p>Ask a Club manager to add you to the Ladder before you challenge another player.</p>
      <button type="button" class="button-primary" @click="router.push({ name: 'Rankings' })">Open Ladder</button>
    </section>

    <template v-else>
      <header class="access-heading">
        <p>{{ targetClub?.name || 'Club' }}</p>
        <h1>{{ targetLadder?.name || 'Ladder' }}</h1>
        <span>Player access</span>
      </header>

      <section v-if="assignments.length > 1" class="access-card">
        <header class="access-card__heading">
          <div><h2>Your active matches</h2><p>Open the one you need. This link does not start matches or grant scoring authority.</p></div>
          <button type="button" :disabled="refreshing" @click="refreshPageData()">{{ refreshing ? 'Refreshing…' : 'Refresh' }}</button>
        </header>
        <ul class="assignment-list">
          <li v-for="assignment in assignments" :key="assignment.challenge.id">
            <div><strong>{{ opponentFor(assignment) }}</strong><span>{{ statusLabel(assignment.status) }}</span><small v-if="scheduleLabel(assignment)">{{ scheduleLabel(assignment) }}</small></div>
            <button v-if="assignmentDestination(assignment)" type="button" class="button-primary" @click="openAssignment(assignment)">{{ assignmentActionLabel(assignment) }}</button>
          </li>
        </ul>
      </section>

      <template v-else-if="assignments.length === 0">
        <section class="access-card access-summary">
          <div><span>Your position</span><strong>{{ positionSummary }}</strong></div>
          <p>{{ recordSummary }}</p>
          <p class="access-rule">You can challenge up to {{ config.challengeRangeUp }} place{{ config.challengeRangeUp === 1 ? '' : 's' }} above you, subject to the Ladder’s current rules.</p>
        </section>

        <section class="access-card">
          <header class="access-card__heading">
            <div><h2>Eligible opponents</h2><p v-if="!creationAccess.allowed">{{ creationAccess.message || 'You cannot create a Ladder challenge right now.' }}</p></div>
            <button type="button" :disabled="refreshing" @click="refreshPageData(false)">{{ refreshing ? 'Refreshing…' : 'Refresh' }}</button>
          </header>
          <ul v-if="eligibleOpponents.length && creationAccess.allowed" class="opponent-list">
            <li v-for="opponent in eligibleOpponents" :key="opponent.id">
              <div><strong>#{{ opponent.rank }} · {{ opponent.name }}</strong><span>{{ opponent.wins || 0 }} wins · {{ opponent.losses || 0 }} losses</span></div>
              <button type="button" class="button-primary" @click="openChallenge(opponent)">Challenge</button>
            </li>
          </ul>
          <p v-else class="access-empty">{{ creationAccess.allowed ? 'No opponents are available within your current challenge window.' : 'Refresh after your active Ladder work is complete.' }}</p>
        </section>
      </template>
    </template>
  </main>
</template>

<style scoped>
.ladder-player-access { width: min(100% - 32px, 820px); display: grid; gap: 16px; margin: 32px auto 56px; }
.access-heading { display: grid; gap: 5px; }
.access-heading p, .access-heading h1, .access-heading span { margin: 0; }
.access-heading p, .access-heading span { color: var(--color-muted); font-size: 12px; }
.access-heading span { color: var(--color-primary-strong); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: .06em; }
.access-card { display: grid; gap: 16px; padding: 22px; border: 1px solid var(--color-border); border-radius: var(--app-card-radius); background: var(--color-surface); box-shadow: var(--flow-shadow-quiet); }
.access-card--state { min-height: 230px; align-content: center; justify-items: start; }
.access-card--state h1, .access-card--state p, .access-summary p { margin: 0; }
.access-card--state p { color: var(--color-muted); line-height: 1.55; }
.access-card__heading { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
.access-card__heading h2, .access-card__heading p { margin: 0; }
.access-card__heading p { max-width: 540px; margin-top: 6px; color: var(--color-muted); font-size: 12px; line-height: 1.5; }
.access-card__heading > button { min-height: 38px; white-space: nowrap; }
.access-actions { display: flex; flex-wrap: wrap; gap: 9px; }
.assignment-list, .opponent-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.assignment-list li, .opponent-list li { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px; border: 1px solid var(--color-border); border-radius: var(--app-inner-radius); background: var(--color-surface-soft); }
.assignment-list li > div, .opponent-list li > div { display: grid; gap: 4px; }
.assignment-list span, .assignment-list small, .opponent-list span, .access-empty, .access-rule { color: var(--color-muted); font-size: 12px; }
.access-summary { grid-template-columns: auto 1fr; align-items: center; }
.access-summary > div { display: grid; gap: 5px; padding-right: 20px; border-right: 1px solid var(--color-border); }
.access-summary > div span { color: var(--color-muted); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
.access-summary > div strong { font-size: 22px; }
.access-summary .access-rule { grid-column: 1 / -1; line-height: 1.5; }
.access-empty { margin: 0; line-height: 1.5; }
.access-card--loading { min-height: 220px; align-content: center; }
.access-skeleton { display: block; height: 15px; border-radius: 8px; background: var(--color-surface-soft); }
.access-skeleton:nth-child(2) { width: 88%; }.access-skeleton:nth-child(3) { width: 72%; }.access-skeleton:nth-child(4) { width: 44%; }
@media (max-width: 600px) { .ladder-player-access { width: min(100% - 24px, 820px); margin-top: 20px; } .access-card { padding: 17px; } .access-card__heading, .assignment-list li, .opponent-list li { align-items: stretch; flex-direction: column; } .access-card__heading > button, .assignment-list button, .opponent-list button { width: 100%; } .access-summary { grid-template-columns: 1fr; } .access-summary > div { padding: 0 0 14px; border-right: 0; border-bottom: 1px solid var(--color-border); } }
</style>