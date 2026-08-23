<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

import { useRouter } from 'vue-router'

import LiveScoreboardView from './LiveScoreboardView.vue'

import {
  clearDisplaySessionForThisTab,
  getReadableDisplaySession,
  readDisplaySessionForThisTab,
  subscribeToDisplaySession,
} from '../services/tvPairingService'

const router = useRouter()

const displaySession = ref(null)

let stopDisplayWatch = () => {}

async function leaveDisplay(reason = 'ended') {
  stopDisplayWatch()

  stopDisplayWatch = () => {}

  clearDisplaySessionForThisTab()

  displaySession.value = null

  await router.replace({
    name: 'TvDisplayPairing',

    query: {
      reason,
    },
  })
}

onMounted(async () => {
  const sessionId = readDisplaySessionForThisTab()

  if (!sessionId) {
    await leaveDisplay('session')

    return
  }

  const session = getReadableDisplaySession(sessionId)

  if (!session) {
    await leaveDisplay('expired')

    return
  }

  displaySession.value = session

  stopDisplayWatch = subscribeToDisplaySession(
    sessionId,

    async (nextSession) => {
      if (!nextSession) {
        await leaveDisplay('ended')

        return
      }

      displaySession.value = nextSession
    },
  )
})

onUnmounted(() => {
  stopDisplayWatch()

  stopDisplayWatch = () => {}
})
</script>

<template>
  <LiveScoreboardView v-if="displaySession" :match-id="displaySession.matchId" />

  <main v-else class="display-live-loading">Connecting display…</main>
</template>

<style scoped>
.display-live-loading {
  min-height: 100svh;

  display: grid;
  place-items: center;

  color: #64756b;

  background: #fff;

  font-size: 12px;
}
</style>
