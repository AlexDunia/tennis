<template>
  <div class="card" :class="`card--${challenge.status}`">
    <!-- Status pill + match summary -->
    <div class="card-top">
      <span class="card-summary">
        Singles · #{{ challenge.challengerRank }} vs #{{ challenge.defenderRank }}
        <span class="arrow">→</span> {{ rankChangeLabel }}
      </span>
      <span class="pill" :class="pillClass">{{ statusMeta.label }}</span>
    </div>

    <!-- Who's playing -->
    <div class="matchup">
      <div class="player">
        <div class="p-avatar av-g">{{ challengerInitials }}</div>
        <div>
          <div class="p-name">{{ props.challengerName }}</div>
          <div class="p-role">Challenger · #{{ challenge.challengerRank }}</div>
        </div>
      </div>

      <div class="vs-divider">
        <span class="vs-line"></span>
        <span class="vs">🎾</span>
        <span class="vs-line"></span>
      </div>

      <div class="player">
        <div class="p-avatar av-b">{{ defenderInitials }}</div>
        <div>
          <div class="p-name">{{ props.defenderName }}</div>
          <div class="p-role">Defender · #{{ challenge.defenderRank }}</div>
        </div>
      </div>
    </div>

    <!-- Optional badges — only shown if data exists -->
    <div v-if="challenge.scheduledAt || challenge.note" class="badges">
      <span v-if="challenge.scheduledAt" class="badge badge-green">
        📅 {{ formatDate(challenge.scheduledAt) }}
      </span>
      <span v-if="challenge.note" class="badge"> 💬 {{ challenge.note }} </span>
    </div>

    <!-- Footer -->
    <div class="card-footer">
      <span class="meta">{{ challenge.createdAt ? formatDate(challenge.createdAt) : '' }}</span>
      <div class="actions">
        <button
          v-if="showDecline"
          class="btn btn-danger"
          type="button"
          @click="$emit('decline', challenge.id)"
        >
          Decline
        </button>
        <button
          v-if="showAccept"
          class="btn btn-primary"
          type="button"
          @click="$emit('accept', challenge.id)"
        >
          Accept
        </button>
        <button
          v-if="showReview"
          class="btn btn-primary"
          type="button"
          @click="$emit('review', challenge.id)"
        >
          🏆 Confirm Result
        </button>
        <button
          v-if="showDetails"
          class="btn btn-ghost"
          type="button"
          @click="$emit('details', challenge.id)"
        >
          View
        </button>
      </div>
    </div>
  </div>
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

const getInitials = (name) => {
  const parts = (name ?? '').trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name ?? '').slice(0, 2).toUpperCase()
}

const challengerInitials = computed(() => getInitials(props.challengerName))
const defenderInitials = computed(() => getInitials(props.defenderName))

const rankChangeLabel = computed(() => {
  const cr = props.challenge.challengerRank
  const dr = props.challenge.defenderRank
  if (!cr || !dr) return ''
  const diff = cr - dr
  return diff > 0 ? `+${diff} rank on win` : 'rank challenge'
})

const statusMeta = computed(() => {
  const map = {
    awaiting: { label: 'Awaiting response' },
    scheduled: { label: 'Scheduled' },
    pending_review: { label: 'Pending Review' },
    completed: { label: 'Completed' },
  }
  return (
    map[props.challenge.status] ?? { label: props.challenge.statusLabel ?? props.challenge.status }
  )
})

const pillClass = computed(() => ({
  'pill-await': props.challenge.status === 'awaiting',
  'pill-sched': props.challenge.status === 'scheduled',
  'pill-reply': props.challenge.status === 'pending_review',
  'pill-done': props.challenge.status === 'completed',
}))

const formatDate = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');

.card {
  background: #fff;
  border-radius: 18px;
  padding: 20px 22px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  font-family: 'Poppins', sans-serif;
  color: #0f1720;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition:
    transform 0.22s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.22s ease;
  animation: cardIn 0.32s ease both;
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.08);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.card-summary {
  font-size: 12px;
  color: #7b8794;
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.arrow {
  color: #00c853;
  font-weight: 600;
}

.pill {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 11px;
  border-radius: 20px;
  letter-spacing: 0.2px;
  white-space: nowrap;
  flex-shrink: 0;
}

.pill-await {
  background: #fff8e6;
  color: #9a6700;
}
.pill-sched {
  background: rgba(0, 200, 83, 0.1);
  color: #007a32;
}
.pill-reply {
  background: #f0eeff;
  color: #4b3ab0;
}
.pill-done {
  background: #f3f5f7;
  color: #7b8794;
}

.matchup {
  display: flex;
  align-items: center;
  gap: 16px;
}

.player {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.p-avatar {
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

.av-g {
  background: rgba(0, 200, 83, 0.1);
  color: #007a32;
}
.av-b {
  background: #e8f0fe;
  color: #1a56c4;
}

.p-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f1720;
  line-height: 1.2;
}

.p-role {
  font-size: 11.5px;
  color: #7b8794;
  margin-top: 2px;
}

.vs-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.vs {
  font-size: 16px;
  line-height: 1;
}

.vs-line {
  width: 1px;
  height: 14px;
  background: rgba(0, 0, 0, 0.08);
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.badge {
  font-size: 11.5px;
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: 500;
  background: #f3f5f7;
  color: #7b8794;
}

.badge-green {
  background: rgba(0, 200, 83, 0.09);
  color: #007a32;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  gap: 10px;
  flex-wrap: wrap;
}

.meta {
  font-size: 12px;
  color: #a8b3bc;
}

.actions {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Poppins', sans-serif;
  cursor: pointer;
  border: none;
  transition:
    transform 0.16s cubic-bezier(0.22, 0.61, 0.36, 1),
    box-shadow 0.16s ease,
    background 0.16s ease;
}

.btn:active {
  transform: scale(0.97);
}

.btn-primary {
  background: linear-gradient(135deg, #00c853, #00a844);
  color: #fff;
  box-shadow: 0 4px 14px rgba(0, 200, 83, 0.3);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 200, 83, 0.4);
}

.btn-ghost {
  background: #f3f5f7;
  color: #0f1720;
}
.btn-ghost:hover {
  background: #eaecef;
  transform: translateY(-1px);
}

.btn-danger {
  background: #fff2f2;
  color: #c0392b;
}
.btn-danger:hover {
  background: #ffe0e0;
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .matchup {
    gap: 10px;
  }
  .p-name {
    font-size: 13px;
  }
  .actions {
    width: 100%;
  }
  .btn {
    flex: 1;
    text-align: center;
  }
}
</style>
