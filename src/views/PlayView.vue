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
  () => playerStore.players.find((player) => player.id === currentMatch.value?.challengerId) || null,
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
    <header class="play__hero section-card">
      <div>
        <p class="play__eyebrow">Play Screen</p>
        <h1 class="play__title">
          {{ currentMatch ? `${currentMatch.challengerName} vs ${currentMatch.defenderName}` : 'Live scoreboard' }}
        </h1>
        <p class="play__subtitle">
          Route-based match flow with full-screen focus for scoring and review.
        </p>
      </div>

      <div class="play__meta">
        <span class="play__chip">{{ scoreboardStatus }}</span>
        <span class="play__chip">{{ formatDateTime(currentMatch?.scheduledAt) }}</span>
        <button class="play__details" type="button" @click="openMatchDetails">
          Open Match Details
        </button>
      </div>
    </header>

    <div class="play__wrapper">
      <TennisScoreboard v-if="currentMatch" :scoreboard="scoreboard" @point="handlePoint" />
      <div v-else class="play__fallback section-card">Match data is loading...</div>
    </div>
  </section>
</template>

<style scoped>
.play {
  display: grid;
  gap: 1.5rem;
}

.play__hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  padding: 1.5rem;
  background:
    linear-gradient(135deg, rgba(255, 247, 211, 0.94), rgba(240, 232, 172, 0.84)),
    linear-gradient(120deg, rgba(217, 31, 47, 0.08), rgba(15, 107, 63, 0.14));
}

.play__eyebrow {
  margin: 0 0 0.4rem;
  color: var(--color-secondary);
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.play__title,
.play__subtitle {
  margin: 0;
}

.play__subtitle {
  margin-top: 0.75rem;
  color: var(--color-muted);
}

.play__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  align-items: start;
  gap: 0.75rem;
}

.play__chip {
  padding: 0.55rem 0.8rem;
  border-radius: 999px;
  background: rgba(255, 252, 240, 0.88);
  border: 1px solid rgba(19, 35, 22, 0.08);
  font-weight: 700;
}

.play__details {
  border: none;
  border-radius: 999px;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-strong));
  color: #fffce8;
  font-weight: 800;
}

.play__wrapper {
  display: flex;
  justify-content: center;
}

.play__fallback {
  padding: 1rem 1.2rem;
  font-weight: 700;
}

@media (max-width: 900px) {
  .play__hero {
    grid-template-columns: 1fr;
  }

  .play__meta {
    justify-content: start;
  }
}
</style>
