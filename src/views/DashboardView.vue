<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useBookingStore } from '../stores/booking'
import PerformanceChart from '@/components/charts/PerformanceChart.vue'

const router = useRouter()

const playerStore = usePlayerStore()
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()
const bookingStore = useBookingStore()

const currentPlayer = computed(() => playerStore.currentPlayer)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
})

const firstName = computed(() => {
  const name = currentPlayer.value?.name || ''
  return name.split(' ')[0]
})

const matchesPlayed = computed(() => {
  if (currentPlayer.value) {
    return (currentPlayer.value.wins || 0) + (currentPlayer.value.losses || 0)
  }
  return matchStore.matches.length
})

const winRate = computed(() => {
  const total = (currentPlayer.value?.wins || 0) + (currentPlayer.value?.losses || 0)
  return total ? Math.round((currentPlayer.value.wins / total) * 100) : 0
})

const winStreak = computed(() => {
  const playerMatches = [...matchStore.matches].reverse()
  let streak = 0
  for (const m of playerMatches) {
    if (m.winnerId === playerStore.currentPlayerId) streak++
    else break
  }
  return streak
})

const performanceNote = computed(() => {
  if (winRate.value >= 70)
    return `You're on fire 🔥 — top ${100 - winRate.value}% of players this month.`
  if (winRate.value >= 50) return `Solid form. One more push and you crack the top 10.`
  return `Every loss is data. Your comeback arc starts here.`
})

const upcomingMatches = computed(() => matchStore.scheduledMatches.length)
const challengeSummary = computed(() => challengeStore.summaryCounts)

const urgentActions = computed(() => [
  { label: 'Pending challenges', value: challengeSummary.value.awaiting },
  { label: 'Matches to play', value: upcomingMatches.value },
  { label: 'Awaiting review', value: challengeSummary.value.pendingReview },
])

const activityFeed = computed(() => {
  const matches = matchStore.matches.map((m) => ({
    title: `${m.challengerName} vs ${m.defenderName}`,
    meta: m.statusLabel,
    id: m.id,
    type: 'match',
  }))
  const challenges = challengeStore.challenges.map((c) => ({
    title: `${c.challengerName} vs ${c.defenderName}`,
    meta: c.statusLabel,
    id: c.id,
    type: 'challenge',
  }))
  return [...matches, ...challenges].slice(0, 6)
})

const openMatch = (id) => router.push({ name: 'MatchDetails', params: { matchId: id } })
const openCreate = () => router.push({ name: 'CreateChallenge' })

onMounted(async () => {
  await Promise.all([
    playerStore.loadPlayers(),
    challengeStore.loadChallenges(),
    matchStore.loadMatches(),
    bookingStore.loadBookings(),
  ])
})
</script>

<template>
  <section class="dashboard">
    <!-- ── HERO SECTION ─────────────────────────────────
         No section label here — the greeting IS the header.
         World-class pattern: hero speaks for itself.
    ──────────────────────────────────────────────────── -->
    <section class="hero">
      <div class="hero-scrim"></div>
      <div class="hero-top">
        <div class="hero-copy">
          <!-- <p class="hero__eyebrow">{{ greeting }}, {{ currentPlayer?.name }} 👋</p> -->
          <h1 class="hero__title">{{ greeting }}, {{ firstName }} 👋</h1>
          <p class="hero__subtitle">
            You are Ranked <strong class="rank-badge">#{{ currentPlayer?.rank }}</strong>
          </p>
          <div class="hero__stats" v-if="winStreak > 1">
            <div class="stat-pill">
              <span>Streak</span>
              <strong class="streak">{{ winStreak }} wins 🔥</strong>
            </div>
          </div>
        </div>

        <button class="cta" @click="openCreate">
          <span class="cta-icon">⚡</span> Start Challenge
        </button>
      </div>

      <!-- slight breathing room above the glass row -->
      <div class="kpi inside">
        <div class="card glass">
          <span class="kpi-label">Matches</span>
          <strong class="kpi-number">{{ matchesPlayed }}</strong>
          <span class="kpi-trend">+2 this week</span>
        </div>

        <div class="card glass">
          <span class="kpi-label">Wins</span>
          <strong class="kpi-number">{{ currentPlayer?.wins }}</strong>
        </div>

        <div class="card glass">
          <span class="kpi-label">Losses</span>
          <strong class="kpi-number">{{ currentPlayer?.losses }}</strong>
        </div>

        <div class="card glass">
          <span class="kpi-label">Win Rate</span>
          <strong class="kpi-number">{{ winRate }}%</strong>
        </div>
      </div>
    </section>

    <!-- ── OVERVIEW SECTION ────────────────────────────
         Section label added: groups Action Required +
         Performance chart under one named category.
    ──────────────────────────────────────────────────── -->
    <div class="section-group">
      <div class="section-group__header">
        <span class="section-group__label">Overview</span>
      </div>

      <section class="grid">
        <section class="card">
          <h3 class="section-title">Action Required</h3>
          <div class="divider"></div>

          <div class="action-row" v-for="item in urgentActions" :key="item.label">
            <span class="action-left">
              <span :class="['dot', item.value ? 'dot-danger' : 'dot-muted']"></span>
              {{ item.label }}
            </span>
            <strong :class="item.value ? 'val-danger' : 'val-muted'">{{ item.value }}</strong>
          </div>

          <div class="action-footer">
            <span
              >{{ challengeSummary.awaiting + challengeSummary.pendingReview }} items need your
              attention</span
            >
          </div>
        </section>

        <section class="card">
          <PerformanceChart
            :matches="matchStore.matches"
            :currentPlayerId="playerStore.currentPlayerId"
          />
          <div class="insights">
            <span>📊 {{ matchStore.matches.length }} total matches</span>
            <span>🗓 {{ upcomingMatches }} upcoming</span>
          </div>
        </section>
      </section>
    </div>

    <!-- ── ACTIVITY SECTION ────────────────────────────
         Card already has its own title — no outer label needed.
         This pattern is standard (Stripe, Linear, Vercel).
    ──────────────────────────────────────────────────── -->
    <section class="card">
      <div class="activity-header">
        <h3 class="section-title">Recent Activity</h3>
        <span class="activity-count">{{ activityFeed.length }} events</span>
      </div>
      <div class="divider"></div>

      <div class="activity">
        <div
          v-for="item in activityFeed"
          :key="item.id"
          class="activity-item"
          @click="openMatch(item.id)"
        >
          <span class="activity-icon">{{ item.type === 'match' ? '🎾' : '⚔️' }}</span>
          <div class="activity-text">
            <strong>{{ item.title }}</strong>
            <span class="muted">{{ item.meta }}</span>
          </div>
          <span class="activity-arrow">›</span>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

/*
  TYPE SCALE — all Poppins
  ─────────────────────────────────────────────────────
  Hero title            800  #fff                  full
  Section title h3      600  #111827               full
  Body / row label      500  #374151               87%
  Supporting / sub      500  #6b7280               55%
  Meta / ghost          400  #9ca3af               38%
  Eyebrow caps (hero)   600  rgba(255,255,255,.72)
  ─────────────────────────────────────────────────────
*/

* {
  font-family: 'Poppins', sans-serif;
}

.dashboard {
  display: grid;
  gap: 28px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 8px 0 40px;
}

/* ─── HERO ──────────────────────────────────────────── */
.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20px;
  /* tiny breathing pad top+bottom on the image card */
  padding: 10px 28px 10px;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18);
  color: #fff;
}

/* background image layer */
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('https://res.cloudinary.com/dnuhjsckk/image/upload/v1777007467/tennis-court-render-3d-illustration-_2_do7vjj.jpg');
  background-size: cover;
  background-position: center;
  filter: brightness(0.75);
  z-index: 0;
}

/* green brand gradient overlay at ~4% opacity */
.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0, 184, 74, 0.04) 0%, rgba(76, 217, 100, 0.04) 100%);
  z-index: 0;
}

/* dark scrim for text readability — sits on top of green overlay */
.hero .hero-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.45) 0%,
    rgba(0, 0, 0, 0.15) 60%,
    rgba(0, 0, 0, 0.05) 100%
  );
  z-index: 0;
}

.hero * {
  position: relative;
  z-index: 1;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  /* give text content its own comfortable padding */
  padding-top: 35px;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* Eyebrow — supporting, clearly secondary */
.hero__eyebrow {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
  margin: 0 0 2px;
}

/* Title — primary, strongest element on page */
.hero__title {
  font-size: 30px;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.15;
  letter-spacing: -0.02em;
  margin: 0;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.6);
}

/* Subtitle — mid-tier, one step below title */
.hero__subtitle {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
  margin: 2px 0 0;
  line-height: 1.5;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.55);
}

.rank-badge {
  color: #4ade80;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
}

.hero__stats {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.stat-pill {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.13);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 10px;
  padding: 7px 13px;
  min-width: 72px;
}

.stat-pill span {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.58);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.stat-pill strong {
  font-size: 13.5px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
  margin-top: 1px;
}

.streak {
  color: #fde68a !important;
}

/* ─── CTA — green brand gradient ───────────────────── */
.cta {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 44px;
  padding: 0 20px;
  border-radius: 12px;
  /* same brand greens as requested */
  background: #00c853;
  color: #fff;
  border: none;
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.01em;
  /* box-shadow:
    0 8px 20px rgba(0, 184, 74, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.18); */
  transition: all 0.22s ease;
  cursor: pointer;
  white-space: nowrap;
  /* align with hero-top top */
  margin-top: 18px;
}

.cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(0, 184, 74, 0.42);
}

.cta-icon {
  font-size: 13px;
}

/* ─── KPI GLASS ROW ─────────────────────────────────
   margin-top adds the breathing room above the 4 cards
──────────────────────────────────────────────────── */
.kpi.inside {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 8px; /* breathing space between hero text and glass cards */
  padding-bottom: 18px; /* tiny bottom breathing pad inside the image */
}

/* Glass cards — more transparent, tighter height */
.card.glass {
  /* brand green tint at ~4% opacity instead of plain white */
  background: rgba(0, 184, 74, 0.04);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(2.5px);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 12px;
  padding: 8px 14px 10px; /* asymmetric: less top, slightly more bottom */
  display: flex;
  flex-direction: column;
  gap: 1px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

/* KPI label — ghost, lowest tier */
.kpi-label {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.65);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

/* KPI number — all white, bold */
.kpi-number {
  font-size: 22px;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.2;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}

/* KPI trend — faintest */
.kpi-trend {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.52);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  margin-top: 1px;
}

/* ─── NORMAL CARDS ──────────────────────────────────── */
.card {
  background: #ffffff;
  padding: 22px;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
}

/* ─── SECTION GROUP (Overview label row) ───────────────
   Lightweight label + divider that categorises the
   Action Required + Performance grid beneath it.
   Pattern used by Linear, Vercel, Stripe dashboards.
──────────────────────────────────────────────────── */
.section-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-group__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-group__label {
  margin-top: 27px;
  margin-bottom: 20px;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #b8b1b1;
}

.section-group__header::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(0, 0, 0, 0.07);
}

/* ─── GRID ──────────────────────────────────────────── */
.grid {
  display: grid;
  grid-template-columns: 0.85fr 1.5fr;
  gap: 24px;
}

/* ─── SECTION TITLES (inside white cards) ───────────── */
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  letter-spacing: -0.01em;
  margin: 0;
}

.divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 12px 0 16px;
}

/* ─── ACTION ROWS ───────────────────────────────────── */
.action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.action-row:last-of-type {
  border-bottom: none;
}

.action-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-danger {
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}
.dot-muted {
  background: #d1d5db;
}

.val-danger {
  color: #ef4444;
  font-size: 15px;
  font-weight: 700;
}
.val-muted {
  color: #9ca3af;
  font-size: 15px;
  font-weight: 600;
}

.action-footer {
  margin-top: 14px;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 10px;
  font-size: 11.5px;
  font-weight: 500;
  color: #9ca3af;
  text-align: center;
}

/* ─── INSIGHTS ──────────────────────────────────────── */
.insights {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  font-weight: 500;
  color: #9ca3af;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

/* ─── ACTIVITY ──────────────────────────────────────── */
.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.activity-count {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 3px 10px;
  border-radius: 99px;
}

.activity {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.activity-item:hover {
  background: #f9fafb;
  transform: translateX(2px);
}

.activity-icon {
  font-size: 17px;
  flex-shrink: 0;
}

.activity-text {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.activity-text strong {
  font-size: 13.5px;
  font-weight: 600;
  color: #111827;
  letter-spacing: -0.01em;
}

.muted {
  font-size: 11.5px;
  font-weight: 400;
  color: #9ca3af;
  margin-top: 2px;
}

.activity-arrow {
  color: #d1d5db;
  font-size: 20px;
  font-weight: 300;
  transition: color 0.18s ease;
}

.activity-item:hover .activity-arrow {
  color: #6b7280;
}

/* ─── RESPONSIVE ────────────────────────────────────── */
@media (max-width: 768px) {
  .kpi.inside {
    grid-template-columns: repeat(2, 1fr);
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .hero-top {
    flex-direction: column;
  }
  .hero__title {
    font-size: 24px;
  }
  .cta {
    margin-top: 0;
  }
}
</style>
