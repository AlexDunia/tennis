<script setup>
// IMPORTS
import { computed } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

// PROPS
// none

// EMITS
// none

// ROUTER / ROUTE
const router = useRouter()
const route = useRoute()

// STORES
const authStore = useAuthStore()

// REACTIVE STATE
const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Book Court', to: '/book' },
  { label: 'Matches', to: '/matches' },
]

// COMPUTED PROPERTIES
const isAuthenticated = computed(() => authStore.isAuthenticated)
const actionLabel = computed(() => (isAuthenticated.value ? 'Log out' : 'Log in'))
const activePath = computed(() => route.path)

// METHODS
function handleAuthAction() {
  if (isAuthenticated.value) {
    authStore.logout()
    router.push('/login')
    return
  }
  router.push('/login')
}

// WATCHERS
// none

// LIFECYCLE HOOKS
// none
</script>

<template>
  <header class="navbar">
    <div class="navbar__brand">
      <RouterLink class="navbar__logo" to="/">ShellTennis PH</RouterLink>
      <p class="navbar__tagline">Port Harcourt Team Court</p>
    </div>
    <nav class="navbar__links">
      <RouterLink
        v-for="link in navLinks"
        :key="link.to"
        class="navbar__link"
        :class="{ 'navbar__link--active': activePath === link.to }"
        :to="link.to"
      >
        {{ link.label }}
      </RouterLink>
    </nav>
    <div class="navbar__actions">
      <button class="navbar__cta" type="button" @click="handleAuthAction">
        {{ actionLabel }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: #ffffff;
  border-bottom: 4px solid rgba(245, 158, 11, 0.9);
}
.navbar__brand {
  display: flex;
  flex-direction: column;
}
.navbar__logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: #ffffff;
  text-decoration: none;
}
.navbar__tagline {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
}
.navbar__links {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}
.navbar__link {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
  text-decoration: none;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}
.navbar__link--active,
.navbar__link:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}
.navbar__actions {
  display: flex;
  align-items: center;
}
.navbar__cta {
  background: rgba(245, 158, 11, 1);
  color: #0f172a;
  border: none;
  padding: 0.55rem 1rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 999px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.navbar__cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18);
}

@media (max-width: 720px) {
  .navbar {
    justify-content: center;
  }
  .navbar__links {
    justify-content: center;
    width: 100%;
  }
}
</style>
