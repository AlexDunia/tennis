<script setup>
// IMPORTS
import { RouterLink } from 'vue-router'
import TennisScoreboard from '../components/TennisScoreboard.vue'
import { createScoreboard } from '../utils/tennisScoring'

// PROPS
// none

// EMITS
// none

// ROUTER / ROUTE
// none

// STORES
// none

// REACTIVE STATE
const heroStats = [
  { label: 'Bookings per week', value: '24' },
  { label: 'Court availability', value: '06:00 - 20:00' },
  { label: 'Members', value: '2,400' },
]
const featureBlocks = [
  {
    title: 'Single court control',
    detail: 'Always see the booked timeframe for the Port Harcourt court.',
  },
  { title: 'Partner finder', detail: 'Create open matches and invite colleagues by skill level.' },
  {
    title: 'Live pro scoreboard',
    detail: 'Track each rally with professional rules that know deuce, advantage, and tie-breaks.',
  },
]
const landingScoreboard = createScoreboard('Shell Signal', 'Harbor Academy')

// COMPUTED PROPERTIES
// none

// METHODS
function handlePlaceholderPoint() {
  // scoreboard preview is static
}

// WATCHERS
// none

// LIFECYCLE HOOKS
// none
</script>

<template>
  <section class="landing">
    <div class="landing__grid">
      <div class="landing__content">
        <p class="landing__eyebrow">ShellTennis · Port Harcourt</p>
        <h1 class="landing__title">
          Book the single fixed court, connect with teammates, and stream live scoring.
        </h1>
        <p class="landing__lead">
          One court, one community, one app tailored for Shell employees. Reserve slots, join
          friendly matches, and watch a professional scoreboard stay in sync with every rally.
        </p>
        <div class="landing__actions">
          <RouterLink class="landing__cta" to="/login">Access the court</RouterLink>
          <RouterLink class="landing__secondary" to="/matches">Browse matches</RouterLink>
        </div>
        <div class="landing__stats">
          <div class="landing__stat" v-for="stat in heroStats" :key="stat.label">
            <p class="landing__stat-value">{{ stat.value }}</p>
            <p class="landing__stat-label">{{ stat.label }}</p>
          </div>
        </div>
      </div>
      <div class="landing__scoreboard">
        <TennisScoreboard :scoreboard="landingScoreboard" @point="handlePlaceholderPoint" />
      </div>
    </div>
    <div class="landing__features">
      <article class="landing__feature" v-for="feature in featureBlocks" :key="feature.title">
        <h3 class="landing__feature-title">{{ feature.title }}</h3>
        <p class="landing__feature-detail">{{ feature.detail }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.landing {
  padding: 2.5rem 1.5rem 3rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(236, 249, 255, 1) 100%);
}
.landing__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
}
.landing__content {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}
.landing__eyebrow {
  font-weight: 700;
  color: var(--color-primary);
  margin: 0;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.landing__title {
  margin: 0;
  font-size: clamp(2.4rem, 4vw, 3.6rem);
  line-height: 1.05;
  color: var(--color-text);
}
.landing__lead {
  margin: 0;
  color: var(--color-muted);
  max-width: 720px;
}
.landing__actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}
.landing__cta {
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: #ffffff;
  padding: 0.9rem 1.75rem;
  border-radius: 1rem;
  font-weight: 700;
  text-decoration: none;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.landing__cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
}
.landing__secondary {
  border-radius: 1rem;
  border: 2px solid var(--color-primary);
  padding: 0.9rem 1.75rem;
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 700;
}
.landing__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}
.landing__stat {
  background: linear-gradient(135deg, #ffffff, #eff6ff);
  color: var(--color-text);
  border-radius: 1.2rem;
  padding: 1rem 1.15rem;
  flex: 1;
  min-width: 140px;
  border: 1px solid rgba(15, 23, 42, 0.06);
}
.landing__stat-value {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--color-primary);
}
.landing__stat-label {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: var(--color-muted);
}
.landing__scoreboard {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
}
.landing__features {
  margin-top: 3rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
.landing__feature {
  background: var(--color-surface);
  border-radius: 1.4rem;
  padding: 1.5rem;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.05);
}
.landing__feature-title {
  margin: 0 0 0.5rem;
  color: var(--color-text);
}
.landing__feature-detail {
  margin: 0;
  color: var(--color-muted);
  line-height: 1.8;
}
</style>
