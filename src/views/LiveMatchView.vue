<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FriendlyMatchFlowView from './FriendlyMatchFlowView.vue'
import EmptyState from '../components/EmptyState.vue'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import { useFriendlyMatchStore } from '../stores/friendlyMatch'
import { usePlayerStore } from '../stores/player'
import { startOrResumeMatch } from '../services/LiveMatchService.js'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()
const friendlyMatchStore = useFriendlyMatchStore()
const playerStore = usePlayerStore()

const loading = ref(true)
const error = ref('')
const ready = ref(false)
const actorId = computed(
  () => authStore.user?.playerId || playerStore.currentPlayer?.id || authStore.user?.id || '',
)

async function loadLiveMatch(matchId) {
  loading.value = true
  ready.value = false
  error.value = ''
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

    if (
      !friendlyMatchStore.attachCanonicalLiveMatch(
        result.match,
        result.canonicalMatch,
        result.session,
        result.context,
      )
    ) {
      error.value = 'The canonical live Match could not be prepared for display.'
      return
    }
    ready.value = true
  } catch (loadError) {
    error.value = loadError?.message || 'This live Match could not be loaded.'
  } finally {
    loading.value = false
  }
}

watch(
  () => String(route.params.matchId || ''),
  (matchId) => {
    if (matchId) loadLiveMatch(matchId)
  },
  { immediate: true },
)
</script>

<template>
  <FriendlyMatchFlowView v-if="ready" />
  <section v-else class="canonical-live-state">
    <div
      v-if="loading"
      class="section-card canonical-live-state__loading"
      aria-label="Loading match"
    >
      <span class="skeleton skeleton-line"></span>
      <span class="skeleton skeleton-line"></span>
      <span class="skeleton skeleton-line"></span>
    </div>
    <EmptyState
      v-else
      illustration="scoreboard"
      title="Live Match unavailable"
      :description="error"
      primary-action-label="Back to Play"
      @primary-action="router.push({ name: 'Play' })"
    />
  </section>
</template>

<style scoped>
.canonical-live-state {
  width: min(100%, 720px);
  margin: 0 auto;
}

.canonical-live-state__loading {
  display: grid;
  gap: 12px;
  padding: 28px;
}
</style>
