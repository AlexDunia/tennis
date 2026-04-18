<script setup>
// 1. IMPORTS
import { computed, onMounted, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'

// 2. PROPS
// none

// 3. EMITS
// none

// 4. ROUTER / ROUTE
const route = useRoute()

// 5. STORES
const matchStore = useMatchStore()
const playerStore = usePlayerStore()

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
      <div class="match-summary section-card">
        <p class="match-summary__status">{{ match.statusLabel }}</p>
        <h2>{{ challenger?.name || 'Challenger' }} vs {{ defender?.name || 'Defender' }}</h2>
        <p class="match-copy">Scheduled for: {{ match.scheduledAt || 'TBD' }}</p>
        <p class="match-copy">Score: {{ match.score || 'No score submitted' }}</p>
      </div>

      <div class="result-panel section-card">
        <h3>Score submission</h3>
        <p class="panel-copy">Submit the mock match result to advance ladder rankings.</p>

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
  gap: 1.5rem;
  grid-template-columns: 1.1fr 0.9fr;
}

.match-summary,
.result-panel {
  padding: 1.5rem;
}

.match-summary__status {
  margin: 0 0 0.4rem;
  color: var(--color-secondary);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.match-summary h2 {
  margin: 0;
}

.match-copy,
.panel-copy {
  margin: 0.75rem 0 0;
  color: var(--color-muted);
}

.field {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
}

.field__label {
  font-size: 0.9rem;
  color: var(--color-text);
}

.field__input {
  width: 100%;
  border-radius: 0.95rem;
  border: 1px solid var(--color-border);
  background: rgba(255, 252, 240, 0.86);
  padding: 0.85rem 1rem;
}

.submit-button {
  margin-top: 1.25rem;
  border: none;
  border-radius: 0.95rem;
  padding: 0.85rem 1rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-strong));
  color: #fffbea;
  font-weight: 700;
}

.empty-state {
  padding: 1.5rem;
  color: var(--color-muted);
}

@media (max-width: 900px) {
  .match-grid {
    grid-template-columns: 1fr;
  }
}
</style>
