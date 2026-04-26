<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">
        <img
          src="https://res.cloudinary.com/dnuhjsckk/image/upload/v1776503502/RENAISSANCE-AFRICA-ENERGY-LOGO-update_s4eb9u.png"
          alt="Renaissance Africa Tennis Club Port Harcourt"
          class="logo-img"
        />
      </div>

      <nav class="nav">
        <RouterLink
          v-for="item in navigationItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ active: route.path === item.to }"
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

    <main class="main">
      <div class="header">
        <div class="header-left">
          <h1>{{ currentTitle }}</h1>
          <p>{{ currentSubtitle }}</p>
        </div>

        <div class="user" v-if="currentPlayer">
          <div class="avatar-btn">{{ initials }}</div>
          <span class="user-name">{{ currentPlayer.name }}</span>
        </div>
      </div>

      <div class="content">
        <RouterView />
      </div>
    </main>
  </div>

  <ToastShelf />
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useNotificationStore } from '../stores/notification'
import { usePlayerStore } from '../stores/player'
import ToastShelf from '../components/ToastShelf.vue'

const route = useRoute()
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
    to: '/challenges',
    label: 'Challenges',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="5.5"/><path d="M5.5 8h5M8 5.5v5" stroke-linecap="round"/></svg>',
  },
]

const profileIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M4 20c1.5-3.5 5-5 8-5s6.5 1.5 8 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'

const bellIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5a4 4 0 0 1 4 4v3.5l1.5 1.5v.5H6v-.5L7.5 12.5V9a4 4 0 0 1 4-4Z" stroke="currentColor" stroke-width="1.7"/></svg>'

const currentTitle = computed(
  () => route.meta.title || 'Renaissance Africa Tennis Club Port Harcourt',
)
const currentSubtitle = computed(
  () => route.meta.subtitle || 'Manage the ladder from one calm workspace.',
)

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
  object-fit: contain;
}

/* NAV */
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
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
  display: flex;
  flex-direction: column;
}

/* HEADER (MORE PREMIUM SPACING) */
.header {
  position: sticky;
  top: 0;
  background: #fff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);

  padding: 24px 32px; /* increased vertical space */

  display: flex;
  align-items: center;
  justify-content: space-between;

  z-index: 10;

  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04); /* more floating feel */
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  margin: 0;
  line-height: 1.25;
  letter-spacing: -0.2px;
}

.header-left p {
  font-size: 12.5px;
  color: #7b8794;
  margin: 0;
  line-height: 1.4;
}

/* USER */
.user {
  display: flex;
  align-items: center;
  gap: 10px;
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
}

/* CONTENT */
.content {
  padding: 32px;
}
</style>
