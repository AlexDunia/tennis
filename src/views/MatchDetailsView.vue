<script setup>
// 1. IMPORTS
import { computed, onMounted, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'

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
const matchId = route.params.matchId
const form = reactive({ winnerId: '', score: '' })
const hasSubmitted = reactive({ value: false })

// 7. COMPUTED PROPERTIES
const match = computed(() => matchStore.matchById(matchId))
const challenger = computed(
  () => playerStore.players.find((player) => player.id === match.value?.challengerId) || null,
)
const defender = computed(
  () => playerStore.players.find((player) => player.id === match.value?.defenderId) || null,
)
const canSubmitScore = computed(() => match.value?.status === 'scheduled')
const tournament = computed(() => tournamentStore.activeTournament)
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

  await matchStore.submitResult(matchId, { winnerId: form.winnerId, score: form.score })
  hasSubmitted.value = true
}

const loadMatchDetails = async () => {
  await Promise.all([playerStore.loadPlayers(), matchStore.loadMatches()])
  if (match.value?.type === 'tournament') {
    await tournamentStore.fetchTournament(match.value.tournamentId)
  }
  initializeForm()
}

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
        <p class="match-summary__status">{{ tournament?.name || 'Tournament match' }}</p>
        <h2>{{ tournamentCategory?.name || match.categoryId }}</h2>
        <p class="match-copy">{{ tournamentRoundLabel }}</p>
      </div>

      <div class="match-summary section-card">
        <p class="match-summary__status">{{ match.statusLabel }}</p>
        <h2>{{ challenger?.name || 'Challenger' }} vs {{ defender?.name || 'Defender' }}</h2>
        <p class="match-copy">
          {{ match.scheduledAt ? `Scheduled ${match.scheduledAt}` : 'Schedule pending' }}
        </p>
        <p class="match-copy">{{ match.score ? `Score ${match.score}` : 'No score submitted' }}</p>
      </div>

      <div class="result-panel section-card">
        <h3>Submit result</h3>

        <label class="field">
          <span class="field__label">Winner</span>
          <select v-model="form.winnerId" class="field__input">
            <option :value="challenger?.id">{{ challenger?.name }}</option>
            <option :value="defender?.id">{{ defender?.name }}</option>
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
    </div>
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
  margin-top: 1.1rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  padding: 0 14px;
  min-height: 38px;
  background: var(--color-accent-bright);
  color: var(--color-light);
  font-weight: 700;
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
