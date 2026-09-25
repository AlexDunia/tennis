<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LadderMatchManageDialog from '../components/play/LadderMatchManageDialog.vue'
import LivePresenceStrip from '../components/match/LivePresenceStrip.vue'
import TournamentMatchModal from '../components/tournament/TournamentMatchModal.vue'
import EmptyState from '../components/EmptyState.vue'
import { useTournamentLiveRefresh } from '../composables/useTournamentLiveRefresh'
import { PLAY_MATCH_ACTIONS, getPlayMatchActions } from '../domain/playMatchActions.js'
import { ladderRulesToMatchRulesSnapshot } from '../domain/ruleAdapters/ladderMatchRules.js'
import { startOrResumeLadderMatch } from '../services/LadderLiveMatchService.js'
import { startOrResumeMatch } from '../services/LiveMatchService.js'
import { useAdminStore } from '../stores/admin'
import { useMatchStore } from '../stores/match'
import { useNotificationStore } from '../stores/notification'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'
import { formatAppDateTime } from '../utils/dateFormat'
import { formatMatchRulesSummary } from '../utils/matchRulesSummary'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const matchStore = useMatchStore()
const notificationStore = useNotificationStore()
const playerStore = usePlayerStore()
const tournamentStore = useTournamentStore()

const hasLoaded = ref(false)
const selectedTournamentMatch = ref(null)
const managedMatch = ref(null)
const manageMode = ref('')
const matchId = computed(() => String(route.params.matchId || ''))
const match = computed(() => matchStore.matchById(matchId.value))
const tournament = computed(() => tournamentStore.activeTournament)
const tournamentId = computed(() => route.params.tournamentId || match.value?.tournamentId || '')
const currentPlayerId = computed(() => playerStore.currentPlayer?.id || '')
const canManageClub = computed(() => adminStore.hasActiveClubPermission('club.manage'))
const canControlLive = computed(() => adminStore.hasActiveClubPermission('matches.live_score'))
const courts = computed(() => adminStore.activeClub?.setup?.workspace?.courts || [])
const challenger = computed(() => playerStore.players.find((player) => player.id === match.value?.challengerId) || null)
const defender = computed(() => playerStore.players.find((player) => player.id === match.value?.defenderId) || null)
const playerOneName = computed(() => match.value?.player1Name || match.value?.challengerName || challenger.value?.name || 'Player 1')
const playerTwoName = computed(() => match.value?.player2Name || match.value?.defenderName || defender.value?.name || 'Player 2')
const statusLabel = computed(() => match.value?.statusLabel || String(match.value?.status || 'Unknown').replace(/_/g, ' '))
const courtLabel = computed(() => {
  const court = match.value?.court
  return typeof court === 'object' ? court?.name || court?.label || court?.id || 'Not set' : court || match.value?.courtId || 'Not set'
})
const ladderRules = computed(() => ladderRulesToMatchRulesSnapshot({
  rulesSnapshot: match.value?.rulesSnapshot,
  ladderConfigSnapshot: match.value?.ladderConfigSnapshot,
  matchConfig: match.value?.matchConfig,
}))
const formatSummary = computed(() => formatMatchRulesSummary(ladderRules.value.ok ? ladderRules.value.snapshot : null))
const scoreLabel = computed(() => match.value?.score ? `Final score ${match.value.score}` : match.value?.status === 'live' ? 'Live match' : 'No score yet')
const ladderActions = computed(() => {
  if (match.value?.type !== 'ladder') return []
  return getPlayMatchActions(match.value, {
    actorId: currentPlayerId.value,
    canManage: canManageClub.value,
    canLiveControl: canControlLive.value,
  }).filter((action) => action.id !== PLAY_MATCH_ACTIONS.VIEW_MATCH)
})
const tournamentCategory = computed(() => tournament.value?.categories.find((category) => category.id === match.value?.categoryId) || null)
const canManageTournament = computed(() => adminStore.hasActiveClubPermission('tournaments.score.update'))
const canOpenLiveBoard = computed(() => match.value?.type === 'tournament' && canManageTournament.value && ['pending', 'scheduled'].includes(match.value.status))
const canEditTournamentResult = computed(() => match.value?.type === 'tournament' && canManageTournament.value && ['pending', 'scheduled', 'completed', 'walkover'].includes(match.value.status) && match.value.player1Id && match.value.player2Id)
const tournamentBackLink = computed(() => match.value?.categoryId ? `/tournaments/${match.value.tournamentId}/category/${match.value.categoryId}` : `/tournaments/${match.value?.tournamentId}`)

function notify(message) { notificationStore.addToast({ message, type: 'warning' }) }
function ladderActionStillAllowed(actionId) {
  return getPlayMatchActions(match.value, {
    actorId: currentPlayerId.value,
    canManage: canManageClub.value,
    canLiveControl: canControlLive.value,
  }).some((action) => action.id === actionId)
}
async function handleLadderAction(action) {
  const actionId = typeof action === 'string' ? action : action?.id
  if (!match.value || !actionId || !ladderActionStillAllowed(actionId)) {
    notify('That action is no longer available for this match.')
    return
  }
  switch (actionId) {
    case PLAY_MATCH_ACTIONS.START_MATCH: {
      const result = await startOrResumeLadderMatch({ match: match.value, actorId: currentPlayerId.value, clubId: adminStore.activeClubId || '', explicitStart: true })
      if (!result.ok) { notify(result.message || 'This Ladder Match cannot be started yet.'); return }
      router.push({ name: 'LiveMatch', params: { matchId: result.match.id } })
      return
    }
    case PLAY_MATCH_ACTIONS.RESUME_SCORING:
      router.push({ name: 'LiveMatch', params: { matchId: match.value.id } })
      return
    case PLAY_MATCH_ACTIONS.VIEW_LIVE_SCORE:
      router.push({ name: 'LiveScoreboard', params: { matchId: match.value.id } })
      return
    case PLAY_MATCH_ACTIONS.OPEN_MATCH_CONTROL:
      router.push({ name: 'LiveOperationDetail', params: { matchId: match.value.id } })
      return
    case PLAY_MATCH_ACTIONS.RESCHEDULE:
    case PLAY_MATCH_ACTIONS.CANCEL:
      managedMatch.value = match.value
      manageMode.value = actionId === PLAY_MATCH_ACTIONS.CANCEL ? 'cancel' : 'reschedule'
  }
}
function closeManageDialog() { managedMatch.value = null; manageMode.value = '' }
function handleManagedResult() { closeManageDialog(); loadMatchDetails() }
function openTournamentScoreModal() { if (canEditTournamentResult.value) selectedTournamentMatch.value = match.value }
async function saveTournamentScore(payload) { if (selectedTournamentMatch.value) await tournamentStore.enterMatchResult(selectedTournamentMatch.value.id, payload); selectedTournamentMatch.value = null }
async function saveTournamentSchedule(payload) { if (selectedTournamentMatch.value) await tournamentStore.updateMatchSchedule(selectedTournamentMatch.value.id, payload) }
async function openTournamentLive() {
  if (!canOpenLiveBoard.value) return
  const result = await startOrResumeMatch({ match: match.value, actorId: currentPlayerId.value, clubId: adminStore.activeClubId || '', authorized: canManageTournament.value, explicitStart: true, tournament: tournament.value, category: tournamentCategory.value })
  if (!result.ok) { notify(result.message || 'This Tournament Match cannot be opened for scoring.'); return }
  router.push({ name: 'LiveMatch', params: { matchId: result.match.id } })
}
async function loadMatchDetails() {
  try {
    await Promise.all([playerStore.loadPlayers(), matchStore.loadMatches()])
    if (match.value?.type === 'tournament') await tournamentStore.fetchTournament(match.value.tournamentId)
  } finally { hasLoaded.value = true }
}
useTournamentLiveRefresh(tournamentId)
onMounted(() => { loadMatchDetails() })
</script>

<template>
  <section class="match-details">
    <div v-if="!hasLoaded || matchStore.isLoading" class="section-card match-details__loading"><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line"></span></div>
    <EmptyState v-else-if="!match" illustration="matches" title="Match not found" description="This match is no longer available." primary-action-label="View challenges" @primary-action="router.push('/challenges')" />
    <template v-else>
      <header class="match-details__header section-card">
        <RouterLink v-if="match.type === 'tournament'" class="match-back-link" :to="tournamentBackLink">Back to {{ tournamentCategory?.name || 'Tournament' }}</RouterLink>
        <p class="match-details__status">{{ statusLabel }}</p>
        <h1>{{ playerOneName }} <span>vs</span> {{ playerTwoName }}</h1>
        <LivePresenceStrip v-if="match.type === 'ladder' && match.status === 'live'" :match-id="match.id" compact />
      </header>
      <section class="match-details__facts section-card" aria-label="Match facts">
        <div><span>Status</span><strong>{{ statusLabel }}</strong></div>
        <div><span>Schedule</span><strong>{{ match.scheduledAt ? formatAppDateTime(match.scheduledAt) : 'Not scheduled' }}</strong></div>
        <div><span>Court</span><strong>{{ courtLabel }}</strong></div>
        <div><span>Match format</span><strong>{{ match.type === 'ladder' ? formatSummary.match : 'Match format unavailable' }}</strong></div>
        <div><span>Score</span><strong>{{ scoreLabel }}</strong></div>
      </section>
      <section v-if="match.type === 'ladder'" class="match-details__actions section-card">
        <h2>Ladder match</h2>
        <p>{{ match.status === 'pending_review' ? 'The result is awaiting the existing Ladder review flow.' : 'Actions follow the current match policy.' }}</p>
        <div v-if="ladderActions.length" class="match-details__buttons">
          <button v-for="action in ladderActions" :key="action.id" type="button" :class="['submit-button', { 'submit-button--quiet': action.tone !== 'primary', 'submit-button--danger': action.tone === 'danger' }]" @click="handleLadderAction(action)">{{ action.label }}</button>
        </div>
      </section>
      <section v-else class="match-details__actions section-card">
        <h2>Tournament controls</h2>
        <template v-if="canManageTournament">
          <p>{{ match.score ? 'Use the category fixture tools to keep this result accurate.' : 'The final result will appear after the match score has been submitted.' }}</p>
          <div class="match-details__buttons">
            <button v-if="canEditTournamentResult" class="submit-button" type="button" @click="openTournamentScoreModal">{{ ['completed', 'walkover'].includes(match.status) ? 'Edit result' : 'Enter score' }}</button>
            <button v-if="canOpenLiveBoard" class="submit-button submit-button--quiet" type="button" @click="openTournamentLive">Open live board</button>
          </div>
        </template>
        <p v-else>The official tournament result is shown here after an administrator submits it.</p>
      </section>
    </template>
    <TournamentMatchModal v-if="selectedTournamentMatch" :match="selectedTournamentMatch" @close="selectedTournamentMatch = null" @save="saveTournamentScore" @schedule="saveTournamentSchedule" />
    <LadderMatchManageDialog :open="Boolean(managedMatch)" :match="managedMatch" :mode="manageMode" :courts="courts" @close="closeManageDialog" @saved="handleManagedResult" @cancelled="handleManagedResult" />
  </section>
</template>

<style scoped>
.match-details { display: grid; gap: 1rem; }
.match-details__loading { display: grid; gap: 10px; padding: 1.25rem; }
.match-details__header, .match-details__actions, .match-details__facts { padding: 1.25rem; border: 1px solid var(--color-border); border-radius: .75rem; background: var(--color-surface); }
.match-details__header h1 { margin: 0; }.match-details__header h1 span { color: var(--color-muted); font-weight: 400; }
.match-details__status { margin: 0 0 .4rem; color: var(--color-accent-support); font-size: .78rem; font-weight: 700; text-transform: uppercase; }
.match-details__facts { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .75rem; }.match-details__facts span,.match-details__facts strong{display:block}.match-details__facts span{color:var(--color-muted);font-size:.72rem}.match-details__facts strong{margin-top:.25rem;font-size:.86rem}
.match-details__actions h2,.match-details__actions p { margin: 0; }.match-details__actions p { margin-top: .5rem; color: var(--color-muted); }.match-details__buttons { display:flex; flex-wrap:wrap; gap:.6rem; margin-top:1rem; }
.match-back-link{display:inline-block;margin-bottom:.8rem;color:var(--color-primary-strong);font-size:.82rem;text-decoration:none}.submit-button{min-height:38px;padding:0 14px;border:0;border-radius:.5rem;background:var(--color-accent-bright);color:#fff;font:inherit;font-weight:700}.submit-button--quiet{border:1px solid var(--color-border);background:transparent;color:var(--color-text)}.submit-button--danger{border-color:#dfb0aa;color:#9b463d;background:#fffafa}
@media (max-width: 800px) { .match-details__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } } @media (max-width: 460px) { .match-details__facts { grid-template-columns: 1fr; }.submit-button{width:100%} }
</style>