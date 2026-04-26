<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-mark">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="white" stroke-width="1.6" />
            <path
              d="M3.5 8 Q5.5 5 8 8 Q10.5 11 12.5 8"
              stroke="white"
              stroke-width="1.6"
              fill="none"
              stroke-linecap="round"
            />
          </svg>
        </div>
        ShellTennis
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

        <!-- USER (REACTIVE FROM PLAYER STORE) -->
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

const bellIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5a4 4 0 0 1 4 4v3.5l1.5 1.5v.5H6v-.5L7.5 12.5V9a4 4 0 0 1 4-4Z" stroke="currentColor" stroke-width="1.7"/></svg>'

const currentTitle = computed(() => route.meta.title || 'ShellTennis PH')
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
:root {
  --green: #00c853;
  --green-soft: rgba(0, 200, 83, 0.05);

  --text: #0f1720;
  --muted: #7b8794;

  --border: rgba(0, 0, 0, 0.05);
}

/* LAYOUT */
.layout {
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
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 28px;
  box-shadow: 4px 0 18px rgba(0, 0, 0, 0.04);
  z-index: 30;
}

.logo {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-mark {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: linear-gradient(135deg, #00c853, #4cd964);
  display: flex;
  align-items: center;
  justify-content: center;
}

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
  color: var(--muted);
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
  color: var(--text);
}

.nav-link.active {
  background: var(--green-soft);
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

/* HEADER */
.header {
  position: sticky;
  top: 0;
  background: #fff;
  border-bottom: 1px solid var(--border);
  padding: 18px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 10;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.035);
}

.header-left h1 {
  font-size: 19px;
  font-weight: 600;
}

.header-left p {
  font-size: 12.5px;
  color: var(--muted);
  margin-top: 2px;
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
  color: var(--text);
}

/* CONTENT */
.content {
  padding: 32px;
}
</style>
