<script setup>
const props = defineProps({
  player: {
    type: Object,
    required: true,
  },
  position: {
    type: Number,
    required: true,
  },
  playerCount: {
    type: Number,
    required: true,
  },
  challengePaused: {
    type: Boolean,
    default: false,
  },
  canChallenge: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits([
  'move-up',
  'move-down',
  'move-to',
  'record-missing-match',
  'toggle-challenges',
  'set-up-challenge',
  'remove',
])
</script>

<template>
  <section class="ladder-player-options" @click.stop>
    <div class="ladder-player-options__position">
      <button
        type="button"
        :disabled="position <= 1"
        @click="emit('move-up')"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m6 12 4-4 4 4" />
        </svg>
        Move up
      </button>

      <button
        type="button"
        :disabled="position >= playerCount"
        @click="emit('move-down')"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m6 8 4 4 4-4" />
        </svg>
        Move down
      </button>

      <button type="button" @click="emit('move-to')">
        <span aria-hidden="true">#</span>
        Move to…
      </button>
    </div>

    <div class="ladder-player-options__actions">
      <button
        type="button"
        @click="emit('record-missing-match')"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 3.5h10v13H5z" />
          <path d="M7.5 7h5M7.5 10h5M7.5 13h3" />
        </svg>
        Record missing match
      </button>

      <button
        type="button"
        @click="emit('toggle-challenges')"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" />
          <path
            v-if="challengePaused"
            d="M8 7.5v5M12 7.5v5"
          />
          <path v-else d="m8 7 5 3-5 3Z" />
        </svg>
        {{ challengePaused ? 'Resume challenges' : 'Pause challenges' }}
      </button>

      <button
        type="button"
        :disabled="!canChallenge || challengePaused"
        @click="emit('set-up-challenge')"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 16 14 4M6 4l10 12" />
          <ellipse cx="6" cy="5" rx="1.8" ry="2.6" transform="rotate(-35 6 5)" />
          <ellipse cx="14" cy="5" rx="1.8" ry="2.6" transform="rotate(35 14 5)" />
        </svg>
        Set up a challenge
      </button>
    </div>

    <button
      class="ladder-player-options__remove"
      type="button"
      @click="emit('remove')"
    >
      Remove from this ladder
    </button>
  </section>
</template>

<style scoped>
.ladder-player-options {
  display: grid;
  gap: 11px;
  margin-top: -1px;
  padding: 14px 16px 15px 74px;
  border: 1px solid var(--color-border, #e4e9e5);
  border-top-color: rgba(44, 58, 48, 0.07);
  border-radius: 0 0 var(--app-card-radius, 12px) var(--app-card-radius, 12px);
  background: #fbfcfb;
}

.ladder-player-options__position,
.ladder-player-options__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ladder-player-options button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid #e1e7e2;
  border-radius: 8px;
  background: #fff;
  color: #59665d;
  font-size: 10px;
  font-weight: 600;
}

.ladder-player-options button:hover:not(:disabled) {
  border-color: #cfd8d1;
  background: #f7faf7;
}

.ladder-player-options button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.ladder-player-options button svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ladder-player-options__remove {
  width: fit-content;
  margin-top: 1px;
  padding-inline: 2px !important;
  border-color: transparent !important;
  background: transparent !important;
  color: #9a514c !important;
}

.ladder-player-options button:focus-visible {
  outline: 1px solid rgba(8, 173, 43, 0.45);
  outline-offset: 2px;
}

@media (max-width: 620px) {
  .ladder-player-options {
    padding: 13px;
  }

  .ladder-player-options__position,
  .ladder-player-options__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .ladder-player-options button {
    width: 100%;
    min-height: 40px;
  }

  .ladder-player-options__remove {
    width: fit-content;
  }
}
</style>

