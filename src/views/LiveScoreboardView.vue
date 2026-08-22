<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

import LiveScoreboard from '../components/match/LiveScoreboard.vue'

import { readLiveMatchSnapshot, subscribeToLiveMatch } from '../services/liveMatchRealtime'

const props = defineProps({
  matchId: {
    type: String,
    default: '',
  },
})

const snapshot = ref(null)
const viewState = ref('loading')
const now = ref(Date.now())

let unsubscribe = () => {}
let clockTimer = null

function normalizeMatchId(value) {
  const raw = String(value || '').trim()

  /*
   * Route parameters are not credentials.
   * Still reject pathological input rather than feeding
   * an arbitrary-size value into the local transport.
   */
  if (!raw || raw.length > 120) {
    return ''
  }

  return raw
}

function stopSubscription() {
  unsubscribe()
  unsubscribe = () => {}
}

function connectToMatch(rawMatchId) {
  stopSubscription()

  snapshot.value = null

  const matchId = normalizeMatchId(rawMatchId)

  if (!matchId) {
    viewState.value = 'invalid'
    return
  }

  /*
   * Fast first paint from the sanitized local cache.
   */
  const cached = readLiveMatchSnapshot(matchId)

  if (cached) {
    snapshot.value = cached
    viewState.value = 'ready'
  } else {
    /*
     * This is not treated as a permanent 404.
     *
     * A display can be opened immediately before the
     * first live snapshot arrives.
     */
    viewState.value = 'waiting'
  }

  /*
   * From here onward the view is a pure subscriber.
   * No callback writes into match/scoring state.
   */
  unsubscribe = subscribeToLiveMatch(
    matchId,

    (nextSnapshot) => {
      snapshot.value = nextSnapshot

      viewState.value = 'ready'
    },

    {
      /*
       * We already synchronously read the cache above.
       * Avoid delivering the same snapshot twice.
       */
      emitCurrent: false,
    },
  )
}

watch(
  () => props.matchId,

  (matchId) => {
    connectToMatch(matchId)
  },

  {
    immediate: true,
  },
)

if (typeof window !== 'undefined') {
  clockTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

onBeforeUnmount(() => {
  stopSubscription()

  if (clockTimer && typeof window !== 'undefined') {
    window.clearInterval(clockTimer)
  }

  clockTimer = null
})
</script>

<template>
  <LiveScoreboard v-if="viewState === 'ready' && snapshot" :snapshot="snapshot" :now="now" />

  <main v-else class="scoreboard-waiting" :aria-busy="viewState === 'waiting'">
    <div class="scoreboard-waiting__brand" aria-label="Gorra">
      <span aria-hidden="true"></span>

      <strong>GORRA</strong>
    </div>

    <section class="scoreboard-waiting__content">
      <div class="scoreboard-waiting__mark" aria-hidden="true">
        <span></span>
      </div>

      <template v-if="viewState === 'invalid'">
        <p>Live scoreboard</p>

        <h1>This scoreboard link isn’t valid.</h1>

        <span> Return to the match and open its scoreboard again. </span>
      </template>

      <template v-else>
        <p>Live scoreboard</p>

        <h1>Waiting for the match.</h1>

        <span>
          Keep this display open. Gorra will show the score here when the live match is available.
        </span>
      </template>
    </section>

    <footer>Read-only match display</footer>
  </main>
</template>

<style scoped>
.scoreboard-waiting {
  min-height: 100svh;
  display: grid;
  grid-template-rows:
    auto
    1fr
    auto;
  padding: 0 max(22px, 6vw);
  color: #fff;
  background: #032f24;
  font-family: inherit;
}

.scoreboard-waiting__brand {
  min-height: 74px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.07em;
}

.scoreboard-waiting__brand > span {
  position: relative;
  width: 19px;
  height: 19px;
  border: 1.5px solid rgba(255, 255, 255, 0.86);
  border-radius: 50%;
}

.scoreboard-waiting__content {
  width: min(560px, 100%);
  margin: auto;
  text-align: center;
}

.scoreboard-waiting__mark {
  width: 58px;
  height: 58px;
  margin: 0 auto 22px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.025);
}

.scoreboard-waiting__mark span {
  width: 17px;
  height: 17px;
  border: 2px solid #b8df63;
  border-radius: 50%;
}

.scoreboard-waiting__content p {
  margin: 0;
  color: #b8df63;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.scoreboard-waiting__content h1 {
  margin: 9px 0 0;
  color: #fff;
  font-size: clamp(28px, 6vw, 46px);
  font-weight: 700;
  letter-spacing: -0.035em;
}

.scoreboard-waiting__content > span {
  display: block;
  max-width: 450px;
  margin: 13px auto 0;
  color: rgba(255, 255, 255, 0.58);
  font-size: 13px;
  line-height: 1.65;
}

.scoreboard-waiting footer {
  min-height: 48px;
  display: flex;
  align-items: center;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.42);
  font-size: 9px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
    animation: none !important;
  }
}
</style>
