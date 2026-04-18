<script setup>
// 1. IMPORTS
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import TennisScoreboard from '../components/TennisScoreboard.vue'
import { createScoreboard, recordPoint } from '../utils/tennisScoring'

// 2. PROPS
// none

// 3. EMITS
// none

// 4. ROUTER / ROUTE
const route = useRoute()
const router = useRouter()

// 5. STORES
const matchStore = useMatchStore()
const playerStore = usePlayerStore()

// 6. REACTIVE STATE
const scoreboardState = ref(createScoreboard('Court A', 'Court B'))

// 7. COMPUTED PROPERTIES
const matchId = computed(() => route.params.matchId)
const currentMatch = computed(() => matchStore.matchById(matchId.value))
const challenger = computed(
  () =>
    playerStore.players.find((player) => player.id === currentMatch.value?.challengerId) || null,
)
const defender = computed(
  () => playerStore.players.find((player) => player.id === currentMatch.value?.defenderId) || null,
)
const scoreboard = computed(() => scoreboardState.value)
const scoreboardStatus = computed(() => {
  if (!currentMatch.value) {
    return 'Match not found'
  }

  if (scoreboard.value.matchWinner) {
    return 'Match point settled'
  }

  return currentMatch.value.status === 'scheduled' ? 'Live scoreboard ready' : 'Review in progress'
})

// 8. METHODS
const formatDateTime = (value) => {
  if (!value) {
    return 'Schedule pending'
  }

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const syncScoreboard = () => {
  if (!currentMatch.value) {
    scoreboardState.value = createScoreboard('Court A', 'Court B')
    return
  }

  scoreboardState.value = createScoreboard(
    challenger.value?.name || currentMatch.value.challengerName,
    defender.value?.name || currentMatch.value.defenderName,
  )
}

const handlePoint = (playerKey) => {
  scoreboardState.value = recordPoint(scoreboardState.value, playerKey)
}

const openMatchDetails = () => {
  if (!currentMatch.value) {
    return
  }

  router.push({ name: 'MatchDetails', params: { matchId: currentMatch.value.id } })
}

const loadPlayView = async () => {
  try {
    await Promise.all([playerStore.loadPlayers(), matchStore.loadMatches()])
    syncScoreboard()
  } catch (error) {
    console.error('Play view load failed:', error)
  }
}

// 9. WATCHERS
watch([currentMatch, challenger, defender], () => {
  syncScoreboard()
})

// 10. LIFECYCLE HOOKS
onMounted(() => {
  loadPlayView()
})
</script>

<template>
  <section class="play">
    <div class="play__meta-card section-card">
      <div class="play__meta-copy">
        <p class="play__eyebrow">{{ scoreboardStatus }}</p>
        <h2>
          {{
            currentMatch
              ? `${currentMatch.challengerName} vs ${currentMatch.defenderName}`
              : 'Live scoreboard'
          }}
        </h2>
        <p class="play__subtitle">{{ formatDateTime(currentMatch?.scheduledAt) }}</p>
      </div>

      <button class="play__details" type="button" @click="openMatchDetails">
        Open match details
      </button>
    </div>

    <div class="play__wrapper">
      <TennisScoreboard v-if="currentMatch" :scoreboard="scoreboard" @point="handlePoint" />
      <div v-else class="play__fallback section-card">Match data is loading...</div>
    </div>
  </section>
</template>

<style scoped>
.play {
  display: grid;
  gap: 2rem;
}

.play__meta-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.play__meta-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.play__eyebrow {
  margin: 0 0 0.25rem;
  color: var(--color-accent-support);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.play__meta-copy h2,
.play__subtitle {
  margin: 0;
}

.play__meta-copy h2 {
  font-size: 1.3rem;
}

.play__subtitle {
  margin-top: 0.45rem;
  color: var(--color-muted);
  font-size: 0.95rem;
}

.play__details {
  border: 1px solid rgba(0, 181, 26, 0.14);
  border-radius: 0.5rem;
  padding: 0 14px;
  min-height: 38px;
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-accent-bright);
  font-weight: 700;
  align-self: start;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.play__details:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.play__wrapper {
  display: flex;
  justify-content: center;
}

.play__fallback {
  padding: 1.25rem;
  font-weight: 600;
  color: var(--color-muted);
  border-radius: 0.75rem;
  background: var(--color-surface-muted);
}

@media (max-width: 900px) {
  .play__meta-card {
    grid-template-columns: 1fr;
  }
}
</style>
