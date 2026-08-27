<script setup>
defineProps({
  priority: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['open'])

function matchupLabel(priority) {
  return (priority.players || []).map((player) => player.name).join(' versus ')
}

function openPriority(priority) {
  emit('open', priority)
}
</script>

<template>
  <section class="home-priority" aria-labelledby="home-priority-title">
    <span class="home-priority__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="m13 2-7 11h6l-1 9 7-12h-6Z" />
      </svg>
    </span>

    <div class="home-priority__copy">
      <p class="home-priority__eyebrow">{{ priority.eyebrow }}</p>
      <h2 id="home-priority-title">{{ priority.title }}</h2>
      <p v-if="priority.supportingText" class="home-priority__supporting">
        {{ priority.supportingText }}
      </p>

      <div class="home-priority__meta">
        <span v-if="priority.category">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3" />
            <path d="M6 20a6 6 0 0 1 12 0" />
          </svg>
          {{ priority.category }}
        </span>
        <span v-if="priority.court">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="1" />
            <path d="M12 5v14M3 12h18M7 5v14M17 5v14" />
          </svg>
          {{ priority.court }}
        </span>
        <span v-if="priority.time">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {{ priority.time }}
        </span>
      </div>
    </div>

    <div
      v-if="priority.players?.length"
      class="home-priority__players"
      :aria-label="matchupLabel(priority)"
    >
      <template v-for="(player, index) in priority.players" :key="player.id">
        <span v-if="index" class="home-priority__versus" aria-hidden="true">vs</span>
        <img :src="player.image" :alt="player.name" />
      </template>
    </div>

    <div class="home-priority__action-wrap">
      <button type="button" @click="openPriority(priority)">
        {{ priority.ctaLabel }}
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>
      </button>
      <p v-if="priority.dateLabel">{{ priority.dateLabel }}</p>
    </div>
  </section>
</template>

<style scoped>
.home-priority {
  display: grid;
  min-height: 152px;
  grid-template-columns: 48px minmax(0, 1fr) auto minmax(148px, auto);
  align-items: center;
  gap: 20px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border));
  border-radius: 14px;
  padding: 22px 24px;
  background: color-mix(in srgb, var(--color-primary) 3%, var(--color-surface));
  box-shadow: var(--flow-shadow-quiet);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.home-priority:hover {
  border-color: color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  box-shadow: var(--flow-shadow-hover);
  transform: translateY(-1px);
}

.home-priority__icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 14px;
  background: var(--color-surface);
  box-shadow: 0 7px 18px rgba(15, 34, 24, 0.04);
  color: var(--color-primary-strong);
}

.home-priority__icon svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.75;
}

.home-priority__eyebrow,
.home-priority h2,
.home-priority__supporting {
  margin: 0;
}

.home-priority__eyebrow {
  margin-bottom: 5px;
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.1em;
  line-height: 1.2;
  text-transform: uppercase;
}

.home-priority h2 {
  color: var(--color-text-soft);
  font-size: 20px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.018em;
  line-height: 1.25;
}

.home-priority__supporting {
  margin-top: 5px;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: var(--font-weight-regular);
  line-height: 1.55;
}

.home-priority__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 11px;
  color: var(--color-muted);
  font-size: 11px;
}

.home-priority__meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.home-priority__meta svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}

.home-priority__players {
  display: flex;
  align-items: center;
  gap: 7px;
  border-left: 1px solid var(--color-border);
  padding-left: 20px;
}

.home-priority__players img {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border: 3px solid var(--color-surface);
  border-radius: 50%;
  background: var(--color-surface-soft);
  box-shadow: 0 0 0 1px var(--color-border-strong);
  object-fit: cover;
}

.home-priority__versus {
  color: var(--color-muted);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
}

.home-priority__action-wrap {
  display: grid;
  gap: 6px;
}

.home-priority__action-wrap button {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--color-primary-strong);
  border-radius: var(--app-inner-radius);
  padding: 0 15px;
  background: var(--color-primary-strong);
  color: var(--color-light);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  transition:
    box-shadow 160ms ease,
    transform 160ms ease;
}

.home-priority__action-wrap button svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.home-priority__action-wrap button:hover {
  box-shadow: 0 9px 22px rgba(0, 143, 21, 0.12);
  transform: translateY(-1px);
}

.home-priority__action-wrap p {
  margin: 0;
  color: var(--color-muted);
  font-size: 10px;
  text-align: center;
}

@media (max-width: 860px) {
  .home-priority {
    grid-template-columns: 48px minmax(0, 1fr) auto;
  }

  .home-priority__players {
    display: none;
  }
}

@media (max-width: 620px) {
  .home-priority {
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 14px;
    padding: 19px 18px;
  }

  .home-priority__icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
  }

  .home-priority__action-wrap {
    grid-column: 1 / -1;
  }

  .home-priority__action-wrap button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-priority,
  .home-priority__action-wrap button {
    transition: none;
  }

  .home-priority:hover,
  .home-priority__action-wrap button:hover {
    transform: none;
  }
}
</style>
