<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import HomePrioritySlot from '../components/dashboard/HomePrioritySlot.vue'
import { dashboardFixture } from '../data/dashboard'
import { resolveHomePriority } from '../utils/homePriority/resolveHomePriority'

const router = useRouter()
const dashboardRoot = ref(null)
const staticNotice = ref('')
const dashboard = dashboardFixture
const ladderRoute = Object.freeze({ name: 'Rankings' })
const actionIconNames = Object.freeze(['play', 'challenge', 'tournament'])
let revealObserver = null

const homePriority = computed(() => resolveHomePriority(dashboard.priorityCandidates))
const currentLadder = computed(() => dashboard.ladders[0] || null)
const userInitials = computed(
  () => (dashboard.currentUser.firstName[0] || '') + (dashboard.currentUser.lastName[0] || ''),
)

function ordinal(value) {
  const number = Number(value)
  const remainder = number % 100
  if (remainder >= 11 && remainder <= 13) return number + 'th'
  if (number % 10 === 1) return number + 'st'
  if (number % 10 === 2) return number + 'nd'
  if (number % 10 === 3) return number + 'rd'
  return number + 'th'
}

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

function openPriority(priority) {
  openRoute(priority?.to)
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
      <section class="dashboard-panel dashboard-hero" aria-labelledby="dashboard-welcome-title">
        <div>
          <p>{{ dashboard.activeClub.name }}</p>
          <h1 id="dashboard-welcome-title">Welcome back, {{ dashboard.currentUser.firstName }}.</h1>
          <span>Here’s what needs you, what you can do, and what’s coming up.</span>
        </div>
        <span class="dashboard-hero__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M6.3 6.6c2.8 1.8 4 4 3.9 6.8M17.7 17.4c-2.8-1.8-4-4-3.9-6.8" />
          </svg>
        </span>
      </section>

      <HomePrioritySlot
        v-if="homePriority"
        class="dashboard-panel"
        :priority="homePriority"
        @open="openPriority"
      />

      <section
        v-if="currentLadder"
        class="dashboard-panel dashboard-card ladder-summary"
        aria-labelledby="ladder-title"
      >
        <div class="ladder-main">
          <div class="ladder-heading">
            <span class="section-icon ladder-heading-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="4" y="3" width="16" height="18" rx="3" />
                <path d="M8 17V9M12 17V6M16 17v-4" />
              </svg>
            </span>
            <div>
              <span class="ladder-eyebrow">You’re on this ladder</span>
              <h2 id="ladder-title">{{ currentLadder.name }}</h2>
              <p>{{ dashboard.activeClub.name }}</p>
            </div>
          </div>

          <div class="ladder-person">
            <span class="ladder-avatar" aria-hidden="true">{{ userInitials }}</span>
            <div>
              <strong>
                {{ dashboard.currentUser.firstName }}, you’re
                {{ ordinal(currentLadder.position) }} out of {{ currentLadder.playerCount }} players
              </strong>
              <p>
                You can challenge players ranked
                {{ ordinal(currentLadder.challengeFrom) }} to
                {{ ordinal(currentLadder.challengeTo) }}.
              </p>
            </div>
          </div>
        </div>

        <div class="ladder-side">
          <div class="ladder-facts">
            <div class="ladder-fact">
              <span>Your position</span>
              <strong>{{ ordinal(currentLadder.position) }}</strong>
            </div>
            <div class="ladder-fact">
              <span>Players</span>
              <strong>{{ currentLadder.playerCount }}</strong>
            </div>
            <div class="ladder-fact">
              <span>You can challenge</span>
              <strong>
                {{ ordinal(currentLadder.challengeFrom) }}–{{ ordinal(currentLadder.challengeTo) }}
              </strong>
            </div>
          </div>

          <button class="ladder-link" type="button" @click="openRoute(ladderRoute)">
            <span>See ladder</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </section>

      <section class="dashboard-panel dashboard-card quick-panel" aria-labelledby="quick-title">
        <header class="section-heading">
          <span class="section-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="m13 2-7 11h6l-1 9 7-12h-6Z" /></svg>
          </span>
          <div>
            <h2 id="quick-title">Quick actions for you</h2>
            <p>What do you want to do?</p>
          </div>
        </header>

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

            <span class="quick-photo" aria-hidden="true">
              <img :src="action.image" alt="" loading="lazy" />
            </span>
          </button>
        </div>
      </section>

      <section
        class="dashboard-panel dashboard-card attention-panel"
        aria-labelledby="attention-title"
      >
        <header class="section-heading">
          <span class="section-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
            </svg>
          </span>
          <div>
            <h2 id="attention-title">Needs your attention</h2>
            <p>Take care of these when you’re ready.</p>
          </div>
        </header>

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
      </section>

      <section
        class="dashboard-panel dashboard-card upcoming-panel"
        aria-labelledby="upcoming-title"
      >
        <header class="section-heading section-heading--split">
          <span class="section-heading__main">
            <span class="section-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="4" y="5" width="16" height="15" rx="2" />
                <path d="M8 3v4M16 3v4M4 10h16" />
              </svg>
            </span>
            <span>
              <h2 id="upcoming-title">Upcoming events at {{ dashboard.activeClub.name }}</h2>
              <p>See what’s coming up next.</p>
            </span>
          </span>

          <button class="calendar-link" type="button" @click="openCalendar">
            Open calendar
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </header>

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
      </section>

      <section class="dashboard-panel dashboard-card glance-panel" aria-labelledby="glance-title">
        <header class="section-heading">
          <span class="section-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="9" cy="8" r="3" />
              <circle cx="17" cy="9" r="2.5" />
              <path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 15a4.5 4.5 0 0 1 6.5 4" />
            </svg>
          </span>
          <div>
            <h2 id="glance-title">{{ dashboard.activeClub.name }} right now</h2>
            <p>Here’s what’s happening at your club.</p>
          </div>
        </header>

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
  gap: 24px;
}

.dashboard-hero {
  display: flex;
  min-height: 132px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-accent) 34%, var(--color-border));
  border-radius: 14px;
  padding: 24px 26px;
  background: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface));
  box-shadow: var(--flow-shadow-quiet);
}

.dashboard-hero p,
.dashboard-hero h1,
.dashboard-hero span {
  margin: 0;
}

.dashboard-hero p {
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.dashboard-hero h1 {
  margin-top: 5px;
  color: var(--color-text-soft);
  font-size: 22px;
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.025em;
  line-height: 1.25;
}

.dashboard-hero div > span {
  display: block;
  max-width: 58ch;
  margin-top: 7px;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: var(--font-weight-regular);
  line-height: 1.65;
}

.dashboard-hero__mark {
  display: grid;
  width: 58px;
  height: 58px;
  flex: 0 0 58px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface);
  box-shadow: 0 8px 22px rgba(87, 61, 8, 0.055);
  color: var(--color-primary-strong);
}

.dashboard-hero__mark svg {
  width: 28px;
  height: 28px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
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

.dashboard-panel {
  opacity: 0;
  transform: translateY(8px);
}

.dashboard-panel.is-visible {
  opacity: 1;
  transform: none;
  transition:
    opacity 420ms ease,
    transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.section-heading,
.section-heading__main {
  display: flex;
  align-items: flex-start;
  gap: 11px;
}

.section-heading {
  padding: 22px 22px 8px;
}

.section-heading--split {
  justify-content: space-between;
  gap: 16px;
}

.section-heading h2,
.section-heading p {
  margin: 0;
}

.section-heading h2 {
  color: var(--color-text-soft);
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.016em;
  line-height: 1.35;
}

.section-heading p {
  margin-top: 5px;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.55;
}

.section-icon,
.attention-icon,
.glance-icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  background: rgba(0, 181, 26, 0.055);
  color: var(--color-primary-strong);
}

.section-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  animation: gorra-icon-float 3.8s ease-in-out infinite;
  transform-style: preserve-3d;
}

.section-icon svg {
  width: 14px;
  height: 14px;
}

.section-icon svg,
.attention-icon svg,
.glance-icon svg,
.ladder-link svg,
.calendar-link svg {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.dashboard-card:hover .section-icon {
  animation: gorra-icon-flip 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.ladder-summary {
  display: grid;
  min-height: 190px;
  grid-template-columns: minmax(0, 1.2fr) minmax(330px, 0.8fr);
  align-items: stretch;
}

.ladder-main {
  display: grid;
  align-content: space-between;
  gap: 25px;
  padding: 24px 26px;
}

.ladder-heading {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ladder-heading-icon {
  width: 36px;
  height: 36px;
  flex-basis: 36px;
  border-radius: 11px;
  background: rgba(0, 181, 26, 0.09);
}

.ladder-heading-icon svg {
  width: 18px;
  height: 18px;
}

.ladder-eyebrow {
  display: block;
  margin-bottom: 5px;
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.11em;
  line-height: 1;
  text-transform: uppercase;
}

.ladder-heading h2,
.ladder-heading p,
.ladder-person p {
  margin: 0;
}

.ladder-heading h2 {
  color: var(--color-text-soft);
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.ladder-heading p {
  margin-top: 4px;
  color: #858e87;
  font-size: 12px;
}

.ladder-person {
  display: flex;
  align-items: center;
  gap: 11px;
}

.ladder-avatar {
  display: grid;
  width: 39px;
  height: 39px;
  flex: 0 0 39px;
  place-items: center;
  border-radius: 50%;
  background: #f1f8f3;
  color: var(--color-primary-strong);
  font-size: 9px;
  font-weight: var(--font-weight-bold);
}

.ladder-person strong {
  display: block;
  margin-bottom: 4px;
  color: var(--color-text-soft);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
}

.ladder-person p {
  color: #7d867f;
  font-size: 12px;
  line-height: 1.5;
}

.ladder-side {
  display: grid;
  min-width: 0;
  align-content: space-between;
  gap: 18px;
  border-left: 1px solid var(--color-border);
  padding: 24px 24px 20px;
  background: #fbfdfb;
}

.ladder-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ladder-fact {
  min-width: 0;
  border-left: 1px solid var(--color-border);
  padding: 2px 16px;
}

.ladder-fact:first-child {
  border-left: 0;
  padding-left: 0;
}

.ladder-fact span {
  display: block;
  min-height: 23px;
  color: #8a928c;
  font-size: 10px;
  line-height: 1.35;
}

.ladder-fact strong {
  display: block;
  margin-top: 5px;
  color: #182019;
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  white-space: nowrap;
}

.ladder-fact:first-child strong {
  color: var(--color-primary-strong);
}

.ladder-link {
  display: flex;
  width: 100%;
  min-height: 39px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  overflow: hidden;
  border: 0;
  border-top: 1px solid var(--color-border);
  padding: 0 2px;
  background: transparent;
  color: var(--color-primary-strong);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  text-align: left;
  transition: transform 160ms ease;
}

.ladder-link svg {
  width: 13px;
  height: 13px;
  transition: transform 180ms ease;
}

.ladder-link:hover {
  transform: translateX(2px);
}

.ladder-link:hover svg {
  transform: translateX(3px);
}

.quick-panel {
  padding-bottom: 21px;
  background: var(--color-surface);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 10px 22px 0;
}

.quick-card {
  position: relative;
  isolation: isolate;
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

.quick-card::before {
  position: absolute;
  z-index: 2;
  inset: 0;
  background: linear-gradient(
    90deg,
    #fff 0%,
    #fff 46%,
    rgba(255, 255, 255, 0.97) 57%,
    rgba(255, 255, 255, 0.76) 69%,
    rgba(255, 255, 255, 0) 84%
  );
  content: '';
  pointer-events: none;
}

.quick-card:hover {
  border-color: #dce6de;
  box-shadow:
    0 12px 30px rgba(20, 45, 29, 0.022),
    0 24px 48px rgba(20, 45, 29, 0.02);
  transform: translateY(-2px);
}

.quick-card > :not(.quick-photo) {
  position: relative;
  z-index: 3;
}

.quick-icon {
  display: grid;
  width: 43px;
  height: 43px;
  place-items: center;
  border-radius: 50%;
  background: rgba(0, 181, 26, 0.055);
  color: var(--color-primary-strong);
  animation: gorra-quick-pulse 3.2s ease-in-out infinite;
  transform-style: preserve-3d;
}

.quick-card:nth-child(2) .quick-icon {
  animation-delay: 280ms;
}

.quick-card:nth-child(3) .quick-icon {
  animation-delay: 560ms;
}

.quick-card:hover .quick-icon {
  animation: gorra-quick-flip 480ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.quick-icon svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.65;
}

.quick-copy {
  display: grid;
  max-width: 155px;
  gap: 4px;
}

.quick-copy strong {
  color: var(--color-text-soft);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
}

.quick-copy small {
  color: #808881;
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
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.quick-card:hover .quick-arrow {
  transform: translateX(2px);
}

.quick-photo {
  position: absolute;
  z-index: 1;
  inset: 0 0 0 auto;
  width: 48%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.quick-photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.001);
  transition: transform 340ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.quick-card:hover .quick-photo img {
  transform: scale(1.045);
}

.attention-panel {
  padding-bottom: 9px;
  background: color-mix(in srgb, var(--color-accent) 4%, var(--color-surface));
}

.attention-list {
  padding: 0 22px 6px;
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
  width: 37px;
  height: 37px;
  border-radius: 50%;
  transition: transform 160ms ease;
}

.attention-item:hover .attention-icon {
  transform: translateY(-1px);
}

.attention-icon svg {
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
  position: relative;
  min-width: 76px;
  min-height: 33px;
  overflow: hidden;
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

.attention-item > button::after {
  position: absolute;
  top: 0;
  left: -120%;
  width: 70%;
  height: 100%;
  background: linear-gradient(
    105deg,
    transparent,
    rgba(0, 143, 21, 0.05),
    rgba(0, 143, 21, 0.16),
    rgba(0, 143, 21, 0.05),
    transparent
  );
  content: '';
  pointer-events: none;
  transform: skewX(-18deg);
  transition: left 500ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.attention-item > button:hover {
  border-color: rgba(0, 143, 21, 0.42);
  background: rgba(0, 181, 26, 0.035);
  transform: translateY(-2px);
}

.attention-item > button:hover::after {
  left: 145%;
}

.upcoming-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 0 22px 14px;
}

.upcoming-item {
  display: grid;
  min-height: 84px;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 13px;
  border-radius: 10px;
  padding: 8px 22px 8px 0;
  transition: background 160ms ease;
}

.upcoming-item:hover {
  background: #fbfdfb;
}

.upcoming-item + .upcoming-item {
  border-left: 1px solid var(--color-border);
  border-radius: 0 10px 10px 0;
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

.calendar-link {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--color-primary-strong);
  font-size: 12px;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  transition: transform 160ms ease;
}

.calendar-link svg {
  width: 11px;
  height: 11px;
  transition: transform 180ms ease;
}

.calendar-link:hover {
  transform: translateX(2px);
}

.calendar-link:hover svg {
  transform: translateX(3px);
}

.glance-panel {
  padding-bottom: 14px;
  background: color-mix(in srgb, var(--color-primary) 2.5%, var(--color-surface));
}

.glance-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 0 22px;
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
  width: 41px;
  height: 41px;
  border-radius: 50%;
}

.glance-icon svg {
  width: 19px;
  height: 19px;
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

.dashboard-panel.is-visible:hover {
  transform: translateY(-1px);
}

.quick-card:focus-visible,
.attention-item > button:focus-visible,
.ladder-link:focus-visible,
.calendar-link:focus-visible {
  outline: 3px solid rgba(0, 181, 26, 0.14);
  outline-offset: 3px;
}

@keyframes gorra-icon-float {
  0%,
  100% {
    transform: translateY(0) rotateY(0deg);
  }
  50% {
    transform: translateY(-3px) rotateY(0deg);
  }
}

@keyframes gorra-icon-flip {
  0% {
    transform: translateY(0) rotateY(0deg);
  }
  40% {
    transform: translateY(-5px) rotateY(110deg);
  }
  72% {
    transform: translateY(-2px) rotateY(235deg);
  }
  100% {
    transform: translateY(0) rotateY(360deg);
  }
}

@keyframes gorra-quick-pulse {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-2px) scale(1.02);
  }
}

@keyframes gorra-quick-flip {
  0% {
    transform: translateY(0) rotateY(0deg) scale(1);
  }
  50% {
    transform: translateY(-4px) rotateY(180deg) scale(1.05);
  }
  100% {
    transform: translateY(0) rotateY(360deg) scale(1);
  }
}

@media (max-width: 1080px) and (min-width: 721px) {
  .quick-card {
    min-height: 122px;
    grid-template-columns: 40px minmax(0, 1fr) 24px;
    gap: 9px;
    padding: 13px;
  }

  .quick-icon {
    width: 40px;
    height: 40px;
  }

  .quick-copy {
    max-width: 125px;
  }

  .quick-photo {
    width: 45%;
  }
}

@media (max-width: 900px) {
  .ladder-summary {
    grid-template-columns: 1fr;
  }

  .ladder-side {
    border-top: 1px solid var(--color-border);
    border-left: 0;
  }

  .ladder-link {
    min-height: 42px;
  }
}

@media (max-width: 720px) {
  .dashboard-page {
    padding-top: 0;
  }

  .dashboard-stack {
    gap: 16px;
  }

  .quick-grid {
    grid-template-columns: 1fr;
  }

  .quick-card {
    min-height: 114px;
  }

  .quick-photo {
    width: 42%;
  }

  .ladder-main,
  .ladder-side {
    padding-right: 20px;
    padding-left: 20px;
  }

  .upcoming-grid,
  .glance-grid {
    grid-template-columns: 1fr;
  }

  .upcoming-item + .upcoming-item {
    border-top: 1px solid var(--color-border);
    border-left: 0;
    border-radius: 0;
    padding-left: 0;
  }

  .glance-item,
  .glance-item:first-child {
    padding: 12px 0;
  }

  .glance-item + .glance-item {
    border-top: 1px solid var(--color-border);
    border-left: 0;
  }
}

@media (max-width: 520px) {
  .section-heading,
  .quick-grid,
  .attention-list,
  .upcoming-grid,
  .glance-grid {
    padding-right: 18px;
    padding-left: 18px;
  }

  .quick-card {
    grid-template-columns: 42px minmax(0, 1fr) 25px;
  }

  .quick-photo {
    width: 45%;
  }

  .quick-card::before {
    background: linear-gradient(
      90deg,
      #fff 0%,
      #fff 50%,
      rgba(255, 255, 255, 0.97) 60%,
      rgba(255, 255, 255, 0.72) 72%,
      rgba(255, 255, 255, 0) 89%
    );
  }

  .calendar-date {
    width: 50px;
    height: 58px;
  }
}

@media (max-width: 430px) {
  .ladder-facts {
    grid-template-columns: 1fr 1fr;
    row-gap: 16px;
  }

  .ladder-fact {
    padding: 0 14px;
  }

  .ladder-fact:nth-child(3) {
    grid-column: 1 / -1;
    border-top: 1px solid var(--color-border);
    border-left: 0;
    padding: 14px 0 0;
  }

  .ladder-link {
    min-height: 44px;
    align-items: center;
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
  .section-icon,
  .quick-icon,
  .quick-card,
  .quick-photo img,
  .attention-icon,
  .attention-item > button,
  .ladder-link,
  .calendar-link {
    animation: none;
    transition: none;
  }

  .dashboard-panel:hover,
  .dashboard-card:hover,
  .quick-card:hover,
  .quick-card:hover .quick-icon,
  .attention-item > button:hover,
  .ladder-link:hover,
  .calendar-link:hover {
    transform: none;
  }

  .attention-item > button::after {
    display: none;
  }
}
</style>
