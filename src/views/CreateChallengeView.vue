<script setup>
// 1. IMPORTS
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChallengeStore } from '../stores/challenge'
import { usePlayerStore } from '../stores/player'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'

// 2. PROPS
// none

// 3. EMITS
// none

// 4. ROUTER / ROUTE
const route = useRoute()
const router = useRouter()

// 5. STORES
const playerStore = usePlayerStore()
const challengeStore = useChallengeStore()

// 6. REACTIVE STATE
const opponentId = ref(route.query.opponent || '')
const note = ref('Looking forward to a competitive ladder match.')

// 7. COMPUTED PROPERTIES
const currentPlayer = computed(() => playerStore.currentPlayer)
const opponentOptions = computed(() => playerStore.availableOpponents)

// 8. METHODS
const handleSubmit = async () => {
  if (!opponentId.value || !currentPlayer.value) {
    return
  }

  const result = await challengeStore.createChallenge({
    challengerId: currentPlayer.value.id,
    defenderId: opponentId.value,
    note: note.value,
  })

  if (result) {
    router.push({ name: 'Challenges' })
  }
}

const loadCreateView = async () => {
  await playerStore.loadPlayers()

  if (!opponentId.value && opponentOptions.value.length > 0) {
    opponentId.value = opponentOptions.value[0].id
  }
}

// 9. WATCHERS
// none

// 10. LIFECYCLE HOOKS
onMounted(() => {
  loadCreateView()
})
</script>

<template>
  <section>
    <header class="section-header">
      <div>
        <p class="eyebrow">Create Challenge</p>
        <h1>Issue a ladder challenge</h1>
      </div>
      <p class="section-copy">
        Select a higher-ranked player and submit a challenge to move up the ladder.
      </p>
    </header>

    <div class="challenge-panel">
      <div class="challenge-info">
        <p class="subtitle">Current player</p>
        <h2>{{ currentPlayer?.name || 'Loading...' }}</h2>
        <p>Rank #{{ currentPlayer?.rank || '-' }}</p>
        <p>Record: {{ currentPlayer?.wins }}-{{ currentPlayer?.losses }}</p>
      </div>

      <div class="challenge-form">
        <label class="field">
          <span class="field__label">Opponent</span>
          <select v-model="opponentId" class="field__input">
            <option v-for="player in opponentOptions" :key="player.id" :value="player.id">
              #{{ player.rank }} {{ player.name }} - {{ player.wins }}-{{ player.losses }}
            </option>
          </select>
        </label>

        <BaseInput
          v-model:modelValue="note"
          label="Message"
          placeholder="Add a note for the defender"
        />

        <BaseButton type="button" variant="primary" :disabled="!opponentId" @click="handleSubmit">
          Create challenge
        </BaseButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.eyebrow {
  margin: 0;
  color: var(--color-secondary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.8rem;
}

.section-copy {
  margin: 0.75rem 0 0;
  color: var(--color-muted);
}

.challenge-panel {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr 1fr;
}

.challenge-info,
.challenge-form {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 1.25rem;
  padding: 1.5rem;
  box-shadow: var(--shadow-soft);
}

.subtitle {
  margin: 0;
  color: var(--color-primary);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.8rem;
}

.field {
  display: grid;
  gap: 0.5rem;
  margin-top: 1rem;
}

.field__label {
  color: var(--color-text);
  font-size: 0.92rem;
  font-weight: 700;
}

.field__input {
  width: 100%;
  border-radius: 1rem;
  border: 1px solid var(--color-border);
  background: rgba(255, 252, 240, 0.85);
  padding: 0.85rem 1rem;
}

@media (max-width: 900px) {
  .challenge-panel {
    grid-template-columns: 1fr;
  }
}
</style>
