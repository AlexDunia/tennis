<script setup>
// 1. IMPORTS
import BaseButton from './BaseButton.vue'
import PersonAvatar from './PersonAvatar.vue'
import { computed } from 'vue'

// 2. PROPS
const props = defineProps({
  player: {
    type: Object,
    required: true,
  },
  // 'challengeable' | 'self' | 'out-of-range'
  zone: {
    type: String,
    default: 'out-of-range',
    validator: (value) => ['challengeable', 'self', 'out-of-range'].includes(value),
  },
})

// 3. EMITS
const emit = defineEmits({
  challenge: (playerId) => typeof playerId === 'string' && playerId.length > 0,
})

// 7. COMPUTED PROPERTIES
const winRate = computed(() => {
  const { wins, losses } = props.player
  const total = wins + losses
  if (total === 0) return '—'
  return `${Math.round((wins / total) * 100)}%`
})

const isSelf = computed(() => props.zone === 'self')
const isChallengeable = computed(() => props.zone === 'challengeable')
</script>

<template>
  <article
    class="player-card"
    :class="{
      'player-card--self': isSelf,
      'player-card--challengeable': isChallengeable,
      'player-card--muted': zone === 'out-of-range',
    }"
  >
    <!-- Left: identity -->
    <div class="player-card__identity">
      <div class="player-card__rank-badge" :class="{ 'player-card__rank-badge--self': isSelf }">
        #{{ player.rank }}
      </div>

      <PersonAvatar :image="player.imageUrl" :name="player.name" size="44" />

      <div class="player-card__info">
        <div class="player-card__name-row">
          <h3 class="player-card__name">{{ player.name }}</h3>
          <span v-if="isSelf" class="player-card__you-badge">You</span>
        </div>
        <p class="player-card__record">
          {{ player.wins }}W – {{ player.losses }}L
          <span class="player-card__winrate">{{ winRate }} win rate</span>
        </p>
      </div>
    </div>

    <!-- Right: meta + action -->
    <div class="player-card__meta">
      <span class="player-card__meta-pill">{{ player.matchesPlayed }} played</span>

      <BaseButton
        v-if="isChallengeable"
        type="button"
        variant="secondary"
        @click="emit('challenge', player.id)"
      >
        Challenge
      </BaseButton>

      <span v-if="isSelf" class="player-card__self-label">Your position</span>
    </div>
  </article>
</template>

<style scoped>
.player-card {
  background: var(--color-surface);
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out,
    opacity 0.12s ease-in-out;
}

/* Zone: challengeable — green left accent */
.player-card--challengeable {
  border-left: 3px solid var(--color-primary);
}

.player-card--challengeable:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-strong);
}

/* Zone: self — yellow accent, pinned feel */
.player-card--self {
  border-left: 3px solid var(--color-accent);
  background: rgba(255, 211, 61, 0.04);
}

/* Zone: out-of-range — slightly dimmed */
.player-card--muted {
  opacity: 0.72;
}

.player-card--muted:hover {
  opacity: 1;
  transform: translateY(-1px);
}

/* Identity */
.player-card__identity {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.player-card__rank-badge {
  min-width: 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.65rem;
  background: rgba(0, 181, 26, 0.1);
  color: var(--color-primary-strong);
  font-size: 0.88rem;
  font-weight: 800;
  flex-shrink: 0;
}

.player-card__rank-badge--self {
  background: rgba(255, 211, 61, 0.18);
  color: #845f00;
}

.player-card__info {
  min-width: 0;
}

.player-card__name-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.player-card__name {
  margin: 0;
  font-size: 0.97rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-card__you-badge {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(255, 211, 61, 0.22);
  color: #845f00;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.player-card__record {
  margin: 0.2rem 0 0;
  color: var(--color-muted);
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.player-card__winrate {
  color: var(--color-border-strong);
  font-size: 0.8rem;
}

/* Meta */
.player-card__meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
}

.player-card__meta-pill {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  color: var(--color-text-soft);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.player-card__self-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-muted);
  white-space: nowrap;
}

@media (max-width: 720px) {
  .player-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .player-card__meta {
    justify-content: flex-start;
  }
}
</style>
