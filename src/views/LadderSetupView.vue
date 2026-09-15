<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import MemberListArt from '../components/club/MemberListArt.vue'
import { useAdminStore } from '../stores/admin.js'
import { useNotificationStore } from '../stores/notification.js'
import { orderedLadderEntries } from '../services/LadderWorkspaceService.js'
import { ladderRequirementsLabel } from '../domain/ladderWorkspace.js'
import {
  LADDER_IMPORT_ORIGINS,
  ladderImportBackRoute,
  normalizeLadderImportOrigin,
} from '../utils/ladderImportNavigation.js'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import '../assets/ladder-workspace.css'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()

const ready = ref(false)
const busy = ref(false)
const error = ref('')
const order = ref([])
const addPeopleOptions = ref(null)

const activeClub = computed(() => adminStore.activeClub)
const clubName = computed(() => activeClub.value?.name || 'this club')
const ladderId = computed(() => String(route.params.ladderId || ''))

const step = computed(() => {
  const value = String(route.params.step || '')
  return ['members', 'order', 'start'].includes(value)
    ? value
    : 'members'
})

const ladder = computed(
  () =>
    activeClub.value?.setup?.ladders?.find(
      (item) => item.id === ladderId.value && !item.archived,
    ) || null,
)

const ladderMembers = computed(() =>
  orderedLadderEntries(
    activeClub.value?.setup || {},
    ladderId.value,
  ),
)

const requirements = computed(() =>
  ladderRequirementsLabel(
    ladder.value?.eligibility,
    activeClub.value?.setup?.playerLevels?.levels || [],
  ),
)

const importedReview = computed(
  () =>
    step.value === 'order' &&
    String(route.query.from || '') === 'import',
)

const importReturnOrigin = computed(() =>
  normalizeLadderImportOrigin(
    String(route.query.returnTo || ''),
  ),
)

const activeImportReview = computed(
  () =>
    importedReview.value &&
    importReturnOrigin.value === LADDER_IMPORT_ORIGINS.LADDER &&
    ladder.value?.status === 'active',
)

function syncOrder() {
  order.value =
    ladderMembers.value.map((entry) => entry.memberId)
}

function move(index, offset) {
  const target = index + offset

  if (target < 0 || target >= order.value.length) return

  const next = [...order.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  order.value = next
}

function scrollToAddPeopleOptions() {
  addPeopleOptions.value?.scrollIntoView({
    behavior:
      typeof window !== 'undefined' &&
      window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      )?.matches
        ? 'auto'
        : 'smooth',
    block: 'start',
  })
}

function openClubMembers() {
  router.push({
    name: 'LadderAddClubMembers',
    params: {
      ladderId: ladderId.value,
    },
  })
}

function openInvite() {
  router.push({
    name: 'LadderShareInvite',
    params: {
      ladderId: ladderId.value,
    },
  })
}

function openImport() {
  router.push({
    name: 'LadderImport',
    params: {
      ladderId: ladderId.value,
    },
    query: {
      from: 'setup-members',
    },
  })
}

function backToLadder() {
  router.push({
    name: 'Rankings',
    query: {
      ladder: ladderId.value,
    },
  })
}

async function goToOrder() {
  if (!ladderMembers.value.length) return

  syncOrder()

  await router.push({
    name: 'LadderSetup',
    params: {
      ladderId: ladderId.value,
      step: 'order',
    },
  })
}

function backFromOrder() {
  if (importedReview.value) {
    router.push(
      ladderImportBackRoute({
        origin: importReturnOrigin.value,
        ladderId: ladderId.value,
      }),
    )
    return
  }

  router.push({
    name: 'LadderSetup',
    params: {
      ladderId: ladderId.value,
      step: 'members',
    },
  })
}

async function saveOrder() {
  if (busy.value) return

  if (!order.value.length) {
    error.value = 'Add at least one Ladder player first.'
    return
  }

  busy.value = true
  error.value = ''

  try {
    await adminStore.saveLadderOrder(
      ladderId.value,
      order.value,
    )

    await adminStore.loadClubs()

    if (activeImportReview.value) {
      const result =
        await adminStore.startLadder(
          ladderId.value,
        )

      notificationStore.addToast({
        title: 'Ladder order updated',
        message: `${result.ladder.name} now uses the reviewed order.`,
        type: 'success',
      })

      await router.push({
        name: 'Rankings',
        query: {
          ladder: result.ladder.id,
        },
      })

      return
    }

    await router.push({
      name: 'LadderSetup',
      params: {
        ladderId: ladderId.value,
        step: 'start',
      },
    })
  } catch (saveError) {
    error.value =
      saveError?.message ||
      'Unable to save this order.'
  } finally {
    busy.value = false
  }
}

async function start() {
  if (busy.value) return

  busy.value = true
  error.value = ''

  try {
    const result =
      await adminStore.startLadder(
        ladderId.value,
      )

    notificationStore.addToast({
      title: 'Ladder started',
      message: `${result.ladder.name} is live.`,
      type: 'success',
    })

    await router.push({
      name: 'Rankings',
      query: {
        ladder: result.ladder.id,
      },
    })
  } catch (startError) {
    error.value =
      startError?.message ||
      'Unable to start this Ladder.'
  } finally {
    busy.value = false
  }
}

useShellNestedHeader(() => ({
  label: ladder.value?.name || 'Ladder setup',
  backLabel:
    step.value === 'members'
      ? 'Back to ladder'
      : step.value === 'order'
        ? 'Back'
        : 'Back',
  back:
    step.value === 'members'
      ? backToLadder
      : step.value === 'order'
        ? backFromOrder
        : () =>
            router.push({
              name: 'LadderSetup',
              params: {
                ladderId: ladderId.value,
                step: 'order',
              },
            }),
  crumbs: [
    { label: 'Ladder' },
    { label: ladder.value?.name || 'Setup' },
    {
      label:
        step.value === 'members'
          ? 'Add people'
          : step.value === 'order'
            ? 'Starting order'
            : 'Start',
    },
  ],
}))

watch(
  ladderMembers,
  () => {
    if (step.value === 'order') {
      syncOrder()
    }
  },
  { deep: true },
)

onMounted(async () => {
  try {
    if (!adminStore.activeClub) {
      await adminStore.loadClubs()
    }

    if (!adminStore.hasActiveClubPermission('club.manage')) {
      await router.replace({ name: 'Rankings' })
      return
    }

    if (!ladder.value) {
      error.value = 'This Ladder could not be found.'
      return
    }

    syncOrder()
  } catch (loadError) {
    error.value =
      loadError?.message ||
      'Unable to open this Ladder setup.'
  } finally {
    ready.value = true
  }
})
</script>

<template>
  <main
    v-if="ready && ladder"
    class="ladder-workspace-page gorra-club-ref"
  >
    <header class="ladder-workspace-page__header">
      <p class="ladder-workspace-page__eyebrow">
        {{
          step === 'members'
            ? '1 of 3 / Add people'
            : step === 'order'
              ? '2 of 3 / Starting order'
              : '3 of 3 / Start Ladder'
        }}
      </p>

      <h1>
        {{
          step === 'members'
            ? `Add people to ${ladder.name}`
            : step === 'order'
              ? importedReview
                ? 'Review imported order'
                : 'Starting order'
              : `Start ${ladder.name}`
        }}
      </h1>

      <p class="ladder-workspace-page__description">
        {{
          step === 'members'
            ? requirements
            : step === 'order'
              ? importedReview
                ? 'Check the order before you continue.'
                : 'Put everyone in the right starting order.'
              : 'Review the starting order, then make the Ladder live.'
        }}
      </p>
    </header>

    <p v-if="error" class="lw-alert" role="alert">
      {{ error }}
    </p>

    <template v-if="step === 'members'">
      <section
        v-if="!ladderMembers.length"
        class="lw-ladder-people-zero"
        aria-label="No players on this Ladder"
      >
        <MemberListArt variant="members" />

        <div class="lw-ladder-people-zero__copy">
          <h2>No players on {{ ladder.name }} yet</h2>
          <p>
            Add the first players when you are ready.
          </p>
        </div>

        <button
          class="ref-button primary"
          type="button"
          @click="scrollToAddPeopleOptions"
        >
          <FlowIcon name="plus" />
          Add people
        </button>
      </section>

      <section
        ref="addPeopleOptions"
        class="lw-section lw-add-people-options"
      >
        <div class="ref-section-heading">
          <h2>
            {{
              ladderMembers.length
                ? 'Add more people'
                : 'Add people'
            }}
          </h2>

          <p>
            Choose the quickest way to bring players into this Ladder.
          </p>
        </div>

        <div class="ref-choice-stack">
          <button
            class="ref-choice-row"
            type="button"
            @click="openClubMembers"
          >
            <span class="ref-feature-icon" aria-hidden="true">
              <FlowIcon name="users" />
            </span>

            <span class="ref-choice-row-copy">
              <strong>Choose club members</strong>
              <span>
                Pick people already in {{ clubName }}.
              </span>
            </span>

            <FlowIcon name="arrow-right" />
          </button>

          <button
            class="ref-choice-row"
            type="button"
            @click="openInvite"
          >
            <span class="ref-feature-icon" aria-hidden="true">
              <FlowIcon name="send" />
            </span>

            <span class="ref-choice-row-copy">
              <strong>Share ladder invite</strong>
              <span>
                Copy one link for players to request to join.
              </span>
            </span>

            <FlowIcon name="arrow-right" />
          </button>

          <button
            class="ref-choice-row"
            type="button"
            @click="openImport"
          >
            <span class="ref-feature-icon" aria-hidden="true">
              <FlowIcon name="upload" />
            </span>

            <span class="ref-choice-row-copy">
              <strong>Bring your ladder list</strong>
              <span>
                Upload the player list and current order your club already uses.
              </span>
            </span>

            <FlowIcon name="arrow-right" />
          </button>
        </div>
      </section>

      <footer
        v-if="ladderMembers.length"
        class="lw-footer"
      >
        <BaseButton @click="goToOrder">
          Continue to starting order
        </BaseButton>
      </footer>
    </template>

    <template v-else-if="step === 'order'">
      <section class="lw-section">
        <div class="lw-section__heading">
          <h2>
            {{
              importedReview
                ? 'Player order'
                : 'Starting order'
            }}
          </h2>

          <p>
            Use the arrows only where the order needs changing.
          </p>
        </div>

        <div class="lw-list">
          <article
            v-for="(memberId, index) in order"
            :key="memberId"
            class="lw-list-row"
          >
            <span class="lw-order-number">
              {{ index + 1 }}
            </span>

            <span>
              <strong>
                {{
                  ladderMembers.find(
                    (entry) =>
                      entry.memberId === memberId,
                  )?.member?.name ||
                  'Club member'
                }}
              </strong>
            </span>

            <span class="lw-order-actions">
              <button
                type="button"
                :disabled="index === 0"
                aria-label="Move up"
                @click="move(index, -1)"
              >
                â†‘
              </button>

              <button
                type="button"
                :disabled="index === order.length - 1"
                aria-label="Move down"
                @click="move(index, 1)"
              >
                â†“
              </button>
            </span>
          </article>
        </div>
      </section>

      <footer class="lw-footer">
        <BaseButton
          :disabled="busy"
          @click="saveOrder"
        >
          {{
            busy
              ? 'Saving...'
              : activeImportReview
                ? 'Apply order'
                : 'Save and continue'
          }}
        </BaseButton>
      </footer>
    </template>

    <template v-else>
      <section class="lw-section">
        <div class="lw-summary-row">
          <div>
            <strong>{{ ladder.name }}</strong>
            <small>{{ requirements }}</small>
          </div>

          <span>
            {{ ladderMembers.length }}
            {{
              ladderMembers.length === 1
                ? 'player'
                : 'players'
            }}
          </span>
        </div>

        <div class="lw-list">
          <article
            v-for="(entry, index) in ladderMembers"
            :key="entry.memberId"
            class="lw-list-row"
          >
            <span class="lw-order-number">
              {{ index + 1 }}
            </span>

            <span>
              <strong>
                {{ entry.member.name }}
              </strong>
              <small>
                Starting at #{{ index + 1 }}
              </small>
            </span>
          </article>
        </div>
      </section>

      <footer class="lw-footer">
        <BaseButton
          :disabled="busy"
          @click="start"
        >
          {{
            busy
              ? 'Starting...'
              : 'Start Ladder'
          }}
        </BaseButton>
      </footer>
    </template>
  </main>
</template>
