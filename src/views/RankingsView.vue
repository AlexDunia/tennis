<script setup>
// 1. IMPORTS
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player'
import PlayerCard from '../components/PlayerCard.vue'

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
      <article v-if="currentPlayer" class="rankings__summary-card section-card">
        <p class="rankings__kicker">Current Player</p>
        <h2>{{ currentPlayer.name }}</h2>
        <p class="rankings__summary-copy">Rank #{{ currentPlayer.rank }}</p>
        <p class="rankings__summary-copy">
          Record {{ currentPlayer.wins }}-{{ currentPlayer.losses }}
        </p>
      </article>

      <article class="rankings__summary-card section-card">
        <p class="rankings__kicker">Challenge Window</p>
        <h2>{{ playerStore.availableOpponents.length }}</h2>
        <p class="rankings__summary-copy">
          Eligible higher-ranked opponents available from this ladder position.
        </p>
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
  gap: 1.2rem;
}

.rankings__summary-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.rankings__summary-card {
  padding: 1.2rem;
}

.rankings__kicker {
  margin: 0 0 0.3rem;
  color: var(--color-primary-strong);
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.rankings__summary-card h2 {
  margin: 0;
  font-size: 1.18rem;
}

.rankings__summary-copy {
  margin: 0.45rem 0 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.player-list {
  display: grid;
  gap: 0.85rem;
}

@media (max-width: 900px) {
  .rankings__summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
