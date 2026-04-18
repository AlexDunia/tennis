<template>
  <div class="layout">
    <div class="layout__backdrop layout__backdrop--left"></div>
    <div class="layout__backdrop layout__backdrop--right"></div>

    <aside class="sidebar">
      <div class="sidebar__brand">
        <RouterLink to="/dashboard" class="sidebar__logo">ShellTennis PH</RouterLink>
        <p class="sidebar__tagline">Port Harcourt ladder control</p>
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
            <span class="sidebar__hint">{{ item.hint }}</span>
          </span>
        </RouterLink>
      </nav>

      <div class="sidebar__footer">
        <RouterLink to="/create-challenge" class="sidebar__cta">
          <span class="sidebar__cta-label">Create challenge</span>
          <span class="sidebar__cta-copy">Set up the next ladder move from a dedicated page.</span>
        </RouterLink>
      </div>
    </aside>

    <div class="shell">
      <header class="page-header">
        <div>
          <p class="page-header__eyebrow">{{ currentSection }}</p>
          <h1 class="page-header__title">{{ currentTitle }}</h1>
          <p class="page-header__subtitle">{{ currentSubtitle }}</p>
        </div>

        <div class="page-header__meta">
          <span class="page-header__chip">Shell ladder workspace</span>
          <span class="page-header__chip">Single court - focused flow</span>
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
    hint: 'Overview and entry points',
    icon:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  },
  {
    to: '/rankings',
    label: 'Rankings',
    hint: 'Ladder positions and records',
    icon:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M7 18V9M12 18V5M17 18v-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4 20h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  },
  {
    to: '/challenges',
    label: 'Challenges',
    hint: 'Accept, review, and manage',
    icon:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.6"/></svg>',
  },
]

const currentTitle = computed(() => route.meta.title || 'ShellTennis PH')
const currentSubtitle = computed(
  () => route.meta.subtitle || 'Manage the Port Harcourt ladder experience from one workspace.',
)
const currentSection = computed(() => {
  if (route.name === 'PlayMatch') {
    return 'Live Match'
  }

  return 'Workspace'
})
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  position: relative;
  overflow: hidden;
}

.layout__backdrop {
  position: fixed;
  width: 34rem;
  height: 34rem;
  border-radius: 50%;
  filter: blur(20px);
  opacity: 0.5;
  pointer-events: none;
}

.layout__backdrop--left {
  top: -6rem;
  left: -8rem;
  background: radial-gradient(circle, rgba(245, 198, 45, 0.52) 0%, transparent 70%);
}

.layout__backdrop--right {
  right: -10rem;
  bottom: -8rem;
  background: radial-gradient(circle, rgba(15, 107, 63, 0.34) 0%, transparent 72%);
}

.sidebar {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem 1.2rem;
  background:
    linear-gradient(180deg, rgba(18, 43, 27, 0.96), rgba(10, 32, 20, 0.98)),
    linear-gradient(160deg, rgba(217, 31, 47, 0.06), rgba(245, 198, 45, 0.05));
  border-right: 1px solid rgba(255, 248, 221, 0.08);
  box-shadow: 28px 0 60px rgba(22, 21, 16, 0.18);
}

.sidebar__brand {
  display: grid;
  gap: 0.35rem;
  padding: 0.35rem 0.3rem 1rem;
}

.sidebar__logo {
  color: #fff4ce;
  font-size: 1.35rem;
  font-weight: 900;
  letter-spacing: -0.04em;
  text-transform: uppercase;
}

.sidebar__tagline {
  margin: 0;
  color: rgba(255, 244, 206, 0.7);
  font-size: 0.92rem;
}

.sidebar__nav {
  display: grid;
  gap: 0.65rem;
}

.sidebar__link {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  gap: 0.85rem;
  align-items: center;
  padding: 0.9rem 0.95rem;
  border-radius: 1.15rem;
  color: rgba(255, 248, 221, 0.86);
  border: 1px solid transparent;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.sidebar__link.router-link-active,
.sidebar__link:hover {
  background: linear-gradient(135deg, rgba(255, 248, 221, 0.08), rgba(255, 248, 221, 0.03));
  border-color: rgba(255, 248, 221, 0.12);
  transform: translateX(2px);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.16);
}

.sidebar__icon {
  width: 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.95rem;
  color: #fff4ce;
  background: linear-gradient(135deg, rgba(217, 31, 47, 0.22), rgba(245, 198, 45, 0.16));
  border: 1px solid rgba(255, 248, 221, 0.1);
}

.sidebar__icon :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}

.sidebar__link-copy {
  display: grid;
  gap: 0.1rem;
}

.sidebar__label {
  font-weight: 800;
  color: #fff8dd;
}

.sidebar__hint {
  font-size: 0.86rem;
  color: rgba(255, 248, 221, 0.6);
}

.sidebar__footer {
  margin-top: auto;
}

.sidebar__cta {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border-radius: 1.3rem;
  background: linear-gradient(135deg, rgba(245, 198, 45, 0.18), rgba(217, 31, 47, 0.18));
  border: 1px solid rgba(255, 248, 221, 0.12);
  color: #fff8dd;
}

.sidebar__cta-label {
  font-weight: 900;
}

.sidebar__cta-copy {
  font-size: 0.9rem;
  color: rgba(255, 248, 221, 0.72);
}

.shell {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  padding: 1.35rem 1.35rem 2rem;
}

.page-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding: 1.4rem 1.45rem;
  background: rgba(255, 249, 231, 0.72);
  border: 1px solid rgba(19, 35, 22, 0.08);
  border-radius: 1.6rem;
  backdrop-filter: blur(16px);
  box-shadow: 0 18px 42px rgba(60, 47, 18, 0.12);
}

.page-header__eyebrow {
  margin: 0 0 0.3rem;
  color: var(--color-secondary);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.page-header__title {
  margin: 0;
  font-size: clamp(1.8rem, 2vw, 2.4rem);
  letter-spacing: -0.04em;
  color: var(--color-text);
}

.page-header__subtitle {
  max-width: 46rem;
  margin: 0.45rem 0 0;
  color: var(--color-muted);
}

.page-header__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 0.6rem;
}

.page-header__chip {
  padding: 0.6rem 0.85rem;
  border-radius: 999px;
  background: rgba(255, 252, 240, 0.86);
  border: 1px solid rgba(19, 35, 22, 0.08);
  color: var(--color-primary-strong);
  font-size: 0.9rem;
  font-weight: 700;
}

.layout__main {
  min-width: 0;
}

.container {
  width: min(1180px, 100%);
  margin: 0 auto;
}

@media (max-width: 1120px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: relative;
    height: auto;
    border-right: none;
    border-bottom: 1px solid rgba(255, 248, 221, 0.08);
  }

  .sidebar__nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .sidebar__footer {
    margin-top: 0;
  }
}

@media (max-width: 760px) {
  .shell {
    padding: 1rem 1rem 1.5rem;
  }

  .sidebar {
    padding: 1rem;
  }

  .sidebar__nav {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
    align-items: start;
  }

  .page-header__meta {
    justify-content: start;
  }
}
</style>
