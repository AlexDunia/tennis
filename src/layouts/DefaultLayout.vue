```vue
<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar__brand">
        <RouterLink to="/dashboard" class="sidebar__logo">
          <img
            src="https://res.cloudinary.com/dnuhjsckk/image/upload/v1776503502/RENAISSANCE-AFRICA-ENERGY-LOGO-update_s4eb9u.png"
            alt="Renaissance Africa Energy logo"
            class="sidebar__logo-image"
          />
        </RouterLink>
      </div>

      <!-- NAV -->
      <nav class="sidebar__nav">
        <RouterLink
          v-for="item in navigationItems"
          :key="item.to"
          :to="item.to"
          class="sidebar__link"
        >
          <span class="sidebar__icon" v-html="item.icon"></span>
          <span class="sidebar__label">{{ item.label }}</span>
        </RouterLink>

        <RouterLink to="/notifications" class="sidebar__link">
          <span class="sidebar__icon" v-html="bellIcon"></span>
          <span class="sidebar__label">Notifications</span>
          <span v-if="unreadCount" class="sidebar__badge">{{ unreadCount }}</span>
        </RouterLink>
      </nav>

      <!-- FOOTER -->
      <div class="sidebar__footer">
        <button class="sidebar__logout" @click="handleLogout">
          <span class="sidebar__icon" v-html="logoutIcon"></span>
          <span>Logout</span>
        </button>
      </div>
    </aside>

    <div class="shell">
      <header class="page-header">
        <div>
          <h1 class="page-header__title">{{ currentTitle }}</h1>
          <p class="page-header__subtitle">{{ currentSubtitle }}</p>
        </div>
      </header>

      <main class="layout__main">
        <div class="container">
          <RouterView />
        </div>
      </main>
    </div>
  </div>

  <ToastShelf />
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useNotificationStore } from '../stores/notification'
import ToastShelf from '../components/ToastShelf.vue'

const route = useRoute()
const notificationStore = useNotificationStore()

const navigationItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="3" width="7" height="4" rx="2" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="9" width="7" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="12" width="7" height="9" rx="2" stroke="currentColor" stroke-width="1.6"/></svg>',
  },
  {
    to: '/rankings',
    label: 'Rankings',
    icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 18V10M12 18V6M18 18v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 20h16" stroke="currentColor" stroke-width="1.6"/></svg>',
  },
  {
    to: '/challenges',
    label: 'Challenges',
    icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3c3 4 3 14 0 18" stroke="currentColor" stroke-width="1.4"/></svg>',
  },
]

const bellIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5a4 4 0 0 1 4 4v3.5l1.5 1.5v.5H6v-.5L7.5 12.5V9a4 4 0 0 1 4-4Z" stroke="currentColor" stroke-width="1.7"/></svg>'

const logoutIcon =
  '<svg viewBox="0 0 24 24" fill="none"><path d="M10 17l5-5-5-5" stroke="currentColor" stroke-width="1.8"/><path d="M15 12H3" stroke="currentColor" stroke-width="1.8"/><path d="M21 21V3" stroke="currentColor" stroke-width="1.4"/></svg>'

const currentTitle = computed(() => route.meta.title || 'ShellTennis PH')
const currentSubtitle = computed(
  () => route.meta.subtitle || 'Manage the ladder from one calm workspace.',
)

const unreadCount = computed(() => notificationStore.unreadCount)

function handleLogout() {
  alert('Logout logic here')
}
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
}

/* SIDEBAR */
.sidebar {
  height: 100vh;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem;

  background: #ffffff;

  /* 🔥 subtle premium shadow */
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.04);
}

.sidebar__logo-image {
  width: 130px;
}

/* NAV */
.sidebar__nav {
  margin-top: 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 8px; /* 🔥 more breathing space */
}

/* LINK */
.sidebar__link {
  display: flex;
  align-items: center;
  gap: 12px;

  padding: 10px 14px;
  border-radius: 12px;

  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 500;

  color: #2c2c2c;
  text-decoration: none;

  transition: all 0.2s ease;
}

/* HOVER */
.sidebar__link:hover {
  background: #f6f8f7;
  transform: translateX(3px);
}

/* ACTIVE */
.sidebar__link.router-link-active {
  background: #00b51a;
  color: #ffffff;
  font-weight: 600;
}

/* ICON */
.sidebar__icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar__icon :deep(svg) {
  width: 18px;
  height: 18px;
}

/* LABEL */
.sidebar__label {
  flex: 1;
}

/* BADGE */
.sidebar__badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #00b51a;
  color: #fff;
}

/* FOOTER */
.sidebar__footer {
  margin-top: auto;
  padding-top: 1rem;
}

.sidebar__logout {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;

  padding: 10px 14px;
  border-radius: 12px;

  background: transparent;
  border: none;
  cursor: pointer;

  font-family: 'Poppins', sans-serif;
  font-size: 14px;
  color: #444;

  transition: all 0.2s ease;
}

.sidebar__logout:hover {
  background: #f6f8f7;
}

/* CLICK FEEDBACK */
.sidebar__link:active,
.sidebar__logout:active {
  transform: scale(0.97);
}

/* MAIN */
.shell {
  display: grid;
  grid-template-rows: auto 1fr;
}

.page-header {
  padding: 1.4rem 1.75rem;
  border-bottom: 1px solid #eee;
  background: #fff;
}

.page-header__title {
  margin: 0;
  font-size: 1.6rem;
}

.page-header__subtitle {
  margin-top: 6px;
  font-size: 14px;
  color: #777;
}

.layout__main {
  padding: 1.5rem;
}

.container {
  max-width: 1180px;
  margin: 0 auto;
}
</style>
```
