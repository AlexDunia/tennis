<script setup>
import { computed, onMounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useChallengeStore } from '../stores/challenge'

const playerStore = usePlayerStore()
const challengeStore = useChallengeStore()

onMounted(async () => {
  await Promise.all([playerStore.loadPlayers(), challengeStore.loadChallenges()])
})

const player = computed(() => playerStore.currentPlayer)

const initials = computed(() => {
  if (!player.value?.name) return '??'
  const parts = player.value.name.trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : player.value.name.slice(0, 2).toUpperCase()
})

const winRate = computed(() => {
  if (!player.value) return '—'
  const total = player.value.wins + player.value.losses
  if (total === 0) return '—'
  return `${Math.round((player.value.wins / total) * 100)}%`
})

const totalChallenges = computed(() => challengeStore.challenges.length)

const completedChallenges = computed(
  () => challengeStore.challenges.filter((c) => c.status === 'completed').length,
)
</script>

<template>
  <div class="profile" v-if="player">
    <!-- Hero -->
    <div class="profile__hero">
      <div class="profile__avatar">{{ initials }}</div>
      <div class="profile__identity">
        <h1 class="profile__name">{{ player.name }}</h1>
        <span class="profile__rank-pill">Rank #{{ player.rank }}</span>
      </div>
    </div>

    <!-- Stats row -->
    <div class="profile__stats">
      <div class="profile__stat">
        <span class="profile__stat-value">{{ player.wins }}</span>
        <span class="profile__stat-label">Wins</span>
      </div>
      <div class="profile__stat">
        <span class="profile__stat-value">{{ player.losses }}</span>
        <span class="profile__stat-label">Losses</span>
      </div>
      <div class="profile__stat">
        <span class="profile__stat-value">{{ winRate }}</span>
        <span class="profile__stat-label">Win rate</span>
      </div>
      <div class="profile__stat">
        <span class="profile__stat-value">{{ player.matchesPlayed }}</span>
        <span class="profile__stat-label">Played</span>
      </div>
      <div class="profile__stat">
        <span class="profile__stat-value">{{ totalChallenges }}</span>
        <span class="profile__stat-label">Challenges</span>
      </div>
      <div class="profile__stat">
        <span class="profile__stat-value">{{ completedChallenges }}</span>
        <span class="profile__stat-label">Completed</span>
      </div>
    </div>

    <!-- Details card -->
    <div class="profile__card">
      <p class="profile__card-title">Ladder standing</p>

      <div class="profile__row">
        <div class="profile__row-icon">
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#7b8794"
            stroke-width="1.6"
          >
            <path d="M3 13V6M7 13V3M11 13V8" stroke-linecap="round" />
          </svg>
        </div>
        <div>
          <span class="profile__row-label">Current rank</span>
          <span class="profile__row-value">#{{ player.rank }}</span>
        </div>
      </div>

      <div class="profile__row">
        <div class="profile__row-icon">
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#7b8794"
            stroke-width="1.6"
          >
            <circle cx="8" cy="8" r="6" />
            <path d="M3.5 8 Q5.5 5 8 8 Q10.5 11 12.5 8" stroke-linecap="round" />
          </svg>
        </div>
        <div>
          <span class="profile__row-label">Matches played</span>
          <span class="profile__row-value">{{ player.matchesPlayed }}</span>
        </div>
      </div>

      <div class="profile__row">
        <div class="profile__row-icon">
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#7b8794"
            stroke-width="1.6"
          >
            <path d="M8 2l1.8 3.6L14 6.5l-3 2.9.7 4.1L8 11.4l-3.7 2.1.7-4.1-3-2.9 4.2-.9z" />
          </svg>
        </div>
        <div>
          <span class="profile__row-label">Win / Loss record</span>
          <span class="profile__row-value">{{ player.wins }}W – {{ player.losses }}L</span>
        </div>
      </div>

      <div class="profile__row">
        <div class="profile__row-icon">
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#7b8794"
            stroke-width="1.6"
          >
            <rect x="2" y="2" width="12" height="12" rx="2" />
            <path d="M5 8h6M8 5v6" stroke-linecap="round" />
          </svg>
        </div>
        <div>
          <span class="profile__row-label">Win rate</span>
          <span class="profile__row-value profile__row-value--green">{{ winRate }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Loading -->
  <div v-else class="profile__loading">
    <svg
      width="24"
      height="24"
      viewBox="0 0 16 16"
      fill="none"
      stroke="#a8b3bc"
      stroke-width="1.5"
      class="profile__spinner"
    >
      <circle cx="8" cy="8" r="6" stroke-dasharray="28" stroke-dashoffset="10" />
    </svg>
    <p>Loading profile…</p>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');

.profile {
  font-family: 'Poppins', sans-serif;
  color: #0f1720;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 680px;
}

/* ── HERO ── */
.profile__hero {
  display: flex;
  align-items: center;
  gap: 20px;
}

.profile__avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(0, 200, 83, 0.1);
  color: #007a32;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  flex-shrink: 0;
}

.profile__identity {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.profile__name {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.3px;
  margin: 0;
  color: #0f1720;
}

.profile__rank-pill {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: #007a32;
  background: rgba(0, 200, 83, 0.1);
  padding: 3px 10px;
  border-radius: 20px;
  align-self: flex-start;
}

/* ── STATS ROW ── */
.profile__stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.profile__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 12px;
  gap: 4px;
  position: relative;
}

.profile__stat:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 20%;
  height: 60%;
  width: 1px;
  background: rgba(0, 0, 0, 0.05);
}

.profile__stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #0f1720;
  letter-spacing: -0.3px;
}

.profile__stat-label {
  font-size: 11px;
  font-weight: 500;
  color: #a8b3bc;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

/* ── DETAIL CARD ── */
.profile__card {
  background: #fff;
  border-radius: 18px;
  padding: 22px 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0;
}

.profile__card-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #a8b3bc;
  margin: 0 0 16px;
}

.profile__row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 0;
}

.profile__row:not(:last-child) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.profile__row-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #f6f7f8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile__row-label {
  display: block;
  font-size: 11.5px;
  color: #7b8794;
  font-weight: 500;
  margin-bottom: 2px;
}

.profile__row-value {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #0f1720;
}

.profile__row-value--green {
  color: #007a32;
}

/* ── LOADING ── */
.profile__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 3rem;
  color: #7b8794;
  font-size: 13px;
  font-family: 'Poppins', sans-serif;
}

.profile__spinner {
  animation: profileSpin 1.2s linear infinite;
}

@keyframes profileSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ── RESPONSIVE ── */
@media (max-width: 640px) {
  .profile__stats {
    grid-template-columns: repeat(3, 1fr);
  }
  .profile__stat:nth-child(3)::after {
    display: none;
  }
}

@media (max-width: 400px) {
  .profile__stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .profile__stat:nth-child(2)::after {
    display: none;
  }
}
</style>
