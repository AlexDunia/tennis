<template>
  <div class="layout">
    <aside v-if="!isTournamentCreate" class="sidebar">
      <div class="logo">
        <img
          src="https://res.cloudinary.com/dnuhjsckk/image/upload/v1776503502/RENAISSANCE-AFRICA-ENERGY-LOGO-update_s4eb9u.png"
          alt="Renaissance Africa Tennis Club Port Harcourt"
          class="logo-img cloudinary-img"
        />
      </div>

      <nav class="nav">
        <RouterLink
          v-for="item in navigationItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ active: isNavigationActive(item.to) }"
        >
          <span class="icon" v-html="item.icon"></span>
          <span class="label">{{ item.label }}</span>
        </RouterLink>

        <!-- PROFILE -->
        <RouterLink to="/profile" class="nav-link" :class="{ active: route.path === '/profile' }">
          <span class="icon" v-html="profileIcon"></span>
          <span class="label">Profile</span>
        </RouterLink>

        <!-- NOTIFICATIONS -->
        <RouterLink
          to="/notifications"
          class="nav-link"
          :class="{ active: route.path === '/notifications' }"
        >
          <span class="icon" v-html="bellIcon"></span>
          <span class="label">Notifications</span>
          <span v-if="unreadCount" class="badge">{{ unreadCount }}</span>
        </RouterLink>
      </nav>
    </aside>

    <main
      class="main"
      :class="{ 'main--wizard': isTournamentCreate }"
    >
      <div
        class="header"
        :class="{ 'header--wizard': isTournamentCreate }"
      >
        <div class="header-main">
          <button
            v-if="headerBackLabel"
            class="header-back"
            type="button"
            :aria-label="headerBackLabel"
            :title="headerBackLabel"
            @click="handleHeaderBack"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div class="header-left" :class="{ 'header-left--wizard': isTournamentCreate }">
            <ol v-if="isTournamentCreate" class="header-steps" aria-label="Tournament creation progress">
              <li
                v-for="(step, index) in tournamentCreateSteps"
                :key="step"
                :class="{
                  'header-step--done': index < tournamentCreateStepIndex,
                  'header-step--active': index === tournamentCreateStepIndex,
                }"
              >
                <span>{{ index < tournamentCreateStepIndex ? 'OK' : index + 1 }}</span>
                <strong>{{ tournamentCreateTitles[step] }}</strong>
              </li>
            </ol>
            <template v-else>
              <h1>{{ currentTitle }}</h1>
              <p>{{ currentSubtitle }}</p>
            </template>
          </div>
        </div>

        <div class="user" v-if="currentPlayer">
          <div class="avatar-btn">{{ initials }}</div>
          <span class="user-name">{{ currentPlayer.name }}</span>
        </div>
      </div>

      <div class="content">
        <div class="watch-only">
          <strong>Rank #{{ currentPlayer?.rank || '-' }}</strong>
          <span>{{ currentPlayer?.name || 'Player' }}</span>
          <span>{{ unreadCount }} unread</span>
        </div>
        <RouterView />
      </div>
    </main>

    <nav v-if="!isTournamentCreate" class="bottom-nav" aria-label="Primary navigation">
      <RouterLink
        v-for="item in navigationItems"
        :key="`bottom-${item.to}`"
        :to="item.to"
        class="nav-link"
        :class="{ active: isNavigationActive(item.to) }"
      >
        <span class="icon" v-html="item.icon"></span>
        <span class="label">{{ item.label }}</span>
      </RouterLink>

      <RouterLink to="/profile" class="nav-link" :class="{ active: route.path === '/profile' }">
        <span class="icon" v-html="profileIcon"></span>
        <span class="label">Profile</span>
      </RouterLink>

      <RouterLink
        to="/notifications"
        class="nav-link"
        :class="{ active: route.path === '/notifications' }"
      >
        <span class="icon" v-html="bellIcon"></span>
        <span class="label">Notifications</span>
        <span v-if="unreadCount" class="badge">{{ unreadCount }}</span>
      </RouterLink>
    </nav>
  </div>

  <ToastShelf />
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useNotificationStore } from '../stores/notification'
import { usePlayerStore } from '../stores/player'
import ToastShelf from '../components/ToastShelf.vue'

const route = useRoute()
const router = useRouter()
const notificationStore = useNotificationStore()
const playerStore = usePlayerStore()

onMounted(() => {
  if (!playerStore.players.length) {
    playerStore.loadPlayers()
  }
})

const navigationItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/></svg>',
  },
  {
    to: '/rankings',
    label: 'Rankings',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 13V6M7 13V3M11 13V8" stroke-linecap="round"/></svg>',
  },
  {
    to: '/tournaments',
    label: 'Tournaments',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 3h6v2a3 3 0 0 1-6 0V3Z"/><path d="M4 3H2v1a2 2 0 0 0 2 2M12 3h2v1a2 2 0 0 1-2 2M8 8v3M6 13h4" stroke-linecap="round"/></svg>',
  },
  {
    to: '/challenges',
    label: 'Challenges',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="5.5"/><path d="M5.5 8h5M8 5.5v5" stroke-linecap="round"/></svg>',
  },
]

const profileIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M4 20c1.5-3.5 5-5 8-5s6.5 1.5 8 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'

const bellIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5a4 4 0 0 1 4 4v3.5l1.5 1.5v.5H6v-.5L7.5 12.5V9a4 4 0 0 1 4-4Z" stroke="currentColor" stroke-width="1.7"/></svg>'

const tournamentCreateSteps = ['basics', 'categories', 'players', 'review']
const tournamentCreateTitles = {
  basics: 'Basics',
  categories: 'Categories',
  players: 'Players',
  review: 'Review',
}
const tournamentCreateSubtitles = {
  basics: 'Name the event and set the tournament dates.',
  categories: 'Choose the categories this tournament will use.',
  players: 'Select players and let the ladder help with placement.',
  review: 'Pick formats, check groups, then generate the tournament.',
}
const isTournamentCreate = computed(() => route.name === 'TournamentCreate')
const tournamentCreateStep = computed(() => {
  const step = String(route.query.step || 'basics')
  return tournamentCreateSteps.includes(step) ? step : 'basics'
})
const tournamentCreateStepIndex = computed(() =>
  Math.max(0, tournamentCreateSteps.indexOf(tournamentCreateStep.value)),
)

const currentTitle = computed(() => {
  if (isTournamentCreate.value) {
    return tournamentCreateTitles[tournamentCreateStep.value]
  }

  return route.meta.title || 'Renaissance Africa Tennis Club Port Harcourt'
})
const currentSubtitle = computed(() => {
  if (isTournamentCreate.value) {
    return tournamentCreateSubtitles[tournamentCreateStep.value]
  }

  return route.meta.subtitle || 'Manage the ladder from one calm workspace.'
})

const headerBackLabel = computed(() => {
  if (!isTournamentCreate.value) {
    return ''
  }

  return tournamentCreateStep.value === 'basics' ? 'Back to tournaments' : 'Previous step'
})

function handleHeaderBack() {
  if (!isTournamentCreate.value) {
    return
  }

  const currentIndex = tournamentCreateSteps.indexOf(tournamentCreateStep.value)
  if (currentIndex <= 0) {
    router.push('/tournaments')
    return
  }

  router.replace({
    path: route.path,
    query: {
      ...route.query,
      step: tournamentCreateSteps[currentIndex - 1],
    },
  })
}

const unreadCount = computed(() => notificationStore.unreadCount)
const currentPlayer = computed(() => playerStore.currentPlayer)

const initials = computed(() => {
  if (!currentPlayer.value?.name) return ''
  return currentPlayer.value.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
})

const isNavigationActive = (path) => {
  return path === '/tournaments' ? route.path.startsWith('/tournaments') : route.path === path
}
</script>

<style scoped>
.layout {
  font-family: 'Poppins', sans-serif;
  display: flex;
  min-height: 100vh;
}

/* SIDEBAR */
.sidebar {
  position: fixed;
  width: 240px;
  top: 0;
  bottom: 0;
  padding: 28px 20px;
  background: #fff;
  border-right: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 28px;
  box-shadow: 4px 0 18px rgba(0, 0, 0, 0.04);
  z-index: 30;
}

.logo {
  display: flex;
  align-items: center;
}

.logo-img {
  width: 100%;
  max-width: 160px;
  height: auto;
  object-fit: contain;
}

/* NAV */
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 500;
  color: #7b8794;
  text-decoration: none;
}

.icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.label {
  line-height: 1;
  min-width: 0;
}

.nav-link:hover {
  background: #f3f6f3;
  color: #0f1720;
}

.nav-link.active {
  background: rgba(0, 200, 83, 0.05);
  color: #007a32;
}

.badge {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 20px;
  background: rgba(0, 200, 83, 0.12);
  color: #007a32;
}

/* MAIN */
.main {
  margin-left: 240px;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding-top: 96px;
  position: relative;
}

.main--wizard {
  margin-left: 0;
}

/* HEADER (MORE PREMIUM SPACING) */
.header {
  position: fixed;
  top: 0;
  left: 240px;
  right: 0;
  background: #fff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 24px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 40;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

.header-main {
  display: flex;
  align-items: center;
  gap: 28px;
  min-width: 0;
}

.header--wizard {
  left: 0;
  min-height: 96px;
}

.header-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(29, 111, 181, 0.08);
  border-radius: 50%;
  padding: 0;
  margin-right: 2px;
  background: #e8f4ff;
  color: #1d6fb5;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    background 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.header-back svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.header-back:hover {
  transform: translateY(-1px);
  border-color: rgba(29, 111, 181, 0.2);
  background: #dceeff;
  box-shadow: 0 8px 18px rgba(29, 111, 181, 0.12);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  margin: 0;
  line-height: 1.25;
  letter-spacing: 0;
}

.header-left p {
  font-size: 12.5px;
  color: #7b8794;
  margin: 0;
  line-height: 1.4;
}

.header-steps {
  display: flex;
  align-items: center;
  gap: 0;
  min-width: 0;
  padding: 0;
  margin: 0;
  list-style: none;
}

.header-steps li {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: #8a96a5;
  font-size: 12px;
  font-weight: 800;
}

.header-steps li::after {
  content: '';
  width: 42px;
  height: 2px;
  margin: 0 12px;
  background: #dbe3ec;
}

.header-steps li:last-child::after {
  display: none;
}

.header-steps span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #eef2f6;
  color: #7b8794;
  font-size: 10px;
  line-height: 1;
  transition:
    transform 0.16s ease,
    background 0.16s ease,
    color 0.16s ease;
}

.header-steps strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-step--done,
.header-step--active {
  color: #007a32;
}

.header-step--done span {
  background: #00b51a;
  color: #ffffff;
}

.header-step--active span {
  transform: translateY(-1px);
  border: 2px solid #00b51a;
  background: rgba(0, 181, 26, 0.08);
  color: #007a32;
}

/* USER */
.user {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.avatar-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00c853, #4cd964);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: #0f1720;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* CONTENT */
.content {
  padding: 32px;
  min-width: 0;
}

.watch-only,
.bottom-nav {
  display: none;
}

@media (min-width: 768px) and (max-width: 1024px) {
  .sidebar {
    width: 68px;
    padding: 24px 10px;
    align-items: center;
  }

  .logo-img {
    max-width: 44px;
  }

  .nav {
    width: 100%;
    align-items: center;
  }

  .nav-link {
    width: 48px;
    min-height: 44px;
    justify-content: center;
    padding: 10px;
    gap: 0;
  }

  .nav-link .label {
    display: none;
  }

  .nav-link .badge {
    position: absolute;
    top: 2px;
    right: 2px;
    margin-left: 0;
  }

  .main {
    margin-left: 68px;
    padding-top: 96px;
  }

  .content {
    padding: 20px;
  }
}

@media (max-width: 767px) {
  .sidebar {
    display: none;
  }

  .main,
  .main--wizard {
    margin-left: 0;
    padding-top: 82px;
    padding-bottom: 60px;
  }

  .header,
  .header--wizard {
    left: 0;
    right: 0;
    width: 100%;
    padding: 18px 20px;
  }

  .header-main {
    gap: 14px;
  }

  .header-steps {
    max-width: min(52vw, 340px);
    overflow: hidden;
  }

  .header-steps strong {
    display: none;
  }

  .header-steps li::after {
    width: 10px;
    margin: 0 6px;
  }

  .user-name {
    display: none;
  }

  .content {
    padding: 16px;
  }

  .bottom-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 60px;
    background: #fff;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    z-index: 40;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.04);
  }

  .bottom-nav .nav-link {
    position: relative;
    min-width: 44px;
    min-height: 44px;
    height: 60px;
    justify-content: center;
    flex-direction: column;
    gap: 4px;
    padding: 7px 2px 6px;
    border-radius: 0;
    font-size: 10px;
    line-height: 1.1;
    text-align: center;
  }

  .bottom-nav .icon {
    width: 18px;
    height: 18px;
  }

  .bottom-nav .label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bottom-nav .badge {
    position: absolute;
    top: 4px;
    right: calc(50% - 20px);
    margin-left: 0;
  }
}

@media (max-width: 480px) {
  .header {
    padding: 14px 16px;
    gap: 10px;
  }

  .header-back {
    width: 36px;
    height: 36px;
  }

  .header-left h1 {
    font-size: clamp(15px, 4vw, 20px);
  }

  .header-steps span {
    width: 26px;
    height: 26px;
  }

  .header-left p {
    font-size: 11.5px;
  }

  .user-name {
    display: none;
  }
}

@media (max-width: 162px) {
  .sidebar,
  .header,
  .bottom-nav,
  .content > *:not(.watch-only) {
    display: none;
  }

  .main {
    margin-left: 0;
    padding-bottom: 0;
  }

  .content {
    padding: 0;
  }

  .watch-only {
    display: flex;
    min-height: 100vh;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
    font-size: 9px;
    text-align: center;
  }
}
</style>
