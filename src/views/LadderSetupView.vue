<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useAdminStore } from '../stores/admin.js'
import { useNotificationStore } from '../stores/notification.js'
import { collectClubMembers } from '../utils/club/memberData.js'
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
const inviteUrl = ref('')
const selected = ref(new Set())
const order = ref([])
const memberPickerOpen = ref(false)
const invitePanelOpen = ref(false)

const activeClub = computed(() => adminStore.activeClub)
const clubName = computed(() => activeClub.value?.name || 'this club')
const ladderId = computed(() => String(route.params.ladderId || ''))

const step = computed(() => {
  const value = String(route.params.step || '')
  return ['members', 'order', 'start'].includes(value) ? value : 'members'
})

const ladder = computed(
  () =>
    activeClub.value?.setup?.ladders?.find(
      (item) => item.id === ladderId.value && !item.archived,
    ) || null,
)

const clubMembers = computed(() =>
  collectClubMembers(activeClub.value?.setup || {}),
)

const existingEntryIds = computed(
  () => new Set((ladder.value?.entries || []).map((entry) => entry.memberId)),
)

const availableMembers = computed(() =>
  clubMembers.value.filter(
    (member) => !existingEntryIds.value.has(member.id),
  ),
)

const ladderMembers = computed(() =>
  orderedLadderEntries(activeClub.value?.setup || {}, ladderId.value),
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

function memberMeta(member) {
  return member.email || member.phone || 'Club member'
}

function toggle(memberId) {
  const next = new Set(selected.value)
  if (next.has(memberId)) next.delete(memberId)
  else next.add(memberId)
  selected.value = next
}

function toggleMemberPicker() {
  memberPickerOpen.value = !memberPickerOpen.value

  if (memberPickerOpen.value) {
    invitePanelOpen.value = false
  }
}

async function openInvitePanel() {
  memberPickerOpen.value = false
  invitePanelOpen.value = true

  if (!inviteUrl.value) {
    await makeInvite()
  }
}

function move(index, offset) {
  const target = index + offset
  if (target < 0 || target >= order.value.length) return

  const next = [...order.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  order.value = next
}

function syncOrder() {
  order.value = ladderMembers.value.map((entry) => entry.memberId)
}

async function addMembers() {
  if (busy.value) return

  if (!selected.value.size) {
    await goToOrder()
    return
  }

  busy.value = true
  error.value = ''

  try {
    await adminStore.addLadderMembers(
      ladderId.value,
      [...selected.value],
    )

    selected.value = new Set()
    await adminStore.loadClubs()
    syncOrder()

    await router.push({
      name: 'LadderSetup',
      params: {
        ladderId: ladderId.value,
        step: 'order',
      },
    })
  } catch (saveError) {
    error.value = saveError?.message || 'Unable to add these members.'
  } finally {
    busy.value = false
  }
}

async function goToOrder() {
  syncOrder()

  await router.push({
    name: 'LadderSetup',
    params: {
      ladderId: ladderId.value,
      step: 'order',
    },
  })
}

async function saveOrder() {
  if (busy.value) return

  if (!order.value.length) {
    error.value = 'Add at least one ladder member first.'
    return
  }

  busy.value = true
  error.value = ''

  try {
    await adminStore.saveLadderOrder(ladderId.value, order.value)
    await adminStore.loadClubs()

    /*
     * Importing into an already-active ladder should not make the admin
     * "start" the ladder again as a separate screen. Saving the reviewed
     * order finalizes the imported order and returns to the same Ladder.
     */
    if (activeImportReview.value) {
      const result = await adminStore.startLadder(ladderId.value)

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
    error.value = saveError?.message || 'Unable to save this order.'
  } finally {
    busy.value = false
  }
}

async function start() {
  if (busy.value) return

  busy.value = true
  error.value = ''

  try {
    const result = await adminStore.startLadder(ladderId.value)

    notificationStore.addToast({
      title: 'Ladder started',
      message: `${result.ladder.name} is live.`,
      type: 'success',
    })

    await router.push({
      name: 'Rankings',
      query: { ladder: result.ladder.id },
    })
  } catch (startError) {
    error.value = startError?.message || 'Unable to start this ladder.'
  } finally {
    busy.value = false
  }
}

async function makeInvite() {
  if (busy.value) return

  busy.value = true
  error.value = ''

  try {
    const invite = await adminStore.rotateLadderInvite(ladderId.value)

    const href = router.resolve({
      name: 'LadderInvite',
      params: { token: invite.token },
    }).href

    inviteUrl.value = new URL(href, window.location.origin).toString()
  } catch (inviteError) {
    error.value = inviteError?.message || 'Unable to make this invite.'
  } finally {
    busy.value = false
  }
}

async function copyInvite() {
  if (!inviteUrl.value) return

  try {
    await navigator.clipboard.writeText(inviteUrl.value)

    notificationStore.addToast({
      title: 'Invite copied',
      message: 'Anyone with this link can request to join this ladder.',
      type: 'success',
    })
  } catch {
    notificationStore.addToast({
      title: 'Copy the link',
      message: inviteUrl.value,
      type: 'info',
    })
  }
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

useShellNestedHeader(() => ({
  label: ladder.value?.name || 'Ladder setup',
  backLabel: 'Back to ladder',
  back: backToLadder,
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
    if (step.value === 'order') syncOrder()
  },
  { deep: true },
)

onMounted(async () => {
  try {
    if (!adminStore.activeClub) await adminStore.loadClubs()

    if (!adminStore.hasActiveClubPermission('club.manage')) {
      await router.replace({ name: 'Rankings' })
      return
    }

    if (!ladder.value) {
      error.value = 'This ladder could not be found.'
      return
    }

    syncOrder()
  } catch (loadError) {
    error.value = loadError?.message || 'Unable to open this ladder setup.'
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
            ? '1 of 3 · Add people'
            : step === 'order'
              ? '2 of 3 · Starting order'
              : '3 of 3 · Start ladder'
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
                ? 'Make sure everyone is in the right order before you apply the import.'
                : 'Put everyone in the right starting order before continuing.'
              : 'Review the ladder once more. Starting it makes these positions official.'
        }}
      </p>
    </header>

    <p v-if="error" class="lw-alert" role="alert">{{ error }}</p>

    <template v-if="step === 'members'">
      <section class="lw-section">
        <div class="ref-section-heading">
          <h2>Add people</h2>
          <p>Choose the quickest way to add players to this ladder.</p>
        </div>

        <div class="ref-choice-stack">
          <button
            class="ref-choice-row"
            type="button"
            :aria-expanded="memberPickerOpen"
            @click="toggleMemberPicker"
          >
            <span class="ref-feature-icon" aria-hidden="true">
              <FlowIcon name="users" />
            </span>

            <span class="ref-choice-row-copy">
              <strong>Choose club members</strong>
              <span>Pick people already in {{ clubName }}.</span>
            </span>

            <FlowIcon name="arrow-right" />
          </button>

          <button
            class="ref-choice-row"
            type="button"
            :aria-expanded="invitePanelOpen"
            :disabled="busy"
            @click="openInvitePanel"
          >
            <span class="ref-feature-icon" aria-hidden="true">
              <FlowIcon name="send" />
            </span>

            <span class="ref-choice-row-copy">
              <strong>Share ladder invite</strong>
              <span>Copy one link for players to request to join {{ ladder.name }}.</span>
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
              <span>Upload the player list and current order from CSV or Excel.</span>
            </span>

            <FlowIcon name="arrow-right" />
          </button>
        </div>
      </section>

      <section v-if="memberPickerOpen" class="lw-section">
        <div class="lw-section__heading">
          <h2>Club members</h2>
          <p>
            Select the people you want on {{ ladder.name }}. Their existing
            club profiles are reused.
          </p>
        </div>

        <div v-if="availableMembers.length" class="lw-list">
          <label
            v-for="member in availableMembers"
            :key="member.id"
            class="lw-list-row"
          >
            <input
              type="checkbox"
              :checked="selected.has(member.id)"
              @change="toggle(member.id)"
            />

            <span>
              <strong>{{ member.name }}</strong>
              <small>{{ memberMeta(member) }}</small>
            </span>

            <PersonAvatar
              :name="member.name || 'Member'"
              :image="member.photoUrl || ''"
              :size="36"
            />
          </label>
        </div>

        <p v-else class="lw-success">
          There are no other club members to add right now. You can share the
          ladder invite or bring your ladder list instead.
        </p>
      </section>

      <section v-if="invitePanelOpen" class="lw-section">
        <div class="lw-section__heading">
          <h2>Share ladder invite</h2>
          <p>
            Players who use this link join this ladder. GORRA applies the
            ladder requirements automatically.
          </p>
        </div>

        <div v-if="inviteUrl" class="lw-field">
          <span>Invite link</span>
          <input
            :value="inviteUrl"
            readonly
            @focus="$event.target.select()"
          />

          <div class="lw-inline-actions">
            <BaseButton variant="secondary" @click="copyInvite">
              Copy link
            </BaseButton>

            <BaseButton
              variant="secondary"
              :disabled="busy"
              @click="makeInvite"
            >
              Make new link
            </BaseButton>
          </div>
        </div>

        <p v-else-if="busy" class="ladder-workspace-page__description">
          Making the invite…
        </p>
      </section>

      <footer class="lw-footer">
        <BaseButton variant="secondary" @click="backToLadder">
          Back
        </BaseButton>

        <BaseButton
          :disabled="
            busy ||
            (!selected.size && !ladderMembers.length)
          "
          @click="addMembers"
        >
          {{
            selected.size
              ? `Add ${selected.size} & continue`
              : 'Continue'
          }}
        </BaseButton>
      </footer>
    </template>

    <template v-else-if="step === 'order'">
      <section class="lw-section">
        <div class="lw-section__heading">
          <h2>{{ importedReview ? 'Player order' : 'Starting order' }}</h2>
          <p>
            {{
              importedReview
                ? 'Use the arrows only if something needs correcting.'
                : 'Use the arrows to put each player in the right starting position.'
            }}
          </p>
        </div>

        <div class="lw-list">
          <article
            v-for="(memberId, index) in order"
            :key="memberId"
            class="lw-list-row"
          >
            <span class="lw-order-number">{{ index + 1 }}</span>

            <span>
              <strong>
                {{
                  ladderMembers.find(
                    (entry) => entry.memberId === memberId,
                  )?.member?.name || 'Club member'
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
                ↑
              </button>
              <button
                type="button"
                :disabled="index === order.length - 1"
                aria-label="Move down"
                @click="move(index, 1)"
              >
                ↓
              </button>
            </span>
          </article>
        </div>
      </section>

      <footer class="lw-footer">
        <BaseButton
          variant="secondary"
          @click="backFromOrder"
        >
          Back
        </BaseButton>

        <BaseButton :disabled="busy" @click="saveOrder">
          {{
            busy
              ? 'Saving…'
              : activeImportReview
                ? 'Apply order'
                : 'Save & continue'
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
            {{ ladderMembers.length === 1 ? 'player' : 'players' }}
          </span>
        </div>

        <div class="lw-list">
          <article
            v-for="(entry, index) in ladderMembers"
            :key="entry.memberId"
            class="lw-list-row"
          >
            <span class="lw-order-number">{{ index + 1 }}</span>
            <span>
              <strong>{{ entry.member.name }}</strong>
              <small>Starting at #{{ index + 1 }}</small>
            </span>
          </article>
        </div>
      </section>

      <footer class="lw-footer">
        <BaseButton
          variant="secondary"
          @click="
            router.push({
              name: 'LadderSetup',
              params: { ladderId, step: 'order' },
            })
          "
        >
          Back
        </BaseButton>

        <BaseButton :disabled="busy" @click="start">
          {{ busy ? 'Starting…' : 'Start ladder' }}
        </BaseButton>
      </footer>
    </template>
  </main>
</template>
