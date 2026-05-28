<script setup>
import { computed } from 'vue'
import CategoryStatusBadge from './CategoryStatusBadge.vue'

const props = defineProps({
  category: {
    type: Object,
    required: true,
  },
  matches: {
    type: Array,
    default: () => [],
  },
  currentPlayerId: {
    type: String,
    default: '',
  },
})

const playerCount = computed(() =>
  props.category.groups?.length
    ? props.category.groups.reduce(
        (total, group) => total + group.players.filter((player) => !player.isBye).length,
        0,
      )
    : props.category.players?.filter((player) => !player.isBye).length || 0,
)
const completedCount = computed(
  () => props.matches.filter((match) => !match.isBye && ['completed', 'walkover'].includes(match.status)).length,
)
const groupMatches = computed(() => props.matches.filter((match) => match.round === 'group' && !match.isBye))
const groupCompletedCount = computed(
  () => groupMatches.value.filter((match) => ['completed', 'walkover'].includes(match.status)).length,
)
const pendingCount = computed(() => props.matches.filter((match) => !match.isBye && match.status === 'pending').length)
const liveCount = computed(
  () => props.matches.filter((match) => !match.isBye && match.liveState?.startedAt && match.status === 'pending').length,
)
const currentPlayerEntry = computed(() => {
  if (!props.currentPlayerId) {
    return null
  }

  for (const group of props.category.groups || []) {
    const player = group.players.find((entry) => entry.playerId === props.currentPlayerId)
    if (player) {
      return { group, player }
    }
  }

  return null
})
const progress = computed(() =>
  groupMatches.value.length
    ? Math.round((groupCompletedCount.value / groupMatches.value.length) * 100)
    : 0,
)
const cardStatusSummary = computed(() => {
  if (liveCount.value) {
    return `${liveCount.value} live`
  }

  if (pendingCount.value) {
    return `${pendingCount.value} pending`
  }

  return `${completedCount.value} completed`
})
const knockoutSummary = computed(() => {
  if (props.category.knockout?.championName) {
    return `Champion: ${props.category.knockout.championName}`
  }

  if (props.category.status === 'round-robin') {
    return 'Knockout waiting'
  }

  const quarterFinalsComplete =
    props.category.knockout?.quarterFinals?.filter((match) => match.status === 'completed').length || 0
  const semiFinalsComplete =
    props.category.knockout?.semiFinals?.filter((match) => match.status === 'completed').length || 0
  if (props.category.knockout?.quarterFinals?.length) {
    return quarterFinalsComplete < props.category.knockout.quarterFinals.length
      ? `Quarterfinals started (${quarterFinalsComplete}/${props.category.knockout.quarterFinals.length})`
      : 'Knockout active'
  }

  return semiFinalsComplete < (props.category.knockout?.semiFinals?.length || 0)
    ? `Semifinals started (${semiFinalsComplete}/${props.category.knockout?.semiFinals?.length || 0})`
    : 'Final active'
})
</script>

<template>
  <RouterLink
    class="category-card t-fade-up"
    :class="{ 'category-card--current-player': currentPlayerEntry }"
    :to="`/tournaments/${category.tournamentId}/category/${category.id}`"
  >
    <header class="category-card__header">
      <h3 class="category-card__name">{{ category.name }}</h3>
      <div class="category-card__badges">
        <span v-if="currentPlayerEntry" class="category-card__you">You're here</span>
        <CategoryStatusBadge :status="category.status" />
      </div>
    </header>

    <div class="category-card__meta">
      <span>{{ playerCount }} players</span>
      <span>{{ category.groups.length ? `${category.groups.length} match groups` : 'Straight draw' }}</span>
      <span>{{ cardStatusSummary }}</span>
    </div>

    <p v-if="currentPlayerEntry" class="category-card__player-note">
      {{ currentPlayerEntry.group.name }} - seed #{{ currentPlayerEntry.player.seed }}
    </p>

    <div>
      <p class="category-card__progress-copy">
        Group stage: {{ groupCompletedCount }} of {{ groupMatches.length }}
      </p>
      <div class="t-progress">
        <span class="t-progress__fill" :style="{ width: `${progress}%` }"></span>
      </div>
    </div>

    <footer class="category-card__footer">
      <span>{{ knockoutSummary }}</span>
      <strong>Open</strong>
    </footer>
  </RouterLink>
</template>

<style scoped>
.category-card {
  display: grid;
  gap: 12px;
  border: 1px solid var(--tournament-line);
  border-radius: 14px;
  background: #ffffff;
  padding: 18px;
  color: inherit;
  text-decoration: none;
  box-shadow: var(--tournament-card-shadow);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.category-card:hover {
  border-color: rgba(0, 181, 26, 0.4);
  box-shadow: var(--tournament-lift-shadow);
  transform: translateY(-2px);
}

.category-card--current-player {
  border-color: rgba(0, 181, 26, 0.44);
  background: linear-gradient(180deg, #ffffff 0%, rgba(0, 181, 26, 0.045) 100%);
}

.category-card__header,
.category-card__meta,
.category-card__badges,
.category-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.category-card__name,
.category-card__progress-copy,
.category-card__player-note {
  margin: 0;
}

.category-card__name {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.category-card__meta,
.category-card__progress-copy,
.category-card__footer {
  color: var(--tournament-muted);
  font-size: 12px;
  font-weight: 600;
}

.category-card__meta {
  justify-content: flex-start;
}

.category-card__badges {
  justify-content: flex-end;
}

.category-card__you {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 3px 8px;
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
  font-size: 10px;
  font-weight: 900;
}

.category-card__player-note {
  color: var(--tournament-green-dark);
  font-size: 12px;
  font-weight: 800;
}

.category-card__meta span + span::before {
  content: '.';
  margin-right: 10px;
}

.category-card__footer strong {
  color: var(--tournament-green-dark);
  font-size: 13px;
}
</style>
