<template>
  <article class="cc" :class="`cc--${challenge.status}`">
    <!-- ── Top row: match summary + status pill ── -->
    <div class="cc__top">
      <div class="cc__summary">
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="#7b8794"
          stroke-width="1.6"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M3.5 8 Q5.5 5 8 8 Q10.5 11 12.5 8" stroke-linecap="round" />
        </svg>
        <span>{{ formatLabel }}</span>
        <span class="cc__summary-sep">·</span>
        <span class="cc__rank-line">
          #{{ challenge.challengerRank }}
          <svg
            width="11"
            height="11"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#00c853"
            stroke-width="2.2"
            style="margin: 0 2px"
          >
            <path d="M3 8h10M9 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          #{{ challenge.defenderRank }}
          <span v-if="rankGain > 0" class="cc__rank-gain">+{{ rankGain }} on win</span>
        </span>
      </div>
      <span class="cc__pill" :class="pillClass">{{ statusMeta.label }}</span>
    </div>

    <!-- ── Players ── -->
    <div class="cc__matchup">
      <div class="cc__player">
        <div class="cc__avatar cc__avatar--green">{{ challengerInitials }}</div>
        <div class="cc__player-info">
          <span class="cc__player-name">{{ props.challengerName }}</span>
          <span class="cc__player-meta">Challenger · Rank #{{ challenge.challengerRank }}</span>
        </div>
      </div>

      <div class="cc__vs">
        <span class="cc__vs-line"></span>
        <span class="cc__vs-text">VS</span>
        <span class="cc__vs-line"></span>
      </div>

      <div class="cc__player cc__player--right">
        <div class="cc__avatar cc__avatar--blue">{{ defenderInitials }}</div>
        <div class="cc__player-info">
          <span class="cc__player-name">{{ props.defenderName }}</span>
          <span class="cc__player-meta">Defender · Rank #{{ challenge.defenderRank }}</span>
        </div>
      </div>
    </div>

    <!-- ── Info strip: scorer, date, format details ── -->
    <div class="cc__info-strip">
      <!-- Scorer -->
      <div class="cc__info-item" :class="challenge.scorerName ? '' : 'cc__info-item--muted'">
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
        >
          <path d="M4 13V6M7 13V3M10 13V7M13 13V9" stroke-linecap="round" />
        </svg>
        <span v-if="challenge.scorerName">Scored by {{ challenge.scorerName }}</span>
        <span v-else>No scorer assigned</span>
      </div>

      <!-- Scheduled date (if any) -->
      <div v-if="challenge.scheduledAt" class="cc__info-item">
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
        >
          <rect x="2" y="3" width="12" height="11" rx="2" />
          <path d="M5 1v3M11 1v3M2 7h12" stroke-linecap="round" />
        </svg>
        <span>{{ formatDate(challenge.scheduledAt) }}</span>
      </div>

      <!-- Set format -->
      <div v-if="challenge.matchConfig" class="cc__info-item">
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M3.5 8 Q5.5 5 8 8 Q10.5 11 12.5 8" stroke-linecap="round" />
        </svg>
        <span>{{ setFormatLabel }}</span>
      </div>

      <!-- Final set rule (only if non-standard) -->
      <div
        v-if="challenge.matchConfig?.finalSetRule === 'super_tiebreak'"
        class="cc__info-item cc__info-item--accent"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
        >
          <path d="M8 2l1.8 3.6L14 6.5l-3 2.9.7 4.1L8 11.4l-3.7 2.1.7-4.1-3-2.9 4.2-.9z" />
        </svg>
        <span>Super tiebreak final set</span>
      </div>
    </div>

    <!-- ── Note (if any) ── -->
    <div v-if="challenge.note" class="cc__note">
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke="#7b8794"
        stroke-width="1.6"
        style="flex-shrink: 0; margin-top: 1px"
      >
        <path d="M2 4h12M2 8h8M2 12h5" stroke-linecap="round" />
      </svg>
      <span>{{ challenge.note }}</span>
    </div>

    <!-- ── Footer: timestamp + actions ── -->
    <div class="cc__footer">
      <span class="cc__meta">
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="#a8b3bc"
          stroke-width="1.6"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5v3.5l2 1.5" stroke-linecap="round" />
        </svg>
        {{ timeAgo(challenge.createdAt) }}
      </span>

      <div class="cc__actions">
        <button
          v-if="showDecline"
          class="cc-btn cc-btn--danger"
          type="button"
          @click="$emit('decline', challenge.id)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
          </svg>
          Decline
        </button>
        <button
          v-if="showAccept"
          class="cc-btn cc-btn--primary"
          type="button"
          @click="$emit('accept', challenge.id)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 8l4 4 6-7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Accept
        </button>
        <button
          v-if="showReview"
          class="cc-btn cc-btn--primary"
          type="button"
          @click="$emit('review', challenge.id)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M8 2l1.8 3.6L14 6.5l-3 2.9.7 4.1L8 11.4l-3.7 2.1.7-4.1-3-2.9 4.2-.9z" />
          </svg>
          Confirm Result
        </button>
        <button
          v-if="showDetails"
          class="cc-btn cc-btn--ghost"
          type="button"
          @click="$emit('details', challenge.id)"
        >
          View details
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  challenge: { type: Object, required: true },
  challengerName: { type: String, default: '' },
  defenderName: { type: String, default: '' },
  challengerImage: { type: String, default: '' },
  defenderImage: { type: String, default: '' },
  showAccept: { type: Boolean, default: false },
  showDecline: { type: Boolean, default: false },
  showReview: { type: Boolean, default: false },
  showDetails: { type: Boolean, default: true },
})

defineEmits(['accept', 'decline', 'review', 'details'])

// ── Helpers ──
const getInitials = (name) => {
  const parts = (name ?? '').trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name ?? '').slice(0, 2).toUpperCase()
}

const formatDate = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

const timeAgo = (iso) => {
  if (!iso) return 'Sent recently'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'Yesterday'
  return `${d} days ago`
}

// ── Computed ──
const challengerInitials = computed(() => getInitials(props.challengerName))
const defenderInitials = computed(() => getInitials(props.defenderName))

const rankGain = computed(() => {
  const cr = props.challenge.challengerRank
  const dr = props.challenge.defenderRank
  return cr && dr ? cr - dr : 0
})

// Match type + format label e.g. "Singles · Best of 3"
const formatLabel = computed(() => {
  const cfg = props.challenge.matchConfig
  if (!cfg) return 'Singles'
  const type = cfg.matchType === 'doubles' ? 'Doubles' : 'Singles'
  const fmt =
    cfg.matchFormat === 'best_of_5'
      ? 'Best of 5'
      : cfg.matchFormat === 'best_of_3'
        ? 'Best of 3'
        : (cfg.matchFormat ?? 'Best of 3')
  return `${type} · ${fmt}`
})

// Set tiebreak rule label
const setFormatLabel = computed(() => {
  const cfg = props.challenge.matchConfig
  if (!cfg) return ''
  const deuce = cfg.gameScoringRule === 'sudden_death' ? 'Sudden death' : 'Advantage'
  const tb = cfg.setWinRule === 'no_tiebreak' ? 'No tiebreak' : 'Tiebreak at 6–6'
  return `${tb} · ${deuce}`
})

const statusMeta = computed(() => {
  const map = {
    awaiting: { label: 'Awaiting response' },
    scheduled: { label: 'Scheduled' },
    pending_review: { label: 'Pending review' },
    completed: { label: 'Completed' },
  }
  return map[props.challenge.status] ?? { label: props.challenge.status }
})

const pillClass = computed(() => ({
  'cc__pill--amber': props.challenge.status === 'awaiting',
  'cc__pill--green': props.challenge.status === 'scheduled',
  'cc__pill--blue': props.challenge.status === 'pending_review',
  'cc__pill--gray': props.challenge.status === 'completed',
}))
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');

/* ── CARD SHELL ── */
.cc {
  background: #fff;
  border-radius: 18px;
  padding: 22px 24px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  font-family: 'Poppins', sans-serif;
  color: #0f1720;
  display: flex;
  flex-direction: column;
  gap: 18px;
  transition:
    transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.22s ease;
  animation: ccIn 0.32s ease both;
}

@keyframes ccIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cc:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.08);
}

/* ── TOP ROW ── */
.cc__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cc__summary {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #7b8794;
  flex-wrap: wrap;
}

.cc__summary-sep {
  opacity: 0.4;
}

.cc__rank-line {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #0f1720;
  font-weight: 500;
}

.cc__rank-gain {
  font-size: 11px;
  font-weight: 600;
  color: #007a32;
  background: rgba(0, 200, 83, 0.1);
  padding: 1px 7px;
  border-radius: 20px;
  margin-left: 4px;
}

/* ── STATUS PILL ── */
.cc__pill {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  letter-spacing: 0.2px;
  white-space: nowrap;
  flex-shrink: 0;
}

.cc__pill--amber {
  background: #fff8e6;
  color: #9a6700;
}
.cc__pill--green {
  background: rgba(0, 200, 83, 0.1);
  color: #007a32;
}
.cc__pill--blue {
  background: #f0eeff;
  color: #4b3ab0;
}
.cc__pill--gray {
  background: #f3f5f7;
  color: #7b8794;
}

/* ── MATCHUP ── */
.cc__matchup {
  display: flex;
  align-items: center;
  gap: 16px;
}

.cc__player {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.cc__player--right {
  flex-direction: row-reverse;
  text-align: right;
}

.cc__player--right .cc__player-info {
  align-items: flex-end;
}

.cc__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.cc__avatar--green {
  background: rgba(0, 200, 83, 0.1);
  color: #007a32;
}
.cc__avatar--blue {
  background: #e8f0fe;
  color: #1a56c4;
}

.cc__player-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cc__player-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f1720;
  line-height: 1.2;
}

.cc__player-meta {
  font-size: 11.5px;
  color: #7b8794;
}

/* ── VS ── */
.cc__vs {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.cc__vs-text {
  font-size: 10px;
  font-weight: 700;
  color: #a8b3bc;
  letter-spacing: 0.1em;
}

.cc__vs-line {
  width: 1px;
  height: 16px;
  background: rgba(0, 0, 0, 0.07);
}

/* ── INFO STRIP ── */
.cc__info-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  padding: 14px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.cc__info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #4b5563;
  font-weight: 500;
}

.cc__info-item svg {
  flex-shrink: 0;
  stroke: #7b8794;
}

.cc__info-item--muted {
  color: #a8b3bc;
}
.cc__info-item--muted svg {
  stroke: #a8b3bc;
}

.cc__info-item--accent {
  color: #007a32;
}
.cc__info-item--accent svg {
  stroke: #007a32;
}

/* ── NOTE ── */
.cc__note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 12.5px;
  color: #7b8794;
  font-style: italic;
  line-height: 1.5;
}

/* ── FOOTER ── */
.cc__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.cc__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #a8b3bc;
}

.cc__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ── BUTTONS ── */
.cc-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Poppins', sans-serif;
  cursor: pointer;
  border: none;
  transition:
    transform 0.15s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.15s ease,
    background 0.15s ease;
}

.cc-btn:active {
  transform: scale(0.97);
}

.cc-btn--primary {
  background: linear-gradient(135deg, #00c853, #00a844);
  color: #fff;
  box-shadow: 0 4px 14px rgba(0, 200, 83, 0.3);
}
.cc-btn--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 200, 83, 0.4);
}

.cc-btn--ghost {
  background: #f3f5f7;
  color: #0f1720;
}
.cc-btn--ghost:hover {
  background: #eaecef;
  transform: translateY(-1px);
}

.cc-btn--danger {
  background: rgba(239, 68, 68, 0.08);
  color: #c0392b;
  border: 1px solid rgba(239, 68, 68, 0.15);
}
.cc-btn--danger:hover {
  background: rgba(239, 68, 68, 0.14);
  transform: translateY(-1px);
}

/* ── RESPONSIVE ── */
@media (max-width: 640px) {
  .cc__matchup {
    gap: 10px;
  }
  .cc__player-name {
    font-size: 13px;
  }
  .cc__actions {
    width: 100%;
  }
  .cc-btn {
    flex: 1;
    justify-content: center;
  }
  .cc__player--right {
    flex-direction: row;
    text-align: left;
  }
  .cc__player--right .cc__player-info {
    align-items: flex-start;
  }
}
</style>
