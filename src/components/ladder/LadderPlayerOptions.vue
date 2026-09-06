<script setup>
defineProps({
  player: { type: Object, required: true },
  position: { type: Number, required: true },
  playerCount: { type: Number, required: true },
  challengePaused: { type: Boolean, default: false },
  canChallenge: { type: Boolean, default: true },
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
    <div class="ladder-player-options__row">
      <button type="button" :disabled="position <= 1" @click="emit('move-up')">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 12 4-4 4 4" /></svg>
        <span>Move up</span>
      </button>

      <button type="button" :disabled="position >= playerCount" @click="emit('move-down')">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
        <span>Move down</span>
      </button>

      <button type="button" @click="emit('move-to')">
        <span class="ladder-player-options__hash" aria-hidden="true">#</span>
        <span>Move to…</span>
      </button>

      <button type="button" @click="emit('record-missing-match')">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 3.5h10v13H5z" />
          <path d="M7.5 7h5M7.5 10h5M7.5 13h3" />
        </svg>
        <span>Record missing match</span>
      </button>

      <button type="button" @click="emit('toggle-challenges')">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" />
          <path v-if="challengePaused" d="M8 7.5v5M12 7.5v5" />
          <path v-else d="m8 7 5 3-5 3Z" />
        </svg>
        <span>{{ challengePaused ? 'Resume challenges' : 'Pause challenges' }}</span>
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
        <span>Set up a challenge</span>
      </button>

      <button class="ladder-player-options__remove" type="button" @click="emit('remove')">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6 6h8M8 6V4.5h4V6M7 8v7.5h6V8" />
        </svg>
        <span>Remove from this ladder</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.ladder-player-options {
  margin-top: -1px;
  padding: 14px 16px 15px 74px;
  border: 1px solid var(--color-border, #e4e9e5);
  border-top-color: rgba(44, 58, 48, 0.07);
  border-radius: 0 0 var(--app-card-radius, 12px) var(--app-card-radius, 12px);
  background: #fbfcfb;
}

.ladder-player-options__row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 1px;
  scrollbar-width: none;
}

.ladder-player-options__row::-webkit-scrollbar { display: none; }

.ladder-player-options button {
  display: inline-flex;
  min-width: max-content;
  min-height: 34px;
  flex: 0 0 auto;
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
  line-height: 1.2;
  white-space: nowrap;
}

.ladder-player-options button:hover:not(:disabled) {
  border-color: #cfd8d1;
  background: #f7faf7;
}

.ladder-player-options button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.ladder-player-options button svg {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ladder-player-options__hash {
  display: inline-grid;
  width: 14px;
  height: 14px;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
}

.ladder-player-options__remove {
  border-color: rgba(154, 81, 76, 0.16) !important;
  background: rgba(154, 81, 76, 0.035) !important;
  color: #9a514c !important;
}

.ladder-player-options__remove:hover {
  border-color: rgba(154, 81, 76, 0.28) !important;
  background: rgba(154, 81, 76, 0.065) !important;
}

.ladder-player-options button:focus-visible {
  outline: 1px solid rgba(8, 173, 43, 0.45);
  outline-offset: 2px;
}

@media (max-width: 767px) {
  .ladder-player-options { padding: 13px; }

  .ladder-player-options__row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    overflow: visible;
  }

  .ladder-player-options button {
    width: 100%;
    min-width: 0;
    min-height: 44px;
    height: auto;
    padding: 8px 9px;
    line-height: 1.25;
    white-space: normal;
  }

  .ladder-player-options button span:last-child {
    min-width: 0;
    word-break: normal;
  }

  .ladder-player-options__remove { grid-column: 1 / -1; }
}

@media (max-width: 390px) {
  .ladder-player-options__row { grid-template-columns: 1fr; }
  .ladder-player-options__remove { grid-column: auto; }
}
</style>
