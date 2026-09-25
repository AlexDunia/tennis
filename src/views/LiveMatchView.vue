<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FriendlyMatchFlowView from './FriendlyMatchFlowView.vue'
import EmptyState from '../components/EmptyState.vue'
import LivePresenceStrip from '../components/match/LivePresenceStrip.vue'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import { useFriendlyMatchStore } from '../stores/friendlyMatch'
import { useNotificationStore } from '../stores/notification'
import { usePlayerStore } from '../stores/player'
import { startOrResumeMatch } from '../services/LiveMatchService.js'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()
const friendlyMatchStore = useFriendlyMatchStore()
const notificationStore = useNotificationStore()
const playerStore = usePlayerStore()

const loading = ref(true)
const error = ref('')
const ready = ref(false)
const liveResult = ref(null)
const actorId = computed(() => authStore.user?.playerId || playerStore.currentPlayer?.id || authStore.user?.id || '')
const actorName = computed(() => playerStore.currentPlayer?.name || authStore.user?.name || 'Someone')
const canonicalMatch = computed(() => liveResult.value?.canonicalMatch || liveResult.value?.match || null)
const presenceRole = computed(() => {
  const scorerId = liveResult.value?.session?.scorerAuthority?.scorerId
  if (actorId.value && actorId.value === scorerId) return 'scorer'
  const current = canonicalMatch.value || {}
  const participantIds = [
    current.challengerId, current.defenderId, current.player1Id, current.player2Id,
    current.challenger?.id, current.defender?.id, current.player1?.id, current.player2?.id,
  ].filter(Boolean)
  return actorId.value && participantIds.includes(actorId.value) ? 'participant' : 'viewer'
})

function reportJoined(entry) {
  notificationStore.addToast({ message: `${entry.actorName || 'Someone'} joined this match.`, type: 'info' })
}

async function loadLiveMatch(matchId) {
  loading.value = true
  ready.value = false
  error.value = ''
  liveResult.value = null
  try {
    const result = await startOrResumeMatch({
      matchId,
      actorId: actorId.value,
      clubId: adminStore.activeClubId || '',
      explicitStart: false,
    })
    if (!result.ok) {
      error.value = result.message || 'This live Match is unavailable or has not been started.'
      return
    }
    if (route.name !== 'LiveMatch' || String(route.params.matchId || '') !== result.match.id) {
      await router.replace({ name: 'LiveMatch', params: { matchId: result.match.id } })
      return
    }
    if (!friendlyMatchStore.attachCanonicalLiveMatch(result.match, result.canonicalMatch, result.session, result.context)) {
      error.value = 'The canonical live Match could not be prepared for display.'
      return
    }
    liveResult.value = result
    ready.value = true
  } catch (loadError) {
    error.value = loadError?.message || 'This live Match could not be loaded.'
  } finally {
    loading.value = false
  }
}

watch(() => String(route.params.matchId || ''), (matchId) => { if (matchId) loadLiveMatch(matchId) }, { immediate: true })
</script>

<template>
  <section v-if="ready" class="canonical-live-match">
    <LivePresenceStrip
      :match-id="String(route.params.matchId || '')"
      :actor-id="actorId"
      :actor-name="actorName"
      :role="presenceRole"
      announce
      compact
      @joined="reportJoined"
    />
    <FriendlyMatchFlowView />
  </section>
  <section v-else class="canonical-live-state">
    <div v-if="loading" class="section-card canonical-live-state__loading" aria-label="Loading match">
      <span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line"></span>
    </div>
    <EmptyState v-else illustration="scoreboard" title="Live Match unavailable" :description="error" primary-action-label="Back to Play" @primary-action="router.push({ name: 'Play' })" />
  </section>
</template>

<style scoped>
.canonical-live-match { width: min(100%, 720px); margin: 0 auto; }
.canonical-live-state { width: min(100%, 720px); margin: 0 auto; }
.canonical-live-state__loading { display: grid; gap: 12px; padding: 28px; }
</style>