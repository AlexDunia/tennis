<template>
  <div class="layout">
    <div class="layout__backdrop layout__backdrop--left"></div>
    <div class="layout__backdrop layout__backdrop--right"></div>

    <header class="topbar">
      <div class="topbar__brand">
        <RouterLink to="/dashboard" class="topbar__logo">ShellTennis PH</RouterLink>
        <p class="topbar__subtitle">Court energy, ladder pressure, Shell colors.</p>
      </div>

      <nav class="topbar__nav">
        <RouterLink to="/dashboard" class="topbar__link">Dashboard</RouterLink>
        <RouterLink to="/rankings" class="topbar__link">Rankings</RouterLink>
        <RouterLink to="/challenges" class="topbar__link">Challenges</RouterLink>
        <RouterLink to="/create-challenge" class="topbar__create">+ New Match</RouterLink>
      </nav>
    </header>

    <main class="layout__main">
      <div class="container">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<style scoped>
.layout {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

.layout__backdrop {
  position: fixed;
  width: 28rem;
  height: 28rem;
  border-radius: 50%;
  filter: blur(18px);
  opacity: 0.55;
  pointer-events: none;
}

.layout__backdrop--left {
  top: 5rem;
  left: -10rem;
  background: radial-gradient(circle, rgba(245, 198, 45, 0.7) 0%, transparent 68%);
}

.layout__backdrop--right {
  right: -8rem;
  bottom: 4rem;
  background: radial-gradient(circle, rgba(15, 107, 63, 0.44) 0%, transparent 72%);
}

.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.5rem;
  background:
    linear-gradient(120deg, rgba(255, 247, 214, 0.94), rgba(255, 241, 197, 0.88)),
    linear-gradient(90deg, rgba(217, 31, 47, 0.14), rgba(15, 107, 63, 0.12));
  border-bottom: 1px solid rgba(19, 35, 22, 0.08);
  box-shadow: 0 22px 50px rgba(83, 62, 19, 0.12);
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(14px);
}

.topbar__brand {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.topbar__logo {
  font-size: 1.6rem;
  font-weight: 900;
  color: var(--color-secondary);
  letter-spacing: -0.05em;
  text-transform: uppercase;
}

.topbar__subtitle {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.topbar__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.topbar__link {
  color: var(--color-text);
  font-weight: 700;
  padding: 0.72rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(19, 35, 22, 0.08);
  background: rgba(255, 252, 240, 0.7);
  transition:
    background 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.topbar__link.router-link-active,
.topbar__link:hover {
  background: rgba(15, 107, 63, 0.13);
  color: var(--color-primary-strong);
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(60, 47, 18, 0.1);
}

.topbar__create {
  padding: 0.8rem 1.15rem;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--color-secondary), #ef5543);
  color: #fffef7;
  font-weight: 800;
  box-shadow: 0 16px 32px rgba(159, 17, 32, 0.22);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.topbar__create:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(159, 17, 32, 0.28);
}

.layout__main {
  position: relative;
  z-index: 1;
  padding: 2rem 0 3.5rem;
}

@media (max-width: 680px) {
  .topbar {
    padding: 1rem;
  }

  .topbar__nav {
    justify-content: center;
    width: 100%;
  }

  .topbar__create {
    width: 100%;
    text-align: center;
  }
}
</style>
