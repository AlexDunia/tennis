<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar__brand">
        <RouterLink to="/dashboard" class="sidebar__logo">
          <span class="sidebar__logo-mark" aria-hidden="true">
            <span class="sidebar__logo-arc sidebar__logo-arc--accent"></span>
            <span class="sidebar__logo-arc sidebar__logo-arc--warm"></span>
          </span>
          <span>
            <span class="sidebar__logo-text">ShellTennis</span>
            <span class="sidebar__logo-copy">PH ladder workspace</span>
          </span>
        </RouterLink>
      </div>

      <nav class="sidebar__nav">
        <RouterLink
          v-for="item in navigationItems"
          :key="item.to"
          :to="item.to"
          class="sidebar__link"
        >
          <span class="sidebar__icon" aria-hidden="true" v-html="item.icon"></span>
          <span class="sidebar__link-copy">
            <span class="sidebar__label">{{ item.label }}</span>
          </span>
        </RouterLink>
      </nav>
    </aside>

    <div class="shell">
      <header class="page-header">
        <div class="page-header__copy">
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
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()

const navigationItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    hint: 'Overview and priority actions',
    icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  },
  {
    to: '/rankings',
    label: 'Rankings',
    hint: 'Ladder positions and records',
    icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 18V9M12 18V5M17 18v-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 20h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  },
  {
    to: '/challenges',
    label: 'Challenges',
    hint: 'Manage accepts and reviews',
    icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.6"/></svg>',
  },
]

const currentTitle = computed(() => route.meta.title || 'ShellTennis PH')
const currentSubtitle = computed(
  () => route.meta.subtitle || 'Manage the ladder from one calm workspace.',
)
const currentSection = computed(() => {
  if (route.name === 'PlayMatch') {
    return 'Live Match'
  }

  return 'ShellTennis PH'
})
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 270px minmax(0, 1fr);
  background: var(--color-bg);
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
  background: var(--color-dark);
  border-right: 1px solid var(--color-border);
}

.sidebar__brand {
  padding: 0.25rem 0.35rem 0.75rem;
}

.sidebar__logo {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.sidebar__logo-mark {
  position: relative;
  width: 2.5rem;
  height: 2.5rem;
}

.sidebar__logo-arc {
  position: absolute;
  border-radius: 999px;
}

.sidebar__logo-arc--accent {
  inset: 0.15rem auto auto 0;
  width: 1.8rem;
  height: 1.8rem;
  border: 0.34rem solid var(--color-accent);
  border-right-color: transparent;
  border-bottom-color: transparent;
  transform: rotate(-18deg);
}

.sidebar__logo-arc--warm {
  right: 0;
  bottom: 0.2rem;
  width: 1.25rem;
  height: 1.25rem;
  border: 0.32rem solid var(--color-clay);
  border-left-color: transparent;
  border-top-color: transparent;
  transform: rotate(12deg);
}

.sidebar__logo-text,
.sidebar__logo-copy {
  display: block;
  color: var(--color-light);
}

.sidebar__nav {
  display: grid;
  gap: 0.375rem;
}

.sidebar__link {
  display: grid;
  grid-template-columns: 2.35rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
  padding: 0 12px;
  min-height: 40px;
  border-radius: 0.5rem;
  color: var(--color-light);
  border: 1px solid transparent;
  transition:
    background 0.12s ease-in-out,
    border-color 0.12s ease-in-out,
    color 0.12s ease-in-out;
}

.sidebar__link.router-link-active,
.sidebar__link:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--color-light);
}

.sidebar__icon {
  width: 2.35rem;
  height: 2.35rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--color-light);
}

.sidebar__link.router-link-active .sidebar__icon {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.sidebar__icon :deep(svg) {
  width: 1.1rem;
  height: 1.1rem;
}

.sidebar__link-copy {
  display: grid;
  gap: 0.08rem;
}

.sidebar__label {
  font-weight: 700;
  font-size: 0.94rem;
}

.sidebar__hint {
  color: var(--color-muted);
  font-size: 0.8rem;
}

.sidebar__footer {
  margin-top: auto;
  display: grid;
  gap: 0.7rem;
}

.sidebar__footer-label {
  margin: 0;
  padding: 0 0.35rem;
  color: var(--color-muted);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sidebar__cta {
  display: grid;
  gap: 0.25rem;
  padding: 1rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, rgba(255, 211, 61, 0.16), rgba(255, 127, 50, 0.12));
  border: 1px solid rgba(255, 127, 50, 0.16);
}

.sidebar__cta-title {
  font-size: 0.95rem;
  font-weight: 700;
}

.sidebar__cta-copy {
  color: var(--color-text-soft);
  font-size: 0.84rem;
}

.shell {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--color-bg);
}

.page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.4rem 1.75rem;
  background: #ffffff;
  border-bottom: 1px solid var(--color-border);
}

.page-header__copy {
  min-width: 0;
}

.page-header__title {
  margin: 0;
  font-size: clamp(1.55rem, 2vw, 1.95rem);
  line-height: 1.15;
  letter-spacing: -0.04em;
}

.page-header__subtitle {
  max-width: 44rem;
  margin: 0.5rem 0 0;
  color: var(--color-muted);
  font-size: 0.95rem;
}

.layout__main {
  min-width: 0;
  padding: 1.5rem 0 2rem;
  background: var(--color-bg);
}

.container {
  width: min(1180px, calc(100% - 2rem));
}

@media (max-width: 1120px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: relative;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }

  .sidebar__nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .sidebar__footer {
    margin-top: 0;
  }
}

@media (max-width: 760px) {
  .sidebar {
    padding: 1rem;
  }

  .sidebar__nav {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
    align-items: start;
    padding: 1.1rem 1rem;
  }

  .page-header__meta {
    justify-content: start;
  }

  .layout__main {
    padding-top: 1rem;
  }

  .container {
    width: min(100%, calc(100% - 1rem));
  }
}
</style>
