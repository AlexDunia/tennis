<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import { useAdminStore } from '../stores/admin.js'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import '../assets/ladder-workspace.css'

const router = useRouter()
const adminStore = useAdminStore()

const ladders = computed(() =>
  adminStore.activeLadders.filter((ladder) => !ladder.archived),
)

function choose(ladder) {
  router.push({
    name: 'LadderImport',
    params: { ladderId: ladder.id },
  })
}

useShellNestedHeader(() => ({
  label: 'Import ladder',
  backLabel: 'Back to ladder',
  back: () => router.push({ name: 'Rankings' }),
  crumbs: [{ label: 'Ladder' }, { label: 'Import' }],
}))

onMounted(async () => {
  if (!adminStore.activeClub) await adminStore.loadClubs()
})
</script>

<template>
  <main class="ladder-workspace-page">
    <header class="ladder-workspace-page__header">
      <p class="ladder-workspace-page__eyebrow">Ladder</p>
      <h1>Import ladder</h1>
      <p class="ladder-workspace-page__description">
        Choose the ladder that should receive this current order, or create a
        new ladder first.
      </p>
    </header>

    <div v-if="ladders.length" class="lw-list">
      <article
        v-for="ladder in ladders"
        :key="ladder.id"
        class="lw-list-row"
      >
        <span>
          <strong>{{ ladder.name }}</strong>
          <small>
            {{
              ladder.status === 'setup'
                ? 'Setup in progress'
                : 'Active ladder'
            }}
          </small>
        </span>
        <span></span>
        <BaseButton variant="secondary" @click="choose(ladder)">
          Choose
        </BaseButton>
      </article>
    </div>

    <div v-else class="lw-summary-row">
      <div>
        <strong>No ladder yet</strong>
        <small>
          Create the ladder first, then import its members and order.
        </small>
      </div>

      <BaseButton @click="router.push({ name: 'LadderCreate' })">
        Create ladder
      </BaseButton>
    </div>
  </main>
</template>
