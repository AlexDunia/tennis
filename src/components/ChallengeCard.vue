<template>
  <div class="card" :class="`card--${challenge.status}`">
    <!-- Top: rank line + status pill -->
    <div class="card-top">
      <div class="card-rank-line">
        <template v-if="challenge.challengerRank && challenge.defenderRank">
          Rank #{{ challenge.challengerRank }}
          <span class="arrow">→</span>
          #{{ challenge.defenderRank }} on win
        </template>
        <template v-else> Challenge </template>
      </div>
      <span class="pill" :class="pillClass">{{ statusMeta.label }}</span>
    </div>

    <!-- Matchup -->
    <div class="matchup">
      <div class="player">
        <div class="p-avatar" :class="challengerAvatarClass">
          {{ challengerInitials }}
        </div>
        <div>
          <div class="p-name">{{ props.challengerName }}</div>
          <div class="p-rank">Rank #{{ challenge.challengerRank }} · Challenger</div>
        </div>
      </div>
      <span class="vs">vs</span>
      <div class="player">
        <div class="p-avatar" :class="defenderAvatarClass">
          {{ defenderInitials }}
        </div>
        <div>
          <div class="p-name">{{ props.defenderName }}</div>
          <div class="p-rank">Rank #{{ challenge.defenderRank }} · Defender</div>
        </div>
      </div>
    </div>

    <!-- Badges -->
    <div class="badges">
      <span v-if="challenge.scheduledAt" class="badge badge-green">
        📅 {{ formatDate(challenge.scheduledAt) }}
      </span>
      <span v-if="challenge.scorerName" class="badge"> 📋 Scorer: {{ challenge.scorerName }} </span>
      <span v-if="challenge.note" class="badge"> 💬 {{ challenge.note }} </span>
    </div>

    <!-- Footer: meta + actions -->
    <div class="card-footer">
      <span class="meta">
        {{ challenge.createdAt ? formatDate(challenge.createdAt) : '' }}
      </span>
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

const avatarColors = ['av-g', 'av-b', 'av-p', 'av-a']
const challengerAvatarClass = computed(() => avatarColors[0])
const defenderAvatarClass = computed(() => avatarColors[1])

const statusMeta = computed(() => {
  const map = {
    awaiting: { label: 'Awaiting response' },
    scheduled: { label: 'Scheduled' },
    pending_review: { label: 'Pending Review' },
    completed: { label: 'Completed' },
  }
  return (
    map[props.challenge.status] || { label: props.challenge.statusLabel || props.challenge.status }
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
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');

/* ── CARD ── */
.card {
  background: #fff;
  border-radius: 18px;
  padding: 22px 24px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  font-family: 'Poppins', sans-serif;
  color: #0f1720;
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

/* ── CARD TOP ── */
.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.card-rank-line {
  font-size: 12px;
  color: #7b8794;
  display: flex;
  align-items: center;
  gap: 5px;
}

.arrow {
  color: #00c853;
  font-weight: 600;
}

/* ── STATUS PILLS ── */
.pill {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 11px;
  border-radius: 20px;
  letter-spacing: 0.2px;
  white-space: nowrap;
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

/* ── MATCHUP ── */
.matchup {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.player {
  display: flex;
  align-items: center;
  gap: 10px;
}

.p-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  font-family: 'Poppins', sans-serif;
}

.av-g {
  background: rgba(0, 200, 83, 0.1);
  color: #007a32;
}
.av-b {
  background: #e8f0fe;
  color: #1a56c4;
}
.av-p {
  background: #f0eeff;
  color: #4b3ab0;
}
.av-a {
  background: #fff3dc;
  color: #9a6700;
}

.p-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f1720;
}

.p-rank {
  font-size: 11.5px;
  color: #7b8794;
  margin-top: 1px;
}

.vs {
  font-size: 11px;
  font-weight: 600;
  color: #a8b3bc;
  flex-shrink: 0;
  padding: 0 2px;
}

/* ── BADGES ── */
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 18px;
  min-height: 0;
}

.badge {
  font-size: 11.5px;
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: 500;
  background: #f3f5f7;
  color: #7b8794;
  font-family: 'Poppins', sans-serif;
}

.badge-green {
  background: rgba(0, 200, 83, 0.09);
  color: #007a32;
}

/* ── CARD FOOTER ── */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  flex-wrap: wrap;
  gap: 10px;
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

/* ── BUTTONS ── */
.btn {
  padding: 9px 18px;
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

/* ── RESPONSIVE ── */
@media (max-width: 640px) {
  .matchup {
    gap: 8px;
  }
  .p-name {
    font-size: 13px;
  }
  .actions {
    width: 100%;
  }
  .btn {
    flex: 1;
    justify-content: center;
  }
}
</style>
