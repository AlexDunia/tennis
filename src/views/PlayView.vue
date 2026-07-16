<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TennisScoreboard from '../components/TennisScoreboard.vue'
import EmptyState from '../components/EmptyState.vue'
import { useMatchStore } from '../stores/match'
import { useNotificationStore } from '../stores/notification'
import { usePlayerStore } from '../stores/player'
import { formatAppDateTime } from '../utils/dateFormat'
import { createScoreboard, recordPoint } from '../utils/tennisScoring'

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const notificationStore = useNotificationStore()
const playerStore = usePlayerStore()

const scoreboardState = ref(createScoreboard('Court A', 'Court B'))
const now = ref(Date.now())
const scoreboardTheme = ref('dark')
const hasLoaded = ref(false)
const loadError = ref('')
let clockInterval = null
let dataRefreshInterval = null
let isPersistingScoreboard = false

const matchId = computed(() => route.params.matchId)
const currentMatch = computed(() => matchStore.matchById(matchId.value))
const isFullscreen = computed(() => route.query.fullscreen === '1')
const challenger = computed(
  () => playerStore.players.find((player) => player.id === currentMatch.value?.challengerId) || null,
)
const defender = computed(
  () => playerStore.players.find((player) => player.id === currentMatch.value?.defenderId) || null,
)
const scoreboard = computed(() => scoreboardState.value)
const playerOneName = computed(() =>
  currentMatch.value?.type === 'tournament'
    ? currentMatch.value?.player1Name || 'Player 1'
    : challenger.value?.name || currentMatch.value?.challengerName || 'Player 1',
)
const playerTwoName = computed(() =>
  currentMatch.value?.type === 'tournament'
    ? currentMatch.value?.player2Name || 'Player 2'
    : defender.value?.name || currentMatch.value?.defenderName || 'Player 2',
)
const matchLabel = computed(() => {
  if (!currentMatch.value) {
    return 'Live scoreboard'
  }

  if (currentMatch.value.type === 'tournament') {
    const round = currentMatch.value.groupId
      ? `Group ${currentMatch.value.groupId}`
      : currentMatch.value.matchCode || currentMatch.value.round || 'Tournament match'
    return `${round} - ${playerOneName.value} vs ${playerTwoName.value}`
  }

  return `${playerOneName.value} vs ${playerTwoName.value}`
})
const serverKey = computed(() => scoreboard.value.currentServer || 'playerA')
const elapsedSeconds = computed(() => {
  const startedAt = scoreboard.value.startedAt ? new Date(scoreboard.value.startedAt).getTime() : null
  const completedAt = scoreboard.value.completedAt ? new Date(scoreboard.value.completedAt).getTime() : null

  if (!startedAt) {
    return 0
  }

  return Math.max(0, Math.floor(((completedAt || now.value) - startedAt) / 1000))
})
const pointClockSeconds = computed(() => {
  const pointClockStartedAt = scoreboard.value.pointClockStartedAt
    ? new Date(scoreboard.value.pointClockStartedAt).getTime()
    : null

  if (!pointClockStartedAt || scoreboard.value.matchWinner) {
    return 0
  }

  return Math.max(0, Math.floor((now.value - pointClockStartedAt) / 1000))
})
const scoreboardStatus = computed(() => {
  if (!currentMatch.value) {
    return 'Match not found'
  }

  if (scoreboard.value.matchWinner) {
    return 'Match complete'
  }

  return ['pending', 'scheduled'].includes(currentMatch.value.status)
    ? 'Live scoreboard ready'
    : 'Score review'
})
const canSubmitFinal = computed(() => Boolean(currentMatch.value && scoreboard.value.matchWinner))

function formatDateTime(value) {
  return formatAppDateTime(value, { fallback: 'Schedule pending' })
}

function ensureScoreboardMetadata(scoreboard) {
  return {
    ...scoreboard,
    players: {
      playerA: scoreboard.players?.playerA || playerOneName.value,
      playerB: scoreboard.players?.playerB || playerTwoName.value,
    },
    startedAt: scoreboard.startedAt || new Date().toISOString(),
    pointClockStartedAt: scoreboard.pointClockStartedAt || new Date().toISOString(),
    currentServer: scoreboard.currentServer || 'playerA',
  }
}

function syncScoreboard() {
  if (!currentMatch.value) {
    scoreboardState.value = createScoreboard('Court A', 'Court B')
    return
  }

  if (currentMatch.value.liveState?.sets && currentMatch.value.liveState?.currentGame) {
    scoreboardState.value = ensureScoreboardMetadata(currentMatch.value.liveState)
    return
  }

  scoreboardState.value = ensureScoreboardMetadata(
    createScoreboard(playerOneName.value, playerTwoName.value),
  )
}

function calculateSetWins(playerKey) {
  return scoreboard.value.completedSets.filter((set) => set.winner === playerKey).length
}

function getMatchPlayerId(playerKey) {
  if (!currentMatch.value) {
    return ''
  }

  return playerKey === 'playerA'
    ? currentMatch.value.player1Id || currentMatch.value.challengerId
    : currentMatch.value.player2Id || currentMatch.value.defenderId
}

function formatFinalScore() {
  return scoreboard.value.completedSets
    .map((set) => `${set.games.playerA}-${set.games.playerB}`)
    .join(', ')
}

function formatCompletedSetsPayload() {
  return scoreboard.value.completedSets.map((set, index) => ({
    setNumber: index + 1,
    winner: set.winner,
    games: { ...set.games },
    tieBreak: set.tieBreak
      ? {
          winner: set.tieBreak.winner,
          score: { ...set.tieBreak.score },
        }
      : null,
  }))
}

async function persistScoreboard() {
  isPersistingScoreboard = true
  try {
    await matchStore.saveLiveState(matchId.value, scoreboardState.value)
  } finally {
    isPersistingScoreboard = false
  }
}

async function handlePoint(playerKey) {
  const nextScoreboard = recordPoint(scoreboardState.value, playerKey)
  scoreboardState.value = {
    ...nextScoreboard,
    pointClockStartedAt: new Date().toISOString(),
    completedAt: nextScoreboard.matchWinner ? new Date().toISOString() : nextScoreboard.completedAt,
  }
  await persistScoreboard()
}

function openMatchDetails() {
  if (!currentMatch.value) {
    return
  }

  if (currentMatch.value.type === 'tournament') {
    router.push(`/tournaments/${currentMatch.value.tournamentId}/match/${currentMatch.value.id}`)
    return
  }

  router.push({ name: 'MatchDetails', params: { matchId: currentMatch.value.id } })
}

function updateRouteQuery(nextQuery) {
  router.replace({
    path: route.path,
    query: {
      ...route.query,
      ...nextQuery,
    },
  })
}

async function enterFullscreen() {
  updateRouteQuery({ fullscreen: '1' })

  if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      // Browser fullscreen is optional; the app layout still enters presentation mode.
    }
  }
}

async function exitFullscreen() {
  const nextQuery = { ...route.query }
  delete nextQuery.fullscreen
  router.replace({ path: route.path, query: nextQuery })

  if (document.exitFullscreen && document.fullscreenElement) {
    try {
      await document.exitFullscreen()
    } catch {
      // Ignore browser fullscreen failures; the route controls the app presentation.
    }
  }
}

function toggleTheme() {
  scoreboardTheme.value = scoreboardTheme.value === 'dark' ? 'light' : 'dark'
}

async function toggleServer() {
  scoreboardState.value = {
    ...scoreboardState.value,
    currentServer: serverKey.value === 'playerA' ? 'playerB' : 'playerA',
  }
  await persistScoreboard()
}

async function submitFinalScore() {
  if (!canSubmitFinal.value) {
    return
  }

  const winnerKey = scoreboard.value.matchWinner
  const winnerId = getMatchPlayerId(winnerKey)

  if (currentMatch.value.type === 'tournament') {
    const result = await matchStore.submitResult(matchId.value, {
      p1Sets: calculateSetWins('playerA'),
      p2Sets: calculateSetWins('playerB'),
      p1Games: scoreboard.value.completedSets.reduce((total, set) => total + set.games.playerA, 0),
      p2Games: scoreboard.value.completedSets.reduce((total, set) => total + set.games.playerB, 0),
      sets: formatCompletedSetsPayload(),
      winnerId,
      status: 'completed',
    })

    if (result) {
      notificationStore.addToast({ message: 'Live score saved.', type: 'success', sound: true })
      notificationStore.addTournamentScoreNotification(result, playerStore.currentPlayerId)
    }
    return
  }

  await matchStore.submitResult(matchId.value, {
    winnerId,
    score: formatFinalScore() || `${calculateSetWins('playerA')}-${calculateSetWins('playerB')}`,
  })
}

async function refreshMatchData() {
  if (isPersistingScoreboard || document.hidden) {
    return
  }

  await matchStore.loadMatches()
}

async function loadPlayView() {
  try {
    loadError.value = ''
    await Promise.all([playerStore.loadPlayers(), matchStore.loadMatches()])
    const hadLiveState = Boolean(currentMatch.value?.liveState?.sets && currentMatch.value?.liveState?.currentGame)
    syncScoreboard()
    if (currentMatch.value && !hadLiveState) {
      await persistScoreboard()
    }
  } catch (error) {
    loadError.value = error?.message || 'Unable to load this match.'
    console.error('Play view load failed:', error)
  } finally {
    hasLoaded.value = true
  }
}

watch([currentMatch, challenger, defender], () => {
  syncScoreboard()
})

onMounted(() => {
  loadPlayView()
  clockInterval = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
  dataRefreshInterval = window.setInterval(refreshMatchData, 2000)
})

onUnmounted(() => {
  if (clockInterval) {
    window.clearInterval(clockInterval)
  }
  if (dataRefreshInterval) {
    window.clearInterval(dataRefreshInterval)
  }
})
</script>

<template>
  <section
    class="play"
    :class="{
      'play--fullscreen': isFullscreen,
      'play--dark': isFullscreen && scoreboardTheme === 'dark',
      'play--light': isFullscreen && scoreboardTheme === 'light',
    }"
  >
    <div class="play__meta-card section-card">
      <div class="play__meta-copy">
        <p class="play__eyebrow">{{ scoreboardStatus }}</p>
        <h2>{{ currentMatch ? matchLabel : 'Live scoreboard' }}</h2>
        <p class="play__subtitle">{{ formatDateTime(currentMatch?.scheduledAt) }}</p>
      </div>

      <div v-if="currentMatch" class="play__actions">
        <button class="play__details" type="button" @click="openMatchDetails">
          Match details
        </button>
        <button
          v-if="!isFullscreen"
          class="play__details play__details--primary"
          type="button"
          @click="enterFullscreen"
        >
          Full screen
        </button>
        <button
          v-else
          class="play__details"
          type="button"
          @click="exitFullscreen"
        >
          Exit full screen
        </button>
      </div>
    </div>

    <div v-if="isFullscreen" class="play__fullscreen-toolbar">
      <button class="play__details" type="button" @click="toggleTheme">
        {{ scoreboardTheme === 'dark' ? 'Light mode' : 'Dark mode' }}
      </button>
      <button class="play__details" type="button" @click="toggleServer">
        Switch server
      </button>
    </div>

    <div class="play__wrapper">
      <TennisScoreboard
        v-if="currentMatch"
        :elapsed-seconds="elapsedSeconds"
        :point-clock-seconds="pointClockSeconds"
        :projector="isFullscreen"
        :scoreboard="scoreboard"
        :server-key="serverKey"
        :theme="scoreboardTheme"
        @point="handlePoint"
      />
      <div v-else-if="!hasLoaded || matchStore.isLoading" class="play__fallback section-card">
        <span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line"></span>
      </div>
      <div v-else-if="loadError" class="play__fallback section-card" role="alert">
        <strong>Unable to load match data</strong>
        <span>{{ loadError }}</span>
        <button class="play__details" type="button" @click="loadPlayView">Retry</button>
      </div>
      <EmptyState
        v-else
        variant="data-dependent"
        illustration="scoreboard"
        title="No matches ready for live scoring"
        description="Scheduled and accepted matches will appear here when they are ready to play."
        primary-action-label="View challenges"
        @primary-action="router.push('/challenges')"
      />
    </div>

    <div v-if="currentMatch && !isFullscreen" class="play__controls section-card">
      <button class="play__details" type="button" @click="toggleServer">
        Switch server
      </button>
      <button
        class="play__details play__details--primary"
        type="button"
        :disabled="!canSubmitFinal"
        @click="submitFinalScore"
      >
        Submit final score
      </button>
    </div>
  </section>
</template>

<style scoped>
.play {
  display: grid;
  gap: 2rem;
}

.play--fullscreen {
  min-height: 100vh;
  gap: 1rem;
  padding: 16px;
  background: #07110d;
}

.play--fullscreen.play--light {
  background: #f8faf8;
}

.play__meta-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  min-width: 0;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  background: var(--color-surface);
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.play--fullscreen .play__meta-card {
  position: sticky;
  top: 0;
  z-index: 5;
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(7, 17, 13, 0.88);
  color: #ffffff;
  backdrop-filter: blur(12px);
}

.play--fullscreen.play--light .play__meta-card {
  border-color: rgba(15, 23, 32, 0.1);
  background: rgba(255, 255, 255, 0.88);
  color: var(--color-text);
}

.play--fullscreen .play__meta-copy h2 {
  color: #ffffff;
}

.play--fullscreen.play--light .play__meta-copy h2 {
  color: var(--color-text);
}

.play--fullscreen .play__subtitle {
  color: rgba(255, 255, 255, 0.68);
}

.play--fullscreen.play--light .play__subtitle {
  color: var(--color-muted);
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
  letter-spacing: 0.08em;
  text-transform: uppercase;
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
  align-self: start;
  min-height: 38px;
  border: 1px solid rgba(0, 181, 26, 0.14);
  border-radius: 0.5rem;
  padding: 0 14px;
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-accent-bright);
  font-weight: 700;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.play__actions,
.play__fullscreen-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.6rem;
}

.play__fullscreen-toolbar {
  justify-content: center;
}

.play--fullscreen .play__fullscreen-toolbar .play__details {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.play--fullscreen.play--light .play__fullscreen-toolbar .play__details {
  border-color: rgba(0, 181, 26, 0.14);
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-primary-strong);
}

.play__details:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.play__details:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.play__details--primary {
  background: var(--color-accent-bright);
  color: var(--color-light);
}

.play__wrapper {
  display: flex;
  justify-content: center;
  min-width: 0;
}

.play--fullscreen .play__wrapper {
  align-items: center;
  min-height: calc(100vh - 180px);
}

.play__controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
}

.play__fallback {
  display: grid;
  gap: 10px;
  border-radius: 0.75rem;
  padding: 1.25rem;
  background: var(--color-surface-muted);
  color: var(--color-muted);
  font-weight: 600;
}

@media (max-width: 900px) {
  .play__meta-card {
    grid-template-columns: 1fr;
  }

  .play__actions {
    justify-content: flex-start;
  }
}
</style>
