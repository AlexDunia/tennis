<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useFriendlyMatchStore } from '../../stores/friendlyMatch'
import EmptyState from '../EmptyState.vue'

const router = useRouter()
const authStore = useAuthStore()
const friendlyMatchStore = useFriendlyMatchStore()

const memberName = computed(() => authStore.user?.name || 'Club Player')

function startMatch() {
  friendlyMatchStore.beginMatch()
  router.push({ name: 'FriendlyMatchType' })
}
</script>

<template>
  <section class="friendly-home" aria-labelledby="friendly-home-title">
    <header class="friendly-home__header">
      <div>
        <p>Emerald Courts</p>
        <h1 id="friendly-home-title">{{ memberName }}</h1>
      </div>
      <span class="friendly-home__badge">Premium Member</span>
    </header>

    <div
      class="friendly-home__feed"
      :class="{ 'friendly-home__feed--empty': !friendlyMatchStore.results.length }"
    >
      <div v-if="friendlyMatchStore.results.length" class="friendly-home__results">
        <article v-for="result in friendlyMatchStore.results" :key="result.id" class="friendly-home__result">
          <span class="friendly-home__result-mark" aria-hidden="true"></span>
          <div>
            <strong>{{ result.summary }}</strong>
            <small>{{ result.format }} · {{ result.matchTypeLabel || 'Friendly match' }}</small>
          </div>
        </article>
      </div>

      <EmptyState
        v-else
        compact
        variant="first-use"
        illustration="matches"
        title="No matches yet"
        description="Create a friendly match when you are ready to play."
      />

      <button type="button" class="button-primary friendly-home__create" @click="startMatch">
        + Create Match
      </button>
    </div>
  </section>
</template>

<style scoped>
.friendly-home {
  display: grid;
  width: 100%;
  min-height: 0;
  margin: 0;
  align-content: start;
  gap: 24px;
  padding: 0;
}

.friendly-home__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 22px;
  border-bottom: var(--app-hairline);
}

.friendly-home__header p,
.friendly-home__header h1 {
  margin: 0;
}

.friendly-home__header p {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
}

.friendly-home__header h1 {
  margin-top: 2px;
  color: var(--color-text);
  font-size: clamp(25px, 4vw, 34px);
  line-height: 1.15;
}

.friendly-home__badge {
  padding: 6px 10px;
  border: var(--app-hairline);
  border-radius: 999px;
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.friendly-home__feed {
  display: grid;
  min-height: 360px;
  align-content: space-between;
  gap: 26px;
  padding: clamp(24px, 5vw, 48px);
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: 0 12px 32px rgba(15, 34, 24, 0.045);
}

.friendly-home__feed :deep(.empty-state-system) {
  min-height: 220px;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.friendly-home__feed :deep(.empty-state-system__visual) {
  width: 64px;
  height: 48px;
  opacity: 0.76;
}

.friendly-home__feed--empty {
  border: 0;
  box-shadow: none;
}

.friendly-home__empty {
  display: grid;
  align-self: center;
  justify-items: center;
  gap: 12px;
  padding: 70px 20px 30px;
  opacity: 0.58;
}

.friendly-home__empty-mark {
  position: relative;
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
}

.friendly-home__empty-mark::before,
.friendly-home__empty-mark::after,
.friendly-home__empty-mark i {
  content: '';
  display: block;
  border-radius: 50%;
  background: var(--color-primary-strong);
}

.friendly-home__empty-mark::before { width: 8px; height: 8px; opacity: 0.42; }
.friendly-home__empty-mark::after { position: absolute; width: 3px; height: 3px; transform: translate(11px, -9px); opacity: 0.28; }
.friendly-home__empty-mark i { position: absolute; width: 4px; height: 4px; transform: translate(-10px, 10px); opacity: 0.24; }

.friendly-home__empty p {
  margin: 0;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 600;
}

.friendly-home__results {
  display: grid;
  align-content: start;
}

.friendly-home__result {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  align-items: center;
  gap: 13px;
  min-height: 68px;
  padding: 13px 0;
  border-bottom: var(--app-hairline);
}

.friendly-home__result-mark {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  opacity: 0.54;
}

.friendly-home__result strong,
.friendly-home__result small {
  display: block;
}

.friendly-home__result strong {
  color: var(--color-text-soft);
  font-size: 13px;
  line-height: 1.45;
}

.friendly-home__result small {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: 11px;
  opacity: 0.72;
}

.friendly-home__create {
  width: min(220px, 100%);
  min-height: 48px;
  justify-self: center;
}

@media (max-width: 560px) {
  .friendly-home {
    gap: 20px;
  }

  .friendly-home__header {
    align-items: center;
  }

  .friendly-home__feed {
    min-height: 340px;
    padding: 22px 18px;
  }

  .friendly-home__empty {
    padding-top: 60px;
  }

  .friendly-home__create {
    width: 100%;
  }
}
</style>
