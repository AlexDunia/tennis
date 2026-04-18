<script setup>
// 1. IMPORTS
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import PlayerCard from '../components/PlayerCard.vue'
import PersonAvatar from '../components/PersonAvatar.vue'

// 2. PROPS
// none

// 3. EMITS
// none

// 4. ROUTER / ROUTE
const router = useRouter()

// 5. STORES
const playerStore = usePlayerStore()

// 6. REACTIVE STATE
// none

// 7. COMPUTED PROPERTIES
const sortedPlayers = computed(() => playerStore.sortedLadder)
const currentPlayer = computed(() => playerStore.currentPlayer)

// 8. METHODS
const handleChallenge = (playerId) => {
  router.push({ name: 'CreateChallenge', query: { opponent: playerId } })
}

const loadRankings = () => {
  playerStore.loadPlayers()
}

// 9. WATCHERS
// none

// 10. LIFECYCLE HOOKS
onMounted(() => {
  loadRankings()
})
</script>

<template>
  <section class="rankings">
    <div class="rankings__summary-grid">
      <article v-if="currentPlayer" class="rankings__summary-card section-card stat-card--tier2">
        <p class="rankings__kicker">Current Player</p>
        <div class="rankings__player-summary">
          <PersonAvatar :image="currentPlayer.imageUrl" :name="currentPlayer.name" size="58" />
          <div>
            <h2>{{ currentPlayer.name }}</h2>
            <p class="rankings__summary-copy">Rank #{{ currentPlayer.rank }}</p>
          </div>
        </div>
        <p class="rankings__summary-copy">
          Record {{ currentPlayer.wins }}-{{ currentPlayer.losses }}
        </p>
      </article>

      <article class="rankings__summary-card section-card stat-card--tier2">
        <p class="rankings__kicker">Challenge opportunities</p>
        <h2>{{ playerStore.availableOpponents.length }}</h2>
        <p class="rankings__summary-copy">Higher-ranked opponents available to challenge.</p>
      </article>
    </div>

    <div class="player-list">
      <PlayerCard
        v-for="player in sortedPlayers"
        :key="player.id"
        :player="player"
        :showChallenge="playerStore.availableOpponents.some((item) => item.id === player.id)"
        @challenge="handleChallenge"
      />
    </div>
  </section>
</template>

<style scoped>
.rankings {
  display: grid;
  gap: 2rem;
}

.rankings__summary-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.rankings__summary-card {
  padding: 1.25rem;
}

.stat-card--tier2 {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.stat-card--tier2:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.rankings__player-summary {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.rankings__player-summary h2 {
  margin: 0;
}

.rankings__summary-copy {
  margin: 0 0 0.35rem;
  color: var(--color-accent-support);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.rankings__summary-card h2 {
  margin: 0;
  font-size: 1.2rem;
}

.rankings__summary-copy {
  margin: 0.45rem 0 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.player-list {
  display: grid;
  gap: 1rem;
}

@media (max-width: 900px) {
  .rankings__summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
