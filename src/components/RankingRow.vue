<script setup>
import { computed } from 'vue'

const props = defineProps({
  player: { type: Object, required: true },
  zone: {
    type: String,
    default: 'out-of-range',
    validator: (v) => ['challengeable', 'self', 'out-of-range'].includes(v),
  },
})

const emit = defineEmits({
  challenge: (id) => typeof id === 'string' && id.length > 0,
})

const initials = computed(() => {
  const parts = props.player.name?.trim().split(' ') ?? []
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return props.player.name?.slice(0, 2).toUpperCase() ?? '??'
})

const winRate = computed(() => {
  const { wins, losses } = props.player
  const total = wins + losses
  if (total === 0) return null
  return Math.round((wins / total) * 100)
})

const winRateTier = computed(() => {
  if (winRate.value === null) return 'mid'
  if (winRate.value >= 65) return 'hi'
  if (winRate.value >= 45) return 'mid'
  return 'lo'
})

const isSelf = computed(() => props.zone === 'self')
const isChallengeable = computed(() => props.zone === 'challengeable')
const isOut = computed(() => props.zone === 'out-of-range')
</script>

<template>
  <article
    class="rrow"
    :class="{
      'rrow--challengeable': isChallengeable,
      'rrow--self': isSelf,
      'rrow--out': isOut,
    }"
  >
    <!-- Avatar -->
    <div
      class="rrow__avatar"
      :class="{
        'rrow__avatar--green': isChallengeable,
        'rrow__avatar--amber': isSelf,
        'rrow__avatar--gray': isOut,
      }"
    >
      {{ initials }}
    </div>

    <!-- Rank -->
    <span class="rrow__rank" :class="{ 'rrow__rank--one': player.rank === 1 }">
      #{{ player.rank }}
    </span>

    <!-- Name -->
    <div class="rrow__identity">
      <span class="rrow__name">{{ player.name }}</span>
      <span v-if="isSelf" class="rrow__you">you</span>
    </div>

    <!-- Record -->
    <span class="rrow__record">{{ player.wins }}W – {{ player.losses }}L</span>

    <!-- Win rate pill -->
    <span
      class="rrow__wr-pill"
      :class="{
        'rrow__wr-pill--hi': winRateTier === 'hi',
        'rrow__wr-pill--mid': winRateTier === 'mid',
        'rrow__wr-pill--lo': winRateTier === 'lo',
      }"
    >
      {{ winRate !== null ? winRate + '%' : '—' }}
    </span>

    <!-- Action -->
    <div class="rrow__action">
      <button
        v-if="isChallengeable"
        class="rrow__btn"
        type="button"
        @click="emit('challenge', player.id)"
      >
        Challenge
      </button>
      <span v-else-if="isSelf" class="rrow__self-label">Your position</span>
    </div>
  </article>
</template>

<style scoped>
/* ── Grid: avatar | rank | name | record | wr | action ── */
.rrow {
  display: grid;
  grid-template-columns: 36px 44px 1fr 100px 80px 110px;
  align-items: center;
  gap: 0 10px;
  padding: 11px 16px 11px 14px;
  border-bottom: 1px solid var(--color-border);
  border-left: 2px solid transparent;
  transition:
    background 0.12s ease,
    opacity 0.12s ease;
}

.rrow:last-child {
  border-bottom: none;
}

/* ── Zones ── */
.rrow--challengeable {
  border-left-color: var(--color-primary);
}

.rrow--challengeable:hover {
  background: rgba(0, 181, 26, 0.04);
}

.rrow--self {
  border-left-color: var(--color-accent);
  background: rgba(255, 211, 61, 0.05);
}

.rrow--out {
  opacity: 0.48;
}

.rrow--out:hover {
  opacity: 0.8;
}

/* ── Avatar ── */
.rrow__avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.rrow__avatar--green {
  background: rgba(0, 181, 26, 0.12);
  color: var(--color-primary-strong);
}
.rrow__avatar--amber {
  background: rgba(255, 211, 61, 0.22);
  color: #845f00;
}
.rrow__avatar--gray {
  background: var(--color-surface-soft);
  color: var(--color-muted);
}

/* ── Rank ── */
.rrow__rank {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  font-family: 'DM Mono', ui-monospace, monospace;
}

.rrow__rank--one {
  color: #845f00;
}

/* ── Identity ── */
.rrow__identity {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.rrow__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rrow__you {
  font-size: 9px;
  font-weight: 800;
  background: rgba(255, 211, 61, 0.22);
  color: #845f00;
  padding: 1px 6px;
  border-radius: 999px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  flex-shrink: 0;
}

/* ── Record ── */
.rrow__record {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-soft);
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-family: 'DM Mono', ui-monospace, monospace;
  white-space: nowrap;
}

/* ── Win rate pill ── */
.rrow__wr-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 5px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  justify-self: end;
  white-space: nowrap;
}

.rrow__wr-pill--hi {
  background: rgba(0, 181, 26, 0.12);
  color: var(--color-primary-strong);
}
.rrow__wr-pill--mid {
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
}
.rrow__wr-pill--lo {
  background: rgba(220, 53, 69, 0.09);
  color: #991b1b;
}

/* ── Action ── */
.rrow__action {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.rrow__btn {
  font-size: 11px;
  font-weight: 700;
  padding: 5px 13px;
  border-radius: 6px;
  border: 1px solid rgba(0, 181, 26, 0.35);
  background: transparent;
  color: var(--color-primary-strong);
  cursor: pointer;
  white-space: nowrap;
  letter-spacing: 0.02em;
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    box-shadow 0.12s ease;
}

.rrow__btn:hover {
  background: rgba(0, 181, 26, 0.08);
  border-color: rgba(0, 181, 26, 0.6);
  box-shadow: 0 1px 4px rgba(0, 181, 26, 0.15);
}

.rrow__self-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-muted);
  white-space: nowrap;
}

/* ── Responsive ── */
@media (max-width: 700px) {
  .rrow {
    grid-template-columns: 30px 36px 1fr 70px;
  }

  .rrow__wr-pill,
  .rrow__action {
    display: none;
  }

  .rrow__record {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .rrow {
    grid-template-columns: 30px 32px 1fr;
    padding: 10px 12px 10px 10px;
  }

  .rrow__record {
    display: none;
  }
}
</style>
