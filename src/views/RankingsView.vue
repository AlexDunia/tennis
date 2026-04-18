<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { usePlayerStore } from '../stores/player'
import PlayerCard from '../components/PlayerCard.vue'

const router = useRouter()
const route = useRoute()

const playerStore = usePlayerStore()

const sortedPlayers = computed(() => playerStore.sortedLadder)
const currentPlayer = computed(() => playerStore.currentPlayer)

function handleChallenge(playerId) {
  router.push({ name: 'CreateChallenge', query: { opponent: playerId } })
}

// ✅ central init
function init() {
  playerStore.loadPlayers()
}

// ✅ first load
onMounted(init)
</script>

<template>
  <section>
    <header class="section-header">
      <div>
        <p class="eyebrow">Rankings</p>
        <h1>Current ladder positions</h1>
      </div>
      <p class="section-copy">
        Challenge higher-ranked players within your permitted range to climb the leaderboard.
      </p>
    </header>

    <div class="rankings-grid">
      <div v-if="currentPlayer" class="current-player-card">
        <p class="eyebrow">Current user</p>
        <h2>{{ currentPlayer.name }}</h2>
        <p>Rank #{{ currentPlayer.rank }}</p>
        <p>Record: {{ currentPlayer.wins }}–{{ currentPlayer.losses }}</p>
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
  color: #4338ca;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.8rem;
}
.section-copy {
  margin: 0.75rem 0 0;
  color: #475569;
}
.rankings-grid {
  display: grid;
  gap: 1.5rem;
}
.current-player-card {
  background: #fff;
  border-radius: 1.25rem;
  border: 1px solid #e2e8f0;
  padding: 1.5rem;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}
.current-player-card h2 {
  margin: 0.5rem 0 0;
}
.player-list {
  display: grid;
  gap: 1rem;
}
</style>
