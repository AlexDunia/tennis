<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { APP_CURRENT_PLAYER } from '../config/currentPlayer'
import { dashboardFixture } from '../data/dashboard'
import { usePlayerStore } from '../stores/player'

const router = useRouter()
const playerStore = usePlayerStore()
const dashboardRoot = ref(null)
const staticNotice = ref('')
const dashboard = dashboardFixture
const ladderRoute = Object.freeze({ name: 'Rankings' })
const actionIconNames = Object.freeze(['play', 'challenge', 'tournament'])
let revealObserver = null

const currentPlayerName = computed(() => playerStore.currentPlayer?.name || APP_CURRENT_PLAYER.name)
const currentPlayerFirstName = computed(
  () => currentPlayerName.value.trim().split(/\s+/)[0] || APP_CURRENT_PLAYER.firstName,
)
const currentLadder = computed(() => {
  const ladder = dashboard.ladders[0]
  if (!ladder) return null

  return {
    ...ladder,
    position: playerStore.currentPlayer?.rank ?? ladder.position,
    playerCount: playerStore.players.length || ladder.playerCount,
  }
})

function isActionIcon(action, index) {
  return action.icon === actionIconNames[index]
}

function isReviewItem(item) {
  return item.icon === 'review'
}

function eventDateLabel(item) {
  return item.month + ' ' + item.day
}

function openRoute(to) {
  if (to) router.push(to)
}

function handleAction(action) {
  if (action?.to) {
    openRoute(action.to)
    return
  }

  staticNotice.value = action?.unavailableMessage || 'This action is not connected yet.'
}

function openCalendar() {
  staticNotice.value = 'The club calendar is not connected yet.'
}

onMounted(() => {
  const panels = dashboardRoot.value?.querySelectorAll('.dashboard-panel') || []
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reducedMotion || !('IntersectionObserver' in window)) {
    panels.forEach((panel) => panel.classList.add('is-visible'))
    return
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        revealObserver?.unobserve(entry.target)
      })
    },
    { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
  )

  panels.forEach((panel, index) => {
    panel.style.transitionDelay = Math.min(index * 35, 140) + 'ms'
    revealObserver.observe(panel)
  })
})

onUnmounted(() => {
  revealObserver?.disconnect()
  revealObserver = null
})
</script>

<template>
  <main ref="dashboardRoot" class="dashboard-page">
    <div class="dashboard-stack">
      <section
        v-if="currentLadder"
        class="dashboard-panel dashboard-section"
        aria-labelledby="ladder-section-title"
      >
        <header class="section-intro">
          <h2 id="ladder-section-title">Welcome back, {{ currentPlayerFirstName }}.</h2>
        </header>

        <div class="ladder-card">
          <div class="ladder-header">
            <div class="ladder-heading-copy">
              <h3>You are on {{ currentLadder.name }} ladder.</h3>
              <p>In {{ dashboard.activeClub.name }}.</p>
            </div>

            <button class="open-ladder" type="button" @click="openRoute(ladderRoute)">
              <span>Open ladder</span>
              <span class="open-ladder-arrow" aria-hidden="true">→</span>
            </button>
          </div>

          <div class="ladder-divider" aria-hidden="true"></div>

          <p class="ladder-position">
            <span>Your ladder position is</span>
            <strong>#{{ currentLadder.position }}</strong>
            <span>of {{ currentLadder.playerCount }}.</span>
          </p>
        </div>
      </section>

      <section class="dashboard-panel dashboard-section" aria-labelledby="quick-title">
        <header class="section-intro">
          <h2 id="quick-title">Here are some quick actions for you</h2>
        </header>

        <div class="dashboard-card quick-panel">
          <div class="quick-grid">
            <button
              v-for="action in dashboard.quickActions"
              :key="action.id"
              class="quick-card"
              :class="action.icon"
              type="button"
              @click="handleAction(action)"
            >
              <span class="quick-icon" aria-hidden="true">
                <svg v-if="isActionIcon(action, 0)" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m10 8 6 4-6 4Z" />
                </svg>
                <svg v-else-if="isActionIcon(action, 1)" viewBox="0 0 24 24">
                  <ellipse cx="8" cy="7" rx="3" ry="4" transform="rotate(-35 8 7)" />
                  <ellipse cx="16" cy="7" rx="3" ry="4" transform="rotate(35 16 7)" />
                  <path d="m10 10 7 9M14 10l-7 9" />
                </svg>
                <svg v-else viewBox="0 0 24 24">
                  <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
                  <path d="M6 5H4v2a4 4 0 0 0 4 4M18 5h2v2a4 4 0 0 1-4 4M12 12v5M8 20h8" />
                </svg>
              </span>

              <span class="quick-copy">
                <strong>{{ action.title }}</strong>
                <small>{{ action.description }}</small>
              </span>

              <span class="quick-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
              </span>
            </button>
          </div>
        </div>
      </section>

      <section
        v-if="dashboard.attentionItems.length"
        class="dashboard-panel dashboard-section"
        aria-labelledby="attention-title"
      >
        <header class="section-intro">
          <h2 id="attention-title">This needs your attention</h2>
        </header>

        <div class="dashboard-card attention-panel">
          <div class="attention-list">
            <article v-for="item in dashboard.attentionItems" :key="item.id" class="attention-item">
              <span class="attention-icon" aria-hidden="true">
                <svg v-if="isReviewItem(item)" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m8 12 2.5 2.5L16.5 9" />
                </svg>
                <svg v-else viewBox="0 0 24 24">
                  <rect x="4" y="5" width="16" height="15" rx="2" />
                  <path d="M8 3v4M16 3v4M4 9h16" />
                </svg>
              </span>
              <div class="attention-copy">
                <strong>{{ item.title }}</strong>
                <p>{{ item.description }}</p>
              </div>
              <button type="button" @click="handleAction(item)">{{ item.actionLabel }}</button>
            </article>
          </div>
        </div>
      </section>

      <section class="dashboard-panel dashboard-section" aria-labelledby="upcoming-title">
        <header class="section-intro section-intro--split">
          <div>
            <h2 id="upcoming-title">Upcoming events for {{ dashboard.activeClub.name }}</h2>
          </div>

          <button class="calendar-link" type="button" @click="openCalendar">
            Open calendar
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </header>

        <div class="dashboard-card upcoming-panel">
          <div class="upcoming-grid">
            <article v-for="item in dashboard.upcomingItems" :key="item.id" class="upcoming-item">
              <time class="calendar-date" :aria-label="eventDateLabel(item)">
                <span>{{ item.month }}</span>
                <strong>{{ item.day }}</strong>
                <small>{{ item.weekday }}</small>
              </time>
              <div class="upcoming-copy">
                <h3>{{ item.title }}</h3>
                <p>{{ item.description }}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="dashboard-panel dashboard-section" aria-labelledby="glance-title">
        <header class="section-intro">
          <h2 id="glance-title">{{ dashboard.activeClub.name }} right now</h2>
        </header>

        <div class="dashboard-card glance-panel">
          <div class="glance-grid">
            <article class="glance-item">
              <span class="glance-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="9" cy="8" r="3" />
                  <circle cx="17" cy="9" r="2.5" />
                  <path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 15a4.5 4.5 0 0 1 6.5 4" />
                </svg>
              </span>
              <div>
                <strong>{{ dashboard.clubSummary.members }}</strong>
                <span>Members</span>
                <small class="positive">{{ dashboard.clubSummary.newMembersLabel }}</small>
              </div>
            </article>

            <article class="glance-item">
              <span class="glance-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M5.5 6.5c3 2 4 4.5 4.5 7.5M18.5 17.5c-3-2-4-4.5-4.5-7.5" />
                </svg>
              </span>
              <div>
                <strong>{{ dashboard.clubSummary.liveMatches }}</strong>
                <span>Matches live now</span>
                <small>{{ dashboard.clubSummary.liveMatchesLabel }}</small>
              </div>
            </article>

            <article class="glance-item">
              <span class="glance-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 20V12M10 20V7M15 20V10M20 20V4" />
                </svg>
              </span>
              <div>
                <strong>{{ dashboard.clubSummary.activeLadders }}</strong>
                <span>Active ladders</span>
                <small>{{ dashboard.clubSummary.activeLaddersLabel }}</small>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>

    <p class="dashboard-status" role="status" aria-live="polite">{{ staticNotice }}</p>
  </main>
</template>

<style scoped>
.dashboard-page {
  width: 100%;
  padding: 4px 0 40px;
  color: var(--color-text);
}

.dashboard-stack {
  display: grid;
  gap: 40px;
}

.dashboard-panel {
  opacity: 0;
  transform: translateY(8px);
}

.dashboard-panel.is-visible {
  opacity: 1;
  transform: none;
  transition:
    opacity 420ms ease,
    transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.dashboard-section {
  display: grid;
  width: 100%;
  gap: 16px;
}

.dashboard-section + .dashboard-section {
  margin-top: 4px;
}

.dashboard-section:first-child {
  margin-bottom: 4px;
}

.section-intro {
  min-width: 0;
}

.section-intro--split {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}

.section-intro h2,
.section-intro p {
  margin: 0;
}

.section-intro h2 {
  color: var(--color-text-soft);
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.018em;
  line-height: 1.3;
}

.section-intro p {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.5;
}

.dashboard-card {
  position: relative;
  overflow: hidden;
  border: 1px solid #edf1ee;
  border-radius: 18px;
  background: var(--color-surface);
  box-shadow:
    0 10px 28px rgba(20, 45, 29, 0.018),
    0 22px 54px rgba(20, 45, 29, 0.02);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.dashboard-card:hover {
  border-color: #e2e8e3;
  box-shadow:
    0 14px 34px rgba(20, 45, 29, 0.026),
    0 30px 70px rgba(20, 45, 29, 0.028);
  transform: translateY(-1px);
}

.ladder-card {
  position: relative;
  width: 100%;
  min-height: 158px;
  overflow: hidden;
  border-radius: 18px;
  padding: 26px 30px;
  background-image:
    linear-gradient(
      90deg,
      rgba(8, 43, 24, 0.5) 0%,
      rgba(8, 43, 24, 0.22) 48%,
      rgba(8, 43, 24, 0.04) 76%
    ),
    url('https://res.cloudinary.com/dnuhjsckk/image/upload/v1787789959/tennissecond_1_skqfpc.png');
  background-position: center;
  background-size: cover;
  box-shadow: 0 10px 28px rgba(19, 44, 27, 0.07);
}

.ladder-header {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
}

.ladder-heading-copy {
  min-width: 0;
}

.ladder-heading-copy h3,
.ladder-heading-copy p {
  margin: 0;
}

.ladder-heading-copy h3 {
  color: var(--color-light);
  font-size: 20px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.02em;
  line-height: 1.28;
}

.ladder-heading-copy p {
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 13px;
  line-height: 1.45;
}

.open-ladder {
  display: inline-flex;
  min-width: 154px;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 25px;
  border: 0;
  border-radius: 9px;
  padding: 0 17px;
  background: #f5f6e9;
  color: #173e24;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  transition:
    background 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.open-ladder:hover {
  background: var(--color-light);
  box-shadow: 0 6px 18px rgba(9, 29, 16, 0.12);
  transform: translateY(-1px);
}

.open-ladder-arrow {
  font-size: 17px;
  line-height: 1;
}

.ladder-divider {
  width: min(420px, 48%);
  height: 1px;
  margin: 21px 0 16px;
  background: rgba(255, 255, 255, 0.2);
}

.ladder-position {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  line-height: 1.5;
}

.ladder-position strong {
  color: var(--color-light);
  font-size: 16px;
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.quick-panel {
  padding: 20px 22px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.quick-card {
  position: relative;
  display: grid;
  min-height: 126px;
  grid-template-columns: 44px minmax(0, 1fr) 26px;
  align-items: center;
  gap: 13px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 15px;
  background: var(--color-surface);
  box-shadow: 0 8px 22px rgba(20, 45, 29, 0.014);
  color: var(--color-text);
  text-align: left;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.quick-card:hover {
  border-color: #dce6de;
  box-shadow: 0 12px 30px rgba(20, 45, 29, 0.026);
  transform: translateY(-2px);
}

.quick-icon,
.attention-icon,
.glance-icon {
  display: grid;
  width: 37px;
  height: 37px;
  flex: 0 0 auto;
  align-self: center;
  justify-self: center;
  place-items: center;
  border-radius: 50%;
  background: rgba(0, 181, 26, 0.038);
  color: var(--color-primary-strong);
  line-height: 0;
}

.quick-icon {
  place-self: center;
}

.quick-icon svg,
.attention-icon svg,
.glance-icon svg,
.quick-arrow svg,
.calendar-link svg {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.quick-icon svg {
  display: block;
  width: 16px;
  height: 16px;
}

.quick-copy {
  display: grid;
  max-width: 155px;
  gap: 4px;
}

.quick-copy strong {
  color: #111712;
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
}

.quick-copy small {
  color: #111712;
  font-size: 12px;
  line-height: 1.5;
}

.quick-arrow {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 1px solid rgba(0, 143, 21, 0.18);
  border-radius: 50%;
  color: var(--color-primary-strong);
  transition: transform 160ms ease;
}

.quick-arrow svg {
  width: 11px;
  height: 11px;
}

.quick-card:hover .quick-arrow {
  transform: translateX(2px);
}

.attention-panel {
  padding: 7px 22px;
  background: color-mix(in srgb, var(--color-accent) 4%, var(--color-surface));
}

.attention-item {
  display: grid;
  min-height: 82px;
  grid-template-columns: 37px minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  border-top: 1px solid var(--color-border);
  padding: 13px 0;
}

.attention-item:first-child {
  border-top: 0;
}

.attention-icon {
  place-self: center;
}

.attention-icon svg {
  display: block;
  width: 16px;
  height: 16px;
}

.attention-copy strong {
  display: block;
  margin-bottom: 4px;
  color: var(--color-text-soft);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
}

.attention-copy p {
  margin: 0;
  color: #818a83;
  font-size: 12px;
  line-height: 1.5;
}

.attention-item > button {
  min-width: 76px;
  min-height: 33px;
  border: 1px solid rgba(0, 143, 21, 0.28);
  border-radius: 8px;
  padding: 0 12px;
  background: var(--color-surface);
  color: var(--color-primary-strong);
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  transition:
    background 150ms ease,
    border-color 150ms ease,
    transform 150ms ease;
}

.attention-item > button:hover {
  border-color: rgba(0, 143, 21, 0.42);
  background: rgba(0, 181, 26, 0.035);
  transform: translateY(-1px);
}

.calendar-link {
  display: inline-flex;
  min-height: 34px;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary-strong);
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.calendar-link svg {
  width: 11px;
  height: 11px;
}

.upcoming-panel {
  padding: 14px 22px;
}

.upcoming-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.upcoming-item {
  display: grid;
  min-height: 84px;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 13px;
  padding: 8px 22px 8px 0;
}

.upcoming-item + .upcoming-item {
  border-left: 1px solid var(--color-border);
  padding-left: 23px;
}

.calendar-date {
  display: grid;
  width: 54px;
  height: 62px;
  grid-template-rows: 17px 1fr 13px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-surface);
  color: var(--color-primary-strong);
  font-style: normal;
  text-align: center;
}

.calendar-date span {
  display: grid;
  place-items: center;
  background: var(--color-primary-strong);
  color: var(--color-light);
  font-size: 8px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.calendar-date strong {
  align-self: end;
  font-size: 20px;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.calendar-date small {
  color: #929a94;
  font-size: 8px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  line-height: 1;
  text-transform: uppercase;
}

.upcoming-copy h3,
.upcoming-copy p {
  margin: 0;
}

.upcoming-copy h3 {
  margin-bottom: 4px;
  color: var(--color-text-soft);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
}

.upcoming-copy p {
  color: #818a83;
  font-size: 12px;
  line-height: 1.5;
}

.glance-panel {
  padding: 14px 22px;
  background: color-mix(in srgb, var(--color-primary) 2.5%, var(--color-surface));
}

.glance-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.glance-item {
  display: grid;
  min-height: 84px;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 11px;
  padding: 6px 24px;
}

.glance-item:first-child {
  padding-left: 0;
}

.glance-item + .glance-item {
  border-left: 1px solid var(--color-border);
}

.glance-icon {
  place-self: center;
}

.glance-icon svg {
  display: block;
  width: 16px;
  height: 16px;
}

.glance-item strong,
.glance-item span,
.glance-item small {
  display: block;
}

.glance-item strong {
  color: var(--color-text-soft);
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.15;
}

.glance-item span {
  margin-top: 2px;
  color: #5c665f;
  font-size: 12px;
  font-weight: var(--font-weight-medium);
}

.glance-item small {
  margin-top: 3px;
  color: #8b938d;
  font-size: 11px;
  line-height: 1.4;
}

.glance-item small.positive {
  color: var(--color-primary-strong);
  font-weight: var(--font-weight-medium);
}

.dashboard-status {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 80;
  min-width: 180px;
  margin: 0;
  border: 1px solid var(--color-border-strong);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--color-surface);
  box-shadow: 0 12px 30px rgba(18, 48, 28, 0.05);
  color: #31503a;
  font-size: 11px;
  font-weight: var(--font-weight-medium);
}

.dashboard-status:empty {
  display: none;
}

.quick-card:focus-visible,
.attention-item > button:focus-visible,
.open-ladder:focus-visible,
.calendar-link:focus-visible {
  outline: 3px solid rgba(0, 181, 26, 0.14);
  outline-offset: 3px;
}

@media (max-width: 1080px) and (min-width: 721px) {
  .quick-card {
    min-height: 122px;
    grid-template-columns: 40px minmax(0, 1fr) 24px;
    gap: 9px;
    padding: 13px;
  }

  .quick-copy {
    max-width: 125px;
  }
}

@media (max-width: 900px) {
  .ladder-card {
    padding: 24px 26px;
  }

  .ladder-header {
    gap: 24px;
  }
}

@media (max-width: 720px) {
  .dashboard-page {
    padding-top: 0;
  }

  .dashboard-stack {
    gap: 30px;
  }

  .dashboard-section:first-child {
    margin-bottom: 2px;
  }

  .dashboard-section {
    gap: 14px;
  }

  .section-intro h2 {
    font-size: 17px;
  }

  .quick-grid,
  .upcoming-grid,
  .glance-grid {
    grid-template-columns: 1fr;
  }

  .quick-card {
    min-height: 114px;
  }

  .upcoming-item + .upcoming-item,
  .glance-item + .glance-item {
    border-top: 1px solid var(--color-border);
    border-left: 0;
  }

  .upcoming-item + .upcoming-item {
    padding-left: 0;
  }

  .glance-item,
  .glance-item:first-child {
    padding: 12px 0;
  }
}

@media (max-width: 640px) {
  .ladder-card {
    min-height: 170px;
    border-radius: 15px;
    padding: 21px;
    background-position: 61% center;
  }

  .ladder-header {
    align-items: flex-start;
    gap: 16px;
  }

  .ladder-heading-copy h3 {
    max-width: 210px;
    font-size: 17px;
  }

  .ladder-heading-copy p {
    font-size: 12px;
  }

  .open-ladder {
    min-width: auto;
    height: 40px;
    gap: 12px;
    padding: 0 13px;
    font-size: 12px;
  }

  .ladder-divider {
    width: 58%;
    margin: 19px 0 14px;
  }

  .ladder-position {
    font-size: 12px;
  }

  .ladder-position strong {
    font-size: 15px;
  }
}

@media (max-width: 520px) {
  .quick-panel,
  .attention-panel,
  .upcoming-panel,
  .glance-panel {
    padding-right: 18px;
    padding-left: 18px;
  }

  .section-intro--split {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .quick-card {
    grid-template-columns: 42px minmax(0, 1fr) 25px;
  }

  .calendar-date {
    width: 50px;
    height: 58px;
  }
}

@media (max-width: 430px) {
  .ladder-card {
    background-position: 67% center;
  }

  .ladder-header {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
  }

  .ladder-heading-copy h3 {
    max-width: 180px;
    font-size: 16px;
  }

  .open-ladder {
    height: 38px;
    gap: 8px;
    border-radius: 8px;
    padding: 0 11px;
  }

  .ladder-divider {
    width: 65%;
  }
}

@media (max-width: 390px) {
  .attention-item {
    grid-template-columns: 37px minmax(0, 1fr);
  }

  .attention-item > button {
    grid-column: 2;
    justify-self: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-panel {
    opacity: 1;
    transform: none;
  }

  .dashboard-panel,
  .dashboard-card,
  .quick-card,
  .attention-item > button,
  .open-ladder {
    animation: none;
    transition: none;
  }

  .dashboard-card:hover,
  .quick-card:hover,
  .attention-item > button:hover,
  .open-ladder:hover {
    transform: none;
  }
}
</style>
