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
  { label: 'Awaiting Acceptance', value: 'awaiting' },
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
  <section>
    <header class="section-header">
      <div>
        <p class="eyebrow">Challenges</p>
        <h1>Manage all open ladder challenges</h1>
      </div>
      <p class="section-copy">Filter by status, accept challenges, or review completed results.</p>
    </header>

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
      <div v-if="visibleChallenges.length === 0" class="empty-state">
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
.section-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.eyebrow {
  margin: 0;
  color: var(--color-secondary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.8rem;
}

.section-copy {
  margin: 0.75rem 0 0;
  color: var(--color-muted);
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.tab-button {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.65rem 1rem;
  background: rgba(255, 252, 240, 0.82);
  color: var(--color-muted);
  font-weight: 700;
}

.tab-button--active {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-strong));
  color: #fffbea;
  border-color: transparent;
}

.challenge-list {
  display: grid;
  gap: 1rem;
}

.empty-state {
  padding: 1.5rem;
  background: rgba(255, 249, 231, 0.8);
  border-radius: 1rem;
  color: var(--color-muted);
}
</style>
