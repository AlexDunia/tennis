<script setup>
// IMPORTS
import { computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useMatchStore } from '../stores/match'
import { useAuthStore } from '../stores/auth'
import MatchCard from '../components/MatchCard.vue'

// PROPS
// none

// EMITS
// none

// ROUTER / ROUTE
const router = useRouter()

// STORES
const matchStore = useMatchStore()
const authStore = useAuthStore()

// REACTIVE STATE
const matchForm = reactive({
  title: 'Corporate Rally',
  type: 'Singles',
  level: 'Intermediate',
  time: new Date().toISOString().slice(0, 16),
  maxPlayers: 2,
  court: 'Port Harcourt Company Court',
  description: 'Team-building match',
})

// COMPUTED PROPERTIES
const liveMatches = computed(() => matchStore.liveMatches)
const upcomingMatches = computed(() => matchStore.upcomingMatches)

// METHODS
async function loadMatches() {
  try {
    await matchStore.loadMatches()
  } catch (_) {
    // error handled in store
  }
}

async function handleJoin(matchId) {
  try {
    const updated = await matchStore.joinExistingMatch(matchId, authStore.user?.name ?? 'Shell player')
    if (updated.status === 'live') {
      router.push(`/play/${updated.id}`)
    }
  } catch (_) {
    // handled in store
  }
}

async function handleCreateMatch() {
  try {
    await matchStore.createNewMatch({
      title: matchForm.title,
      type: matchForm.type,
      level: matchForm.level,
      time: new Date(matchForm.time).toISOString(),
      maxPlayers: matchForm.maxPlayers,
      court: matchForm.court,
      description: matchForm.description,
      hostName: authStore.user?.name ?? 'Shell player',
      bestOfSets: 3,
    })
  } catch (_) {
    // handled
  }
}

// WATCHERS
// none

// LIFECYCLE HOOKS
onMounted(() => {
  loadMatches()
})
</script>

<template>
  <section class="matches">
    <header class="matches__header">
      <h1 class="matches__title">Open matches</h1>
      <p class="matches__lead">Create a singles or doubles match, invite your team, and follow the theater of points live.</p>
    </header>
    <div class="matches__grid">
      <div class="matches__list">
        <h2 class="matches__subtitle">Live right now</h2>
        <div class="matches__row" v-if="liveMatches.length === 0">No ongoing matches yet.</div>
        <MatchCard v-for="match in liveMatches" :key="match.id" :match="match" @join="handleJoin" />
        <h2 class="matches__subtitle">Upcoming</h2>
        <div class="matches__row" v-if="upcomingMatches.length === 0">No upcoming invitations.</div>
        <MatchCard v-for="match in upcomingMatches" :key="`upcoming-${match.id}`" :match="match" @join="handleJoin" />
      </div>
      <div class="matches__form">
        <h2>Create a match</h2>
        <form class="matches__create" @submit.prevent="handleCreateMatch">
          <label class="matches__label">Title</label>
          <input class="matches__input" v-model="matchForm.title" type="text" />
          <label class="matches__label">Type</label>
          <select class="matches__input" v-model="matchForm.type">
            <option>Singles</option>
            <option>Doubles</option>
          </select>
          <label class="matches__label">Level</label>
          <select class="matches__input" v-model="matchForm.level">
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
          <label class="matches__label">Date & time</label>
          <input class="matches__input" v-model="matchForm.time" type="datetime-local" />
          <label class="matches__label">Max players</label>
          <input class="matches__input" v-model.number="matchForm.maxPlayers" type="number" min="2" max="4" />
          <label class="matches__label">Court</label>
          <input class="matches__input" v-model="matchForm.court" type="text" />
          <label class="matches__label">Description</label>
          <textarea class="matches__input" v-model="matchForm.description" rows="3"></textarea>
          <button class="matches__button" type="submit">Publish match</button>
        </form>
      </div>
    </div>
  </section>
</template>

<style scoped>
.matches {
  padding: 2rem 1.25rem;
}
.matches__grid {
  display: grid;
  gap: 2rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
.matches__list,
.matches__form {
  background: #fff;
  border-radius: 1.2rem;
  padding: 1.25rem;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.08);
}
.matches__title {
  margin: 0;
}
.matches__lead {
  margin: 0.35rem 0 1rem;
  color: rgba(0, 0, 0, 0.65);
}
.matches__subtitle {
  margin: 1rem 0 0.5rem;
}
.matches__row {
  margin-bottom: 0.5rem;
  color: rgba(0, 0, 0, 0.6);
}
.matches__create {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.matches__label {
  font-weight: 600;
}
.matches__input {
  border-radius: 0.85rem;
  border: 1px solid rgba(0, 0, 0, 0.2);
  padding: 0.7rem;
  font-family: inherit;
}
.matches__button {
  margin-top: 0.5rem;
  border: none;
  border-radius: 0.9rem;
  padding: 0.8rem;
  background: #bf0a30;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
</style>
