<script setup>
import { computed } from 'vue'
import CategoryStatusBadge from './CategoryStatusBadge.vue'
import { formatAppDateRange } from '../../utils/dateFormat'

const props = defineProps({
  tournament: {
    type: Object,
    required: true,
  },
  matches: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits({
  view: (tournament) => Boolean(tournament),
})

const categoryCount = computed(() => props.tournament.categories?.length || 0)
const playerCount = computed(() =>
  props.tournament.categories.reduce(
    (total, category) =>
      total +
      category.groups.reduce(
        (sum, group) => sum + group.players.filter((player) => !player.isBye).length,
        0,
      ),
    0,
  ),
)
const completedCount = computed(
  () => props.matches.filter((match) => ['completed', 'walkover'].includes(match.status)).length,
)
const progress = computed(() =>
  props.matches.length ? Math.round((completedCount.value / props.matches.length) * 100) : 0,
)
</script>

<template>
  <article class="tournament-card t-fade-up" @click="emit('view', tournament)">
    <div class="tournament-card__header">
      <div>
        <h3 class="tournament-card__name">{{ tournament.name }}</h3>
        <p class="tournament-card__dates">
          {{ formatAppDateRange(tournament.roundRobinStart, tournament.finalDate) }}
        </p>
      </div>
      <CategoryStatusBadge :status="tournament.status" />
    </div>

    <div class="tournament-card__stats">
      <span><strong>{{ categoryCount }}</strong> categories</span>
      <span><strong>{{ playerCount }}</strong> players</span>
      <span><strong>{{ completedCount }}</strong> of <strong>{{ matches.length }}</strong> matches done</span>
    </div>

    <div class="t-progress" aria-label="Tournament progress">
      <span class="t-progress__fill" :style="{ width: `${progress}%` }"></span>
    </div>

    <footer class="tournament-card__footer">
      <span>{{ progress }}% complete</span>
      <button type="button" class="t-button t-button--primary" @click.stop="emit('view', tournament)">
        View Tournament
      </button>
    </footer>
  </article>
</template>

<style scoped>
.tournament-card {
  display: grid;
  gap: 14px;
  border: 1px solid var(--tournament-line);
  border-radius: 14px;
  background: #ffffff;
  padding: 20px;
  box-shadow: var(--tournament-card-shadow);
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.tournament-card:hover {
  border-color: rgba(0, 181, 26, 0.35);
  box-shadow: var(--tournament-lift-shadow);
  transform: translateY(-2px);
}

.tournament-card__header,
.tournament-card__footer,
.tournament-card__stats {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.tournament-card__stats {
  justify-content: flex-start;
  flex-wrap: wrap;
  color: var(--tournament-muted);
  font-size: 12px;
}

.tournament-card__stats strong {
  color: var(--tournament-ink);
}

.tournament-card__name,
.tournament-card__dates {
  margin: 0;
}

.tournament-card__name {
  color: var(--tournament-ink);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.tournament-card__dates {
  margin-top: 4px;
  color: var(--tournament-muted);
  font-size: 12px;
  font-weight: 600;
}

.tournament-card__footer {
  align-items: center;
}

.tournament-card__footer span {
  color: var(--tournament-muted);
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 520px) {
  .tournament-card__header,
  .tournament-card__footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
