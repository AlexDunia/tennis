<script setup>
import { computed } from 'vue'
import { formatAppDateTime } from '../../utils/dateFormat'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  busy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['action'])

function courtLabel(court) {
  if (!court) return ''
  if (typeof court === 'object') return court.name || court.label || court.id || ''
  return String(court)
}

const scheduledLabel = computed(() =>
  props.item.scheduledAt ? formatAppDateTime(props.item.scheduledAt) : '',
)

const metaItems = computed(() => {
  const items = [props.item.sourceLabel]
  if (props.item.competitionLabel && props.item.competitionLabel !== props.item.sourceLabel) {
    items.push(props.item.competitionLabel)
  }
  if (scheduledLabel.value) items.push(scheduledLabel.value)
  const court = courtLabel(props.item.court)
  if (court) items.push(court)
  if (props.item.score && props.item.lifecycle === 'pending_review') {
    items.push(props.item.score)
  }
  return items.filter(Boolean)
})

function selectAction(action) {
  if (props.busy) return
  emit('action', { action, item: props.item })
}
</script>

<template>
  <article
    class="play-match-item-row"
    :class="`play-match-item-row--${item.group || 'upcoming'}`"
    :aria-busy="busy ? 'true' : 'false'"
  >
    <div class="play-match-item-row__main">
      <small class="play-match-item-row__status">{{ item.statusLabel }}</small>

      <strong class="play-match-item-row__players">
        {{ item.player1Name }} <span>vs</span> {{ item.player2Name }}
      </strong>

      <p v-if="item.secondaryCopy" class="play-match-item-row__secondary">
        {{ item.secondaryCopy }}
      </p>

      <div v-if="metaItems.length" class="play-match-item-row__meta">
        <span v-for="meta in metaItems" :key="meta">{{ meta }}</span>
      </div>
    </div>

    <div v-if="item.actions?.length" class="play-match-item-row__actions">
      <button
        v-for="action in item.actions"
        :key="action.id"
        type="button"
        class="play-match-item-row__action"
        :class="`play-match-item-row__action--${action.tone || 'quiet'}`"
        :disabled="busy"
        @click="selectAction(action)"
      >
        {{ action.label }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.play-match-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5, 20px);
  min-width: 0;
  padding: 17px 18px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.play-match-item-row__main {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.play-match-item-row__status {
  color: var(--color-muted);
  font-size: var(--type-overline, 11px);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--type-tracking-eyebrow, 0.08em);
  line-height: var(--type-line-tight, 1.35);
  text-transform: uppercase;
}

.play-match-item-row--now .play-match-item-row__status,
.play-match-item-row--needs_you .play-match-item-row__status {
  color: var(--color-primary-strong);
}

.play-match-item-row__players {
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--type-row-title, 14px);
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.play-match-item-row__players span {
  color: var(--color-muted);
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
}

.play-match-item-row__secondary {
  margin: 0;
  color: var(--color-text-soft);
  font-size: 12px;
  font-weight: var(--font-weight-regular);
  line-height: 1.5;
}

.play-match-item-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  color: var(--color-muted);
  font-size: var(--type-meta, 12px);
  font-weight: var(--font-weight-regular);
  line-height: 1.45;
}

.play-match-item-row__meta span + span::before {
  margin-right: 10px;
  color: var(--color-border-strong);
  content: 'Â·';
}

.play-match-item-row__actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.play-match-item-row__action {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-control-radius);
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
}

.play-match-item-row__action:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  background: var(--color-surface-softest);
  color: var(--color-text);
}

.play-match-item-row__action--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.play-match-item-row__action--primary:hover:not(:disabled) {
  border-color: var(--color-primary-strong);
  background: var(--color-primary-strong);
  color: #fff;
}

.play-match-item-row__action--danger {
  border-color: transparent;
  background: transparent;
  color: var(--color-danger);
}

.play-match-item-row__action--danger:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-danger) 18%, var(--color-border));
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.play-match-item-row__action:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.play-match-item-row__action:disabled {
  cursor: wait;
}

@media (max-width: 680px) {
  .play-match-item-row {
    display: grid;
    gap: 14px;
    padding: 15px;
  }

  .play-match-item-row__players {
    white-space: normal;
  }

  .play-match-item-row__actions {
    justify-content: flex-start;
  }

  .play-match-item-row__action {
    min-height: 44px;
  }
}
</style>

