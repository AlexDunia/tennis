<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin'
import { usePlayerStore } from '../stores/player'
import { subscribeToLiveOperationsRegistry } from '../services/liveOperationsRegistry'
import { subscribeToTvDisplayStatesForClub } from '../services/tvPairingService'

const router = useRouter()

const adminStore = useAdminStore()
const playerStore = usePlayerStore()

const liveMatches = ref([])
const displayStates = ref([])
const loading = ref(true)
const loadError = ref('')
const now = ref(Date.now())

let stopOperationsSubscription = () => {}
let stopDisplaySubscription = () => {}

let clockTimer = null

const activeClubName = computed(() => adminStore.activeClub?.name || 'Your club')

const liveCount = computed(
  () => liveMatches.value.filter((match) => match.status === 'live').length,
)

const attentionCount = computed(
  () =>
    liveMatches.value.filter((match) => ['stale', 'unavailable'].includes(match.connection?.state))
      .length,
)

function connectionPriority(state) {
  return (
    {
      stale: 0,
      unavailable: 1,
      connecting: 2,
      unknown: 3,
      fresh: 4,
      complete: 5,
    }[state] ?? 6
  )
}

function courtSortValue(match) {
  return String(match.court || '')
    .trim()
    .toLowerCase()
}

const orderedMatches = computed(() =>
  [...liveMatches.value].sort((a, b) => {
    const connectionDifference =
      connectionPriority(a.connection?.state) - connectionPriority(b.connection?.state)

    if (connectionDifference !== 0) {
      return connectionDifference
    }

    const courtA = courtSortValue(a)

    const courtB = courtSortValue(b)

    if (courtA && courtB && courtA !== courtB) {
      return courtA.localeCompare(courtB, undefined, {
        numeric: true,
      })
    }

    return (
      Number(a.startedAt ? new Date(a.startedAt).getTime() : 0) -
      Number(b.startedAt ? new Date(b.startedAt).getTime() : 0)
    )
  }),
)

function stopSubscription() {
  stopOperationsSubscription()

  stopOperationsSubscription = () => {}

  stopDisplaySubscription()

  stopDisplaySubscription = () => {}
}

function startSubscription() {
  stopSubscription()

  liveMatches.value = []

  const clubId = adminStore.activeClubId

  if (!clubId) {
    loading.value = false

    return
  }

  loading.value = true

  stopOperationsSubscription = subscribeToLiveOperationsRegistry(
    (matches) => {
      liveMatches.value = Array.isArray(matches) ? matches : []

      loading.value = false
    },

    {
      clubId,
      includeTerminal: false,
    },
  )

  stopDisplaySubscription = subscribeToTvDisplayStatesForClub(
    clubId,

    (states) => {
      displayStates.value = Array.isArray(states) ? states : []
    },
  )
}

function formatElapsed(startedAt) {
  if (!startedAt) {
    return 'Just started'
  }

  const started = new Date(startedAt).getTime()

  if (!Number.isFinite(started)) {
    return 'Live'
  }

  const minutes = Math.max(0, Math.floor((now.value - started) / 60000))

  if (minutes < 1) {
    return 'Just started'
  }

  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)

  const remaining = minutes % 60

  return remaining ? `${hours}h ${remaining}m` : `${hours}h`
}

function setLabel(match) {
  const setNumber = Math.max(1, Number(match.score?.currentSetNumber || 1))

  return `Set ${setNumber}`
}

function scoreContext(match) {
  const gamesA = Number(match.score?.games?.a || 0)

  const gamesB = Number(match.score?.games?.b || 0)

  return `${gamesA}–${gamesB}`
}

function pointValue(match, side) {
  return match.score?.points?.[side] || '0'
}

function serverSide(match, side) {
  return match.server === (side === 'a' ? 'playerA' : 'playerB')
}

function connectionLabel(state) {
  return (
    {
      fresh: 'Connected',
      stale: 'Needs attention',
      unavailable: 'Connection unavailable',
      connecting: 'Connecting',
      unknown: 'Connection uncertain',
      complete: 'Complete',
    }[state] || 'Connecting'
  )
}

function displayStateFor(matchId) {
  return displayStates.value.find((state) => state.matchId === matchId) || null
}

function displayLabel(matchId) {
  const state = displayStateFor(matchId)

  if (!state) {
    return 'No display'
  }

  return state.status === 'connected' ? 'Display connected' : 'Pairing display'
}

function scoreboardHref(match) {
  if (!match?.matchId) {
    return ''
  }

  return router.resolve({
    name: 'LiveScoreboard',

    params: {
      matchId: match.matchId,
    },
  }).href
}

function detailHref(match) {
  if (!match?.matchId) {
    return ''
  }

  return router.resolve({
    name: 'LiveOperationDetail',

    params: {
      matchId: match.matchId,
    },
  }).href
}

async function preparePage() {
  loadError.value = ''

  try {
    if (!adminStore.activeClubId) {
      await adminStore.loadClubs()
    }

    if (!playerStore.players.length && !playerStore.isLoading) {
      await playerStore.loadPlayers()
    }
  } catch (error) {
    loadError.value = error?.message || 'Gorra could not load Live Operations.'
  }

  startSubscription()
}

onMounted(() => {
  preparePage()

  /*
   * One lightweight timer for duration labels.
   *
   * The registry itself owns connection-state
   * refreshes; this timer does not poll matches.
   */
  clockTimer = window.setInterval(
    () => {
      if (document.visibilityState === 'visible') {
        now.value = Date.now()
      }
    },

    30000,
  )
})

watch(
  () => adminStore.activeClubId,

  (next, previous) => {
    if (next !== previous) {
      startSubscription()
    }
  },
)

onUnmounted(() => {
  stopSubscription()

  if (clockTimer) {
    window.clearInterval(clockTimer)
  }
})
</script>

<template>
  <main class="live-operations" aria-labelledby="live-operations-title">
    <header class="live-operations__header">
      <div>
        <p class="live-operations__eyebrow">
          {{ activeClubName }}
        </p>

        <h1 id="live-operations-title">Live operations</h1>

        <p>
          See what is happening across the courts without interrupting the people scoring the
          matches.
        </p>
      </div>

      <div class="live-operations__summary" aria-label="Live match summary">
        <div>
          <strong>
            {{ liveCount }}
          </strong>

          <span>
            {{ liveCount === 1 ? 'live match' : 'live matches' }}
          </span>
        </div>

        <div v-if="attentionCount" class="live-operations__attention">
          <strong>
            {{ attentionCount }}
          </strong>

          <span> need attention </span>
        </div>
      </div>
    </header>

    <p v-if="loadError" class="live-operations__notice" role="alert">
      {{ loadError }}
    </p>

    <section v-if="loading" class="live-operations__loading" aria-live="polite">
      <span aria-hidden="true"></span>

      <p>Checking live courts…</p>
    </section>

    <section v-else-if="!orderedMatches.length" class="live-operations__empty">
      <div class="live-operations__empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="4" y="3" width="16" height="18" rx="3" />

          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      </div>

      <h2>No live matches right now</h2>

      <p>Matches appear here automatically once Match Control starts.</p>
    </section>

    <section v-else class="live-operations__matches" aria-label="Live matches">
      <article
        v-for="match in orderedMatches"
        :key="match.matchId"
        class="operation-match"
        :class="{
          'operation-match--attention': ['stale', 'unavailable'].includes(match.connection?.state),
        }"
      >
        <header class="operation-match__header">
          <div>
            <span class="operation-match__court">
              {{ match.court || 'Court not set' }}
            </span>

            <span class="operation-match__format">
              {{ match.matchType === 'ladder' ? 'Ladder' : 'Friendly' }}
            </span>
          </div>

          <span
            class="operation-match__connection"
            :class="`operation-match__connection--${match.connection?.state || 'connecting'}`"
          >
            <i aria-hidden="true"></i>

            {{ connectionLabel(match.connection?.state) }}
          </span>
        </header>

        <div class="operation-match__score">
          <div class="operation-player">
            <span
              class="operation-player__server"
              :class="{
                'operation-player__server--active': serverSide(match, 'a'),
              }"
              :aria-label="serverSide(match, 'a') ? 'Serving' : undefined"
            ></span>

            <strong>
              {{ match.players?.playerA?.name || 'Player 1' }}
            </strong>

            <span class="operation-player__point">
              {{ pointValue(match, 'a') }}
            </span>
          </div>

          <div class="operation-player">
            <span
              class="operation-player__server"
              :class="{
                'operation-player__server--active': serverSide(match, 'b'),
              }"
              :aria-label="serverSide(match, 'b') ? 'Serving' : undefined"
            ></span>

            <strong>
              {{ match.players?.playerB?.name || 'Player 2' }}
            </strong>

            <span class="operation-player__point">
              {{ pointValue(match, 'b') }}
            </span>
          </div>
        </div>

        <div class="operation-match__context">
          <span>
            {{ setLabel(match) }}
            ·
            {{ scoreContext(match) }}
          </span>

          <span>
            {{ displayLabel(match.matchId) }}
          </span>

          <span>
            {{ formatElapsed(match.startedAt) }}
          </span>
        </div>

        <div class="operation-match__authority">
          <span> Scorer </span>

          <strong>
            {{ match.scorerName || 'Assigned scorer' }}
          </strong>
        </div>

        <footer class="operation-match__actions">
          <a
            v-if="scoreboardHref(match)"
            :href="scoreboardHref(match)"
            target="_blank"
            rel="noopener noreferrer"
            class="operation-action operation-action--quiet"
          >
            Scoreboard
          </a>

          <a
            v-if="detailHref(match)"
            :href="detailHref(match)"
            class="operation-action operation-action--primary"
          >
            Review match
          </a>
        </footer>
      </article>
    </section>
  </main>
</template>

<style scoped>
.live-operations {
  width: min(1180px, 92%);
  margin: 0 auto;
  padding: 34px 0 80px;
  color: #18231b;
}

.live-operations__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  margin-bottom: 34px;
}

.live-operations__header > div:first-child {
  max-width: 620px;
}

.live-operations__eyebrow {
  margin: 0 0 8px;
  color: #277844;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.live-operations__header h1 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.6rem);
  line-height: 0.98;
  letter-spacing: -0.045em;
}

.live-operations__header p:not(.live-operations__eyebrow) {
  max-width: 560px;
  margin: 14px 0 0;
  color: #667069;
  font-size: 0.98rem;
  line-height: 1.65;
}

.live-operations__summary {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.live-operations__summary > div {
  min-width: 118px;
  padding: 14px 16px;
  border: 1px solid #dfe7e1;
  border-radius: 16px;
  background: #fff;
}

.live-operations__summary strong,
.live-operations__summary span {
  display: block;
}

.live-operations__summary strong {
  font-size: 1.5rem;
  line-height: 1;
}

.live-operations__summary span {
  margin-top: 7px;
  color: #748078;
  font-size: 0.78rem;
}

.live-operations__attention {
  background: #fffaf1 !important;
  border-color: #eadfc5 !important;
}

.live-operations__notice {
  padding: 13px 15px;
  border: 1px solid #ead6cf;
  border-radius: 12px;
  background: #fff9f7;
  color: #874835;
}

.live-operations__loading,
.live-operations__empty {
  min-height: 320px;
  display: grid;
  place-items: center;
  align-content: center;
  text-align: center;
}

.live-operations__loading span {
  width: 24px;
  height: 24px;
  border: 2px solid #d9e5dc;
  border-top-color: #287d46;
  border-radius: 999px;
  animation: operation-spin 0.75s linear infinite;
}

.live-operations__loading p {
  margin: 12px 0 0;
  color: #6f7972;
}

.live-operations__empty-icon {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  background: #eef7f0;
  color: #287d46;
}

.live-operations__empty-icon svg {
  width: 25px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
}

.live-operations__empty h2 {
  margin: 17px 0 5px;
  font-size: 1.2rem;
}

.live-operations__empty p {
  max-width: 360px;
  margin: 0;
  color: #778079;
  line-height: 1.55;
}

.live-operations__matches {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.operation-match {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #dde5df;
  border-radius: 20px;
  background: #fff;
}

.operation-match--attention {
  border-color: #e4d9bc;
  background: #fffdf8;
}

.operation-match__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 15px 17px;
  border-bottom: 1px solid #edf1ee;
}

.operation-match__header > div {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
}

.operation-match__court {
  overflow: hidden;
  font-size: 0.9rem;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.operation-match__format {
  padding: 4px 7px;
  border-radius: 999px;
  background: #f2f5f2;
  color: #6d776f;
  font-size: 0.68rem;
  font-weight: 700;
}

.operation-match__connection {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  color: #69746d;
  font-size: 0.7rem;
  font-weight: 700;
}

.operation-match__connection i {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #a3aba5;
}

.operation-match__connection--fresh i {
  background: #2d854b;
}

.operation-match__connection--stale i,
.operation-match__connection--unavailable i {
  background: #a57828;
}

.operation-match__score {
  padding: 19px 18px 12px;
}

.operation-player {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  min-height: 42px;
}

.operation-player + .operation-player {
  border-top: 1px solid #f0f3f1;
}

.operation-player strong {
  min-width: 0;
  overflow: hidden;
  font-size: 1rem;
  font-weight: 650;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.operation-player__server {
  width: 7px;
  height: 7px;
  border: 1px solid #ccd5ce;
  border-radius: 999px;
}

.operation-player__server--active {
  border-color: #287d46;
  background: #287d46;
}

.operation-player__point {
  min-width: 42px;
  text-align: right;
  color: #176837;
  font-size: 1.25rem;
  font-weight: 760;
  letter-spacing: -0.03em;
}

.operation-match__context {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 7px 14px;

  padding: 0 18px 15px;

  color: #748078;

  font-size: 0.76rem;
}

.operation-match__context span:nth-child(2) {
  color: #39734d;
}

.operation-match__authority {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 18px;
  border-top: 1px solid #edf1ee;
  border-bottom: 1px solid #edf1ee;
}

.operation-match__authority span {
  color: #7a847d;
  font-size: 0.72rem;
}

.operation-match__authority strong {
  min-width: 0;
  overflow: hidden;
  font-size: 0.78rem;
  text-align: right;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.operation-match__actions {
  min-height: 60px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
}

.operation-action {
  min-height: 39px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 13px;
  border-radius: 10px;
  font-size: 0.76rem;
  font-weight: 700;
  text-decoration: none;
}

.operation-action--quiet {
  border: 1px solid #dce4de;
  color: #273029;
  background: #fff;
}

.operation-action--primary {
  color: #fff;
  background: #247a43;
}

.operation-match__view-only {
  margin-left: auto;
  padding-right: 5px;
  color: #89918b;
  font-size: 0.72rem;
  font-weight: 650;
}

@keyframes operation-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .live-operations {
    width: min(94%, 680px);
    padding-top: 22px;
  }

  .live-operations__header {
    align-items: stretch;
    flex-direction: column;
    gap: 20px;
  }

  .live-operations__summary {
    width: 100%;
  }

  .live-operations__summary > div {
    flex: 1;
  }

  .live-operations__matches {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 420px) {
  .live-operations__summary {
    flex-direction: column;
  }

  .operation-match__header {
    align-items: flex-start;
  }

  .operation-match__header > div {
    align-items: flex-start;
    flex-direction: column;
    gap: 5px;
  }

  .operation-match__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .operation-action {
    width: 100%;
  }

  .operation-match__view-only {
    margin: 3px auto;
    padding: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-operations__loading span {
    animation: none;
  }
}
</style>
