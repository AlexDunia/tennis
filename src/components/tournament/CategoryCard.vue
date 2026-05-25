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
  () => props.matches.filter((match) => ['completed', 'walkover'].includes(match.status)).length,
)
const groupMatches = computed(() => props.matches.filter((match) => match.round === 'group'))
const progress = computed(() =>
  groupMatches.value.length
    ? Math.round((completedCount.value / groupMatches.value.length) * 100)
    : 0,
)
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
    :to="`/tournaments/${category.tournamentId}/category/${category.id}`"
  >
    <header class="category-card__header">
      <h3 class="category-card__name">{{ category.name }}</h3>
      <CategoryStatusBadge :status="category.status" />
    </header>

    <div class="category-card__meta">
      <span>{{ playerCount }} players</span>
      <span>{{ category.groups.length ? `${category.groups.length} match groups` : 'Straight draw' }}</span>
    </div>

    <div>
      <p class="category-card__progress-copy">
        Group stage: {{ completedCount }} of {{ groupMatches.length }}
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

.category-card__header,
.category-card__meta,
.category-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.category-card__name,
.category-card__progress-copy {
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

.category-card__meta span + span::before {
  content: '.';
  margin-right: 10px;
}

.category-card__footer strong {
  color: var(--tournament-green-dark);
  font-size: 13px;
}
</style>
