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
  <section class="create-challenge">
    <div class="challenge-panel">
      <div class="challenge-info section-card">
        <p class="subtitle">Current Player</p>
        <h2>{{ currentPlayer?.name || 'Loading...' }}</h2>
        <p class="challenge-copy">Rank #{{ currentPlayer?.rank || '-' }}</p>
        <p class="challenge-copy">Record {{ currentPlayer?.wins }}-{{ currentPlayer?.losses }}</p>
      </div>

      <div class="challenge-form section-card">
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
.create-challenge {
  display: grid;
}

.challenge-panel {
  display: grid;
  gap: 1rem;
  grid-template-columns: 0.95fr 1.25fr;
}

.challenge-info,
.challenge-form {
  padding: 1.2rem;
}

.subtitle {
  margin: 0;
  color: var(--color-primary-strong);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.76rem;
}

.challenge-info h2 {
  margin: 0.35rem 0 0;
  font-size: 1.2rem;
}

.challenge-copy {
  margin: 0.45rem 0 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.field {
  display: grid;
  gap: 0.45rem;
}

.field__label {
  color: var(--color-text);
  font-size: 0.88rem;
  font-weight: 600;
}

.field__input {
  width: 100%;
  border-radius: 0.9rem;
  border: 1px solid var(--color-border);
  background: #ffffff;
  padding: 0.88rem 0.95rem;
}

.challenge-form {
  display: grid;
  gap: 0.95rem;
}

@media (max-width: 900px) {
  .challenge-panel {
    grid-template-columns: 1fr;
  }
}
</style>
