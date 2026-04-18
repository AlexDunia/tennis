<script setup>
// 1. IMPORTS
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import ChallengeCard from '../components/ChallengeCard.vue'

// 2. PROPS
// none

// 3. EMITS
// none

// 4. ROUTER / ROUTE
const router = useRouter()

// 5. STORES
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()

// 6. REACTIVE STATE
const tabs = [
  { label: 'All', value: 'all' },
  { label: 'Awaiting', value: 'awaiting' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Pending Review', value: 'pending_review' },
]

// 7. COMPUTED PROPERTIES
const visibleChallenges = computed(() => challengeStore.filteredChallenges)

// 8. METHODS
const handleAccept = (challengeId) => {
  challengeStore.acceptChallenge(challengeId).then((data) => {
    if (data) {
      matchStore.loadMatches()
    }
  })
}

const handleReview = (challengeId) => {
  challengeStore.reviewChallenge(challengeId).then((data) => {
    if (data) {
      matchStore.loadMatches()
    }
  })
}

const handleDetails = (challenge) => {
  const match = matchStore.matches.find((item) => item.challengeId === challenge.id)
  if (match) {
    router.push({ name: 'MatchDetails', params: { matchId: match.id } })
  }
}

const loadChallengesView = async () => {
  await Promise.all([challengeStore.loadChallenges(), matchStore.loadMatches()])
}

// 9. WATCHERS
// none

// 10. LIFECYCLE HOOKS
onMounted(() => {
  loadChallengesView()
})
</script>

<template>
  <section class="challenges">
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        :class="['tab-button', { 'tab-button--active': challengeStore.filterStatus === tab.value }]"
        type="button"
        @click="challengeStore.setFilter(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="challenge-list">
      <div v-if="visibleChallenges.length === 0" class="empty-state section-card">
        No challenges match this filter.
      </div>
      <ChallengeCard
        v-for="challenge in visibleChallenges"
        :key="challenge.id"
        :challenge="challenge"
        :challengerName="challenge.challengerName"
        :defenderName="challenge.defenderName"
        :showAccept="challenge.status === 'awaiting'"
        :showReview="challenge.status === 'pending_review'"
        :showDetails="challenge.status !== 'awaiting'"
        @accept="handleAccept"
        @review="handleReview"
        @details="handleDetails"
      />
    </div>
  </section>
</template>

<style scoped>
.challenges {
  display: grid;
  gap: 2rem;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.tab-button {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 0 14px;
  min-height: 38px;
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 0.9rem;
  font-weight: 600;
  transition:
    background 0.12s ease-in-out,
    border-color 0.12s ease-in-out,
    color 0.12s ease-in-out,
    transform 0.12s ease-in-out;
}

.tab-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.tab-button--active {
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-accent-bright);
  border-color: rgba(0, 181, 26, 0.14);
}

.challenge-list {
  display: grid;
  gap: 1rem;
}

.empty-state {
  padding: 1.25rem;
  color: var(--color-muted);
  border-radius: 0.75rem;
  background: var(--color-surface-muted);
}
</style>
