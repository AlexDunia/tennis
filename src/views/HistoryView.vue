<script setup>
// IMPORTS
import { computed, onMounted, ref } from 'vue'
import { useBookingStore } from '../stores/booking'
import { useMatchStore } from '../stores/match'
import EmptyState from '../components/EmptyState.vue'

// PROPS
// none

// EMITS
// none

// ROUTER / ROUTE
// none

// STORES
const bookingStore = useBookingStore()
const matchStore = useMatchStore()
const hasLoaded = ref(false)

// REACTIVE STATE
// none

// COMPUTED PROPERTIES
const bookingHistory = computed(() => [...bookingStore.bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
const completedMatches = computed(() => matchStore.matches.filter((match) => match.status === 'completed'))

// METHODS
async function loadHistory() {
  try {
    await bookingStore.loadBookings()
    await matchStore.loadMatches()
  } catch (_) {
    // handled
  } finally {
    hasLoaded.value = true
  }
}

// WATCHERS
// none

// LIFECYCLE HOOKS
onMounted(() => {
  loadHistory()
})
</script>

<template>
  <section class="history">
    <header class="history__header">
      <h1 class="history__title">Court & match history</h1>
      <p class="history__lead">All bookings and matches are saved locally for quick reference.</p>
    </header>
    <div class="history__grid">
      <article class="history__card">
        <h2>Bookings</h2>
        <ul v-if="bookingHistory.length" class="history__list">
          <li v-for="entry in bookingHistory" :key="entry.id" class="history__item">
            <p class="history__item-title">{{ entry.playerName }} · {{ entry.date }}</p>
            <p class="history__item-meta">{{ entry.startHour }}:00 · {{ entry.duration }} hr(s)</p>
          </li>
        </ul>
        <EmptyState v-else-if="hasLoaded" compact variant="first-use" illustration="fixtures" title="No bookings recorded" description="Completed court bookings will appear here." />
      </article>
      <article class="history__card">
        <h2>Matches</h2>
        <ul v-if="completedMatches.length" class="history__list">
          <li v-for="match in completedMatches" :key="match.id" class="history__item">
            <p class="history__item-title">{{ match.title }}</p>
            <p class="history__item-meta">Final: {{ match.scoreboard?.completedSets?.length }} sets</p>
          </li>
        </ul>
        <EmptyState v-else-if="hasLoaded" compact variant="first-use" illustration="matches" title="No matches recorded" description="Completed ladder, challenge and tournament matches will appear here." />
      </article>
    </div>
  </section>
</template>

<style scoped>
.history {
  padding: 2rem 1.25rem;
}
.history__grid {
  margin-top: 1.5rem;
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}
.history__card {
  background: #fff;
  border-radius: 1rem;
  padding: 1.25rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
}
.history__list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.history__item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  padding-bottom: 0.6rem;
}
.history__item:last-child {
  border-bottom: none;
}
.history__item-title {
  margin: 0;
  font-weight: var(--font-weight-semibold);
}
.history__item-meta {
  margin: 0;
  color: rgba(0, 0, 0, 0.6);
}
.history__lead {
  margin: 0;
  color: rgba(0, 0, 0, 0.7);
}
</style>
