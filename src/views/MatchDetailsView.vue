<script setup>
// 1. IMPORTS
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'
import { useTournamentLiveRefresh } from '../composables/useTournamentLiveRefresh'
import { formatAppDateTime } from '../utils/dateFormat'
import TournamentMatchModal from '../components/tournament/TournamentMatchModal.vue'
import EmptyState from '../components/EmptyState.vue'
import { useNotificationStore } from '../stores/notification'
import { startOrResumeLadderMatch } from '../services/LadderLiveMatchService.js'
import { startOrResumeMatch } from '../services/LiveMatchService.js'

// 2. PROPS
// none

// 3. EMITS
// none

// 4. ROUTER / ROUTE
const route = useRoute()
const router = useRouter()

// 5. STORES
const adminStore = useAdminStore()
const matchStore = useMatchStore()
const playerStore = usePlayerStore()
const tournamentStore = useTournamentStore()
const notificationStore = useNotificationStore()

// 6. REACTIVE STATE
const matchId = computed(() => route.params.matchId)
const selectedTournamentMatch = ref(null)
const hasLoaded = ref(false)

// 7. COMPUTED PROPERTIES
const match = computed(() => matchStore.matchById(matchId.value))
const challenger = computed(
  () => playerStore.players.find((player) => player.id === match.value?.challengerId) || null,
)
const defender = computed(
  () => playerStore.players.find((player) => player.id === match.value?.defenderId) || null,
)
const canOpenLadderLive = computed(() => {
  if (match.value?.type !== 'ladder') return false
  if (!['accepted', 'scheduled', 'ready', 'live'].includes(match.value.status)) return false
  const actorId = playerStore.currentPlayer?.id
  return (
    [match.value.challengerId, match.value.defenderId, match.value.scorerId].includes(actorId) ||
    adminStore.hasActiveClubPermission('matches.live_score')
  )
})
const ladderLiveActionLabel = computed(() =>
  match.value?.status === 'live' ? 'Resume scoring' : 'Start scoring',
)
const tournament = computed(() => tournamentStore.activeTournament)
const tournamentId = computed(() => route.params.tournamentId || match.value?.tournamentId || '')
const canManageTournament = computed(() =>
  adminStore.hasActiveClubPermission('tournaments.score.update'),
)
const canOpenLiveBoard = computed(
  () =>
    match.value?.type === 'tournament' &&
    canManageTournament.value &&
    ['pending', 'scheduled'].includes(match.value.status),
)
const canEditTournamentResult = computed(
  () =>
    match.value?.type === 'tournament' &&
    canManageTournament.value &&
    ['pending', 'scheduled', 'completed', 'walkover'].includes(match.value.status) &&
    match.value.player1Id &&
    match.value.player2Id,
)
const tournamentScoreActionLabel = computed(() =>
  ['completed', 'walkover'].includes(match.value?.status) ? 'Edit result' : 'Enter score',
)
const tournamentCategory = computed(
  () =>
    tournament.value?.categories.find((category) => category.id === match.value?.categoryId) ||
    null,
)
const tournamentRoundLabel = computed(() => {
  if (match.value?.type !== 'tournament') {
    return ''
  }

  return match.value.groupId
    ? `Group ${match.value.groupId}`
    : match.value.matchCode || match.value.round
})
const playerOneName = computed(() =>
  match.value?.type === 'tournament'
    ? match.value?.player1Name || match.value?.challengerName || 'Player 1'
    : challenger.value?.name || 'Challenger',
)
const playerTwoName = computed(() =>
  match.value?.type === 'tournament'
    ? match.value?.player2Name || match.value?.defenderName || 'Player 2'
    : defender.value?.name || 'Defender',
)
const tournamentBackLink = computed(() => {
  if (match.value?.type !== 'tournament') {
    return '/challenges'
  }

  return match.value?.categoryId
    ? `/tournaments/${match.value.tournamentId}/category/${match.value.categoryId}`
    : `/tournaments/${match.value.tournamentId}`
})

// 8. METHODS
const openTournamentScoreModal = () => {
  if (!canEditTournamentResult.value) {
    return
  }

  selectedTournamentMatch.value = match.value
}

const saveTournamentScore = async (payload) => {
  if (!selectedTournamentMatch.value) {
    return
  }

  await tournamentStore.enterMatchResult(selectedTournamentMatch.value.id, payload)
  selectedTournamentMatch.value = null
}

const saveTournamentSchedule = async (payload) => {
  if (!selectedTournamentMatch.value) {
    return
  }

  await tournamentStore.updateMatchSchedule(selectedTournamentMatch.value.id, payload)
}

const openLadderLive = async () => {
  if (!canOpenLadderLive.value) return
  const result = await startOrResumeLadderMatch({
    match: match.value,
    actorId: playerStore.currentPlayer?.id,
    clubId: adminStore.activeClubId || '',
    explicitStart: true,
  })
  if (!result.ok) {
    notificationStore.addToast({
      message: result.message || 'This Ladder Match cannot be opened for scoring.',
      type: 'warning',
    })
    return
  }
  router.push({ name: 'LiveMatch', params: { matchId: result.match.id } })
}

const openTournamentLive = async () => {
  if (!canOpenLiveBoard.value) return
  const result = await startOrResumeMatch({
    match: match.value,
    actorId: playerStore.currentPlayer?.id,
    clubId: adminStore.activeClubId || '',
    authorized: canManageTournament.value,
    explicitStart: true,
    tournament: tournament.value,
    category: tournamentCategory.value,
  })
  if (!result.ok) {
    notificationStore.addToast({
      message: result.message || 'This Tournament Match cannot be opened for scoring.',
      type: 'warning',
    })
    return
  }
  router.push({ name: 'LiveMatch', params: { matchId: result.match.id } })
}

const loadMatchDetails = async () => {
  try {
    await Promise.all([playerStore.loadPlayers(), matchStore.loadMatches()])
    if (match.value?.type === 'tournament') {
      await tournamentStore.fetchTournament(match.value.tournamentId)
    }
  } finally {
    hasLoaded.value = true
  }
}

useTournamentLiveRefresh(tournamentId)

// 9. WATCHERS
// none

// 10. LIFECYCLE HOOKS
onMounted(() => {
  loadMatchDetails()
})
</script>

<template>
  <section class="match-details">
    <div v-if="!hasLoaded || matchStore.isLoading" class="section-card match-details__loading">
      <span class="skeleton skeleton-line"></span>
      <span class="skeleton skeleton-line"></span>
      <span class="skeleton skeleton-line"></span>
    </div>
    <EmptyState
      v-else-if="!match"
      illustration="matches"
      title="Match not found"
      description="This match is no longer available. Return to challenges and choose an active match."
      primary-action-label="View challenges"
      @primary-action="$router.push('/challenges')"
    />

    <div v-else class="match-grid">
      <div v-if="match.type === 'tournament'" class="tournament-context section-card">
        <RouterLink class="match-back-link" :to="tournamentBackLink">
          Back to {{ tournamentCategory?.name || 'Tournament' }}
        </RouterLink>
        <p class="match-summary__status">{{ tournament?.name || 'Tournament match' }}</p>
        <h2>{{ tournamentCategory?.name || match.categoryId }} Match</h2>
        <p class="match-copy">
          {{ tournamentRoundLabel }} - {{ playerOneName }} vs {{ playerTwoName }}
        </p>
      </div>

      <div class="match-summary section-card">
        <p class="match-summary__status">{{ match.statusLabel }}</p>
        <h2>{{ playerOneName }} vs {{ playerTwoName }}</h2>
        <p class="match-copy">
          {{
            match.scheduledAt
              ? `Scheduled ${formatAppDateTime(match.scheduledAt)}`
              : 'Schedule pending'
          }}
        </p>
        <p class="match-copy">{{ match.score ? `Score ${match.score}` : 'No score submitted' }}</p>
      </div>

      <div v-if="match.type !== 'tournament'" class="result-panel section-card">
        <EmptyState
          compact
          variant="data-dependent"
          illustration="scoreboard"
          :title="match.status === 'pending_review' ? 'Result awaiting review' : 'Live scoring'"
          :description="
            match.status === 'pending_review'
              ? 'The physical result has been submitted and now follows the existing Ladder review flow.'
              : 'Start or resume this physical Match in the shared live scorer.'
          "
          :primary-action-label="canOpenLadderLive ? ladderLiveActionLabel : ''"
          @primary-action="openLadderLive"
        />
      </div>

      <div v-else-if="canManageTournament" class="result-panel section-card">
        <EmptyState
          v-if="!match.score"
          compact
          variant="data-dependent"
          illustration="scoreboard"
          title="Score not recorded"
          description="The final result will appear after the match score has been submitted."
          :primary-action-label="canEditTournamentResult ? 'Enter score' : ''"
          :secondary-action-label="canOpenLiveBoard ? 'Open live board' : ''"
          @primary-action="openTournamentScoreModal"
          @secondary-action="openTournamentLive"
        />
        <template v-else>
          <h3>Tournament controls</h3>
          <p class="panel-copy">
            Use the category fixture tools to keep this completed result accurate.
          </p>
          <button
            v-if="canEditTournamentResult"
            class="submit-button"
            type="button"
            @click="openTournamentScoreModal"
          >
            {{ tournamentScoreActionLabel }}
          </button>
        </template>
      </div>

      <div v-else class="result-panel section-card">
        <EmptyState
          v-if="!match.score"
          compact
          variant="data-dependent"
          illustration="scoreboard"
          title="Score not recorded"
          description="The final result will appear after a tournament administrator submits the score."
        />
        <template v-else>
          <h3>Score updates</h3>
          <p class="panel-copy">The official tournament result is shown in the match summary.</p>
        </template>
      </div>
    </div>

    <TournamentMatchModal
      v-if="selectedTournamentMatch"
      :match="selectedTournamentMatch"
      @close="selectedTournamentMatch = null"
      @save="saveTournamentScore"
      @schedule="saveTournamentSchedule"
    />
  </section>
</template>

<style scoped>
.match-details {
  display: grid;
}

.match-details__loading {
  display: grid;
  gap: 10px;
  padding: 1.25rem;
}

.match-grid {
  display: grid;
  gap: 2rem;
  grid-template-columns: 1.1fr 0.9fr;
}

.tournament-context,
.match-summary,
.result-panel {
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.tournament-context {
  grid-column: 1 / -1;
}

.match-back-link {
  display: inline-flex;
  width: fit-content;
  margin-bottom: 0.9rem;
  border-radius: 999px;
  padding: 0.45rem 0.7rem;
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-primary-strong);
  font-size: 0.78rem;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.tournament-context:hover,
.match-summary:hover,
.result-panel:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.match-summary__status {
  margin: 0 0 0.35rem;
  color: var(--color-accent-support);
  font-size: 0.78rem;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.match-summary h2,
.result-panel h3 {
  margin: 0;
}

.match-copy,
.panel-copy {
  margin: 0.6rem 0 0;
  color: var(--color-muted);
  font-size: 0.92rem;
}

.field {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.95rem;
}

.field__label {
  font-size: 0.88rem;
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.field__input {
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-light);
  padding: 0 14px;
  min-height: 44px;
  font-size: 0.9rem;
}

.submit-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 1.1rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  padding: 0 14px;
  min-height: 38px;
  background: var(--color-accent-bright);
  color: var(--color-light);
  font-weight: var(--font-weight-bold);
  text-decoration: none;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.submission-error {
  margin: 0.8rem 0 0;
  color: #9a554f;
  font-size: 0.78rem;
}
.result-preview {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 34, 24, 0.48);
  backdrop-filter: blur(4px);
}
.result-preview__dialog {
  width: min(480px, 100%);
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-strong);
}
.result-preview__dialog h2,
.result-preview__dialog p {
  margin: 0;
}
.result-preview__match {
  margin-top: 8px !important;
  color: var(--color-muted);
  font-size: 0.85rem;
}
.result-preview__dialog dl {
  display: grid;
  gap: 9px;
  margin: 20px 0;
}
.result-preview__dialog dl > div {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 11px 12px;
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
}
.result-preview__dialog dt {
  color: var(--color-muted);
  font-size: 0.75rem;
}
.result-preview__dialog dd {
  margin: 0;
  color: var(--color-text);
  font-size: 0.82rem;
  font-weight: var(--font-weight-bold);
  text-align: right;
}
.result-preview__note {
  color: var(--color-muted);
  font-size: 0.76rem;
  line-height: 1.55;
}
.result-preview__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.empty-state {
  padding: 1.25rem;
  color: var(--color-muted);
  border-radius: 0.75rem;
  background: var(--color-surface-muted);
}

@media (max-width: 900px) {
  .match-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .submit-button {
    width: 100%;
  }
}
</style>
