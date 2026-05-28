<script setup>
// 1. IMPORTS
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'
import { useTournamentLiveRefresh } from '../composables/useTournamentLiveRefresh'
import { formatAppDateTime } from '../utils/dateFormat'
import TournamentMatchModal from '../components/tournament/TournamentMatchModal.vue'

// 2. PROPS
// none

// 3. EMITS
// none

// 4. ROUTER / ROUTE
const route = useRoute()

// 5. STORES
const matchStore = useMatchStore()
const playerStore = usePlayerStore()
const tournamentStore = useTournamentStore()

// 6. REACTIVE STATE
const matchId = computed(() => route.params.matchId)
const form = reactive({ winnerId: '', score: '' })
const hasSubmitted = reactive({ value: false })
const selectedTournamentMatch = ref(null)

// 7. COMPUTED PROPERTIES
const match = computed(() => matchStore.matchById(matchId.value))
const challenger = computed(
  () => playerStore.players.find((player) => player.id === match.value?.challengerId) || null,
)
const defender = computed(
  () => playerStore.players.find((player) => player.id === match.value?.defenderId) || null,
)
const canSubmitScore = computed(() => match.value?.type !== 'tournament' && match.value?.status === 'scheduled')
const tournament = computed(() => tournamentStore.activeTournament)
const tournamentId = computed(() => route.params.tournamentId || match.value?.tournamentId || '')
const canManageTournament = computed(() => playerStore.currentPlayerCan('tournaments.score.update'))
const canOpenLiveBoard = computed(
  () => match.value?.type === 'tournament' && canManageTournament.value && ['pending', 'scheduled'].includes(match.value.status),
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
const initializeForm = () => {
  if (!match.value) {
    return
  }

  form.winnerId = match.value.challengerId
  form.score = '6-4, 6-4'
}

const handleResultSubmit = async () => {
  if (!form.winnerId || !form.score) {
    return
  }

  await matchStore.submitResult(matchId.value, { winnerId: form.winnerId, score: form.score })
  hasSubmitted.value = true
}

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

const loadMatchDetails = async () => {
  await Promise.all([playerStore.loadPlayers(), matchStore.loadMatches()])
  if (match.value?.type === 'tournament') {
    await tournamentStore.fetchTournament(match.value.tournamentId)
  }
  initializeForm()
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
    <div v-if="!match" class="empty-state section-card">Match not found.</div>

    <div v-else class="match-grid">
      <div v-if="match.type === 'tournament'" class="tournament-context section-card">
        <RouterLink class="match-back-link" :to="tournamentBackLink">
          Back to {{ tournamentCategory?.name || 'Tournament' }}
        </RouterLink>
        <p class="match-summary__status">{{ tournament?.name || 'Tournament match' }}</p>
        <h2>{{ tournamentCategory?.name || match.categoryId }} Match</h2>
        <p class="match-copy">{{ tournamentRoundLabel }} - {{ playerOneName }} vs {{ playerTwoName }}</p>
      </div>

      <div class="match-summary section-card">
        <p class="match-summary__status">{{ match.statusLabel }}</p>
        <h2>{{ playerOneName }} vs {{ playerTwoName }}</h2>
        <p class="match-copy">
          {{ match.scheduledAt ? `Scheduled ${formatAppDateTime(match.scheduledAt)}` : 'Schedule pending' }}
        </p>
        <p class="match-copy">{{ match.score ? `Score ${match.score}` : 'No score submitted' }}</p>
      </div>

      <div v-if="match.type !== 'tournament'" class="result-panel section-card">
        <h3>Submit result</h3>

        <label class="field">
          <span class="field__label">Winner</span>
          <select v-model="form.winnerId" class="field__input">
            <option :value="match.challengerId || match.player1Id">{{ playerOneName }}</option>
            <option :value="match.defenderId || match.player2Id">{{ playerTwoName }}</option>
          </select>
        </label>

        <label class="field">
          <span class="field__label">Score</span>
          <input v-model="form.score" class="field__input" placeholder="6-4, 6-4" />
        </label>

        <button
          class="submit-button"
          type="button"
          :disabled="!canSubmitScore || hasSubmitted.value"
          @click="handleResultSubmit"
        >
          {{ hasSubmitted.value ? 'Result submitted' : 'Submit result' }}
        </button>
      </div>

      <div v-else-if="canManageTournament" class="result-panel section-card">
        <h3>Tournament controls</h3>
        <p class="panel-copy">Use the live board or the category fixture tools to keep this match accurate.</p>
        <button
          v-if="canEditTournamentResult"
          class="submit-button"
          type="button"
          @click="openTournamentScoreModal"
        >
          {{ tournamentScoreActionLabel }}
        </button>
        <RouterLink
          v-if="canOpenLiveBoard"
          class="submit-button submit-button--link"
          :to="`/play/${match.id}`"
        >
          Open live board
        </RouterLink>
      </div>

      <div v-else class="result-panel section-card">
        <h3>Score updates</h3>
        <p class="panel-copy">Players can follow this match here. Tournament admins handle score updates.</p>
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
  font-weight: 800;
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
  font-weight: 700;
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
  font-weight: 600;
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
  font-weight: 700;
  text-decoration: none;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
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
