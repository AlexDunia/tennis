<script setup>
// 1. IMPORTS
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChallengeStore } from '../stores/challenge'
import { usePlayerStore } from '../stores/player'
import { useNotificationStore } from '../stores/notification'
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
const notificationStore = useNotificationStore()

// 6. REACTIVE STATE
const opponentId = ref(route.query.opponent || '')
const scorerId = ref('')
const note = ref('Looking forward to a competitive ladder match.')

// 7. COMPUTED PROPERTIES
const currentPlayer = computed(() => playerStore.currentPlayer)
const opponentOptions = computed(() => playerStore.availableOpponents)
const scorerOptions = computed(() =>
  playerStore.players.filter((player) => player.id !== opponentId.value),
)

// 8. METHODS
const handleSubmit = async () => {
  if (!opponentId.value || !currentPlayer.value) {
    return
  }

  const result = await challengeStore.createChallenge({
    challengerId: currentPlayer.value.id,
    defenderId: opponentId.value,
    scorerId: scorerId.value || null,
    note: note.value,
  })

  if (result) {
    notificationStore.addToast({
      message: 'Challenge request sent. Awaiting response from your opponent.',
      type: 'success',
    })
    notificationStore.addNotification({
      title: 'Challenge created',
      message: `Your challenge request against ${opponentOptions.value.find((p) => p.id === opponentId.value)?.name || 'the opponent'} has been sent.`,
      type: 'info',
    })
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

        <label class="field">
          <span class="field__label">Scorer (Optional)</span>
          <select v-model="scorerId" class="field__input">
            <option value="">No scorer assigned</option>
            <option v-for="player in scorerOptions" :key="player.id" :value="player.id">
              #{{ player.rank }} {{ player.name }}
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
  gap: 2rem;
  grid-template-columns: 1fr 1.2fr;
}

.challenge-info,
.challenge-form {
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.challenge-info:hover,
.challenge-form:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.subtitle {
  margin: 0;
  color: var(--color-accent-support);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.78rem;
}

.challenge-info h2 {
  margin: 0.35rem 0 0;
  font-size: 1.25rem;
}

.challenge-copy {
  margin: 0.45rem 0 0;
  color: var(--color-muted);
  font-size: 0.92rem;
}

.field {
  display: grid;
  gap: 0.55rem;
}

.field__label {
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 600;
}

.field__input {
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-light);
  padding: 0 14px;
  min-height: 38px;
  font-size: 0.9rem;
}

.challenge-form {
  display: grid;
  gap: 1rem;
}

@media (max-width: 900px) {
  .challenge-panel {
    grid-template-columns: 1fr;
  }
}
</style>
