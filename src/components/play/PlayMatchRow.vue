<script setup>
import { computed } from 'vue'
import { formatAppDateTime } from '../../utils/dateFormat'

const props = defineProps({
  match: {
    type: Object,
    required: true,
  },
  actions: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['action'])

const ACTION_LABELS = {
  VIEW_MATCH: 'View match',
  START_MATCH: 'Start match',
  RESUME_SCORING: 'Resume scoring',
  VIEW_LIVE_SCORE: 'View live score',
  OPEN_MATCH_CONTROL: 'Open match control',
  RESCHEDULE: 'Reschedule',
  CANCEL: 'Cancel',
}

function actionKey(action) {
  if (typeof action === 'string') return action.trim()
  return String(action?.key || action?.id || action?.type || '').trim()
}

function canonicalActionKey(action) {
  return actionKey(action).toUpperCase()
}

function actionLabel(action) {
  if (typeof action === 'object' && action?.label) return action.label
  return ACTION_LABELS[canonicalActionKey(action)] || actionKey(action)
}

function actionTone(action) {
  const key = canonicalActionKey(action)
  if (['START_MATCH', 'RESUME_SCORING'].includes(key)) return 'primary'
  if (key === 'CANCEL') return 'danger'
  return 'quiet'
}

function courtLabel(court) {
  if (!court) return ''
  if (typeof court === 'object') return court.name || court.label || court.id || ''
  return String(court)
}

const playerOneName = computed(
  () => props.match.player1Name || props.match.challengerName || 'Player 1',
)
const playerTwoName = computed(
  () => props.match.player2Name || props.match.defenderName || 'Player 2',
)
const matchTypeLabel = computed(() => {
  if (props.match.type === 'ladder') return 'Ladder match'
  if (props.match.type === 'tournament') return 'Tournament match'
  return 'Match'
})
const statusText = computed(() => props.match.statusLabel || props.match.status || '')
const scheduledLabel = computed(() =>
  props.match.scheduledAt ? formatAppDateTime(props.match.scheduledAt) : '',
)
const court = computed(() => courtLabel(props.match.court))
const normalizedActions = computed(() =>
  props.actions
    .map((action, index) => ({
      source: action,
      key: actionKey(action),
      label: actionLabel(action),
      tone: actionTone(action),
      index,
    }))
    .filter((action) => action.key),
)

function selectAction(action) {
  emit('action', {
    action: action.source,
    match: props.match,
  })
}
</script>

<template>
  <article class="play-match-row">
    <div class="play-match-row__main">
      <small v-if="statusText" class="play-match-row__status">{{ statusText }}</small>
      <strong class="play-match-row__players">{{ playerOneName }} <span>vs</span> {{ playerTwoName }}</strong>

      <div class="play-match-row__meta">
        <span>{{ matchTypeLabel }}</span>
        <span v-if="scheduledLabel">{{ scheduledLabel }}</span>
        <span v-if="court">{{ court }}</span>
      </div>
    </div>

    <div v-if="normalizedActions.length" class="play-match-row__actions">
      <button
        v-for="action in normalizedActions"
        :key="`${action.key}-${action.index}`"
        class="play-match-row__action"
        :class="`play-match-row__action--${action.tone}`"
        type="button"
        @click="selectAction(action)"
      >
        {{ action.label }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.play-match-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 18px;
  border: 1px solid var(--color-border, #e3e8e4);
  border-radius: 10px;
  background: #fff;
}

.play-match-row__main {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.play-match-row__status {
  color: var(--color-muted, #738078);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.play-match-row__players {
  overflow: hidden;
  color: #344039;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.play-match-row__players span {
  color: #909a93;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.play-match-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  color: var(--color-muted, #738078);
  font-size: 11px;
}

.play-match-row__meta span + span::before {
  margin-right: 12px;
  color: #c0c8c2;
  content: '·';
}

.play-match-row__actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.play-match-row__action {
  min-height: 32px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: #58645d;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.play-match-row__action--primary {
  border-color: var(--color-primary, #167548);
  background: var(--color-primary, #167548);
  color: #fff;
}

.play-match-row__action--quiet {
  border-color: #dce3de;
  background: #fff;
}

.play-match-row__action--danger {
  color: #a0443c;
}

.play-match-row__action:hover:not(:disabled) {
  filter: brightness(0.97);
}

.play-match-row__action:focus-visible {
  outline: 2px solid var(--color-primary, #167548);
  outline-offset: 2px;
}

@media (max-width: 680px) {
  .play-match-row {
    display: grid;
    gap: 14px;
    padding: 15px;
  }

  .play-match-row__players {
    white-space: normal;
  }

  .play-match-row__actions {
    justify-content: flex-start;
  }
}
</style>

