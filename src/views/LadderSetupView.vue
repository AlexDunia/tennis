<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import { useAdminStore } from '../stores/admin.js'
import { useNotificationStore } from '../stores/notification.js'
import { collectClubMembers } from '../utils/club/memberData.js'
import { orderedLadderEntries } from '../services/LadderWorkspaceService.js'
import { ladderRequirementsLabel } from '../domain/ladderWorkspace.js'
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

const activeClub = computed(() => adminStore.activeClub)
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
  ladderRequirementsLabel(ladder.value?.eligibility),
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
    params: { ladderId: ladderId.value },
  })
}

function backToLadder() {
  router.push({ name: 'Rankings' })
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
          ? 'Add members'
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
  <main v-if="ready && ladder" class="ladder-workspace-page">
    <header class="ladder-workspace-page__header">
      <p class="ladder-workspace-page__eyebrow">
        {{
          step === 'members'
            ? '1 of 3 · Add members'
            : step === 'order'
              ? '2 of 3 · Starting order'
              : '3 of 3 · Start ladder'
        }}
      </p>

      <h1>
        {{
          step === 'members'
            ? `Add members to ${ladder.name}`
            : step === 'order'
              ? 'Starting order'
              : `Start ${ladder.name}`
        }}
      </h1>

      <p class="ladder-workspace-page__description">
        {{
          step === 'members'
            ? requirements
            : step === 'order'
              ? 'The admin owns the final starting positions. Move everyone into the right order before continuing.'
              : 'Review the ladder once more. Starting it makes these positions official.'
        }}
      </p>
    </header>

    <p v-if="error" class="lw-alert" role="alert">{{ error }}</p>

    <template v-if="step === 'members'">
      <section class="lw-section">
        <div class="lw-section__heading">
          <h2>Club members</h2>
          <p>
            Select existing people. GORRA reuses their profile instead of
            creating another person.
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
          Every current club member is already in this ladder, or the club does
          not have members yet.
        </p>
      </section>

      <section class="lw-section">
        <div class="lw-section__heading">
          <h2>Bring people in another way</h2>
        </div>

        <div class="lw-summary-row">
          <div>
            <strong>Share ladder invite</strong>
            <small>
              The link knows this ladder’s eligibility rules and asks only for
              missing information.
            </small>
          </div>

          <BaseButton
            variant="secondary"
            :disabled="busy"
            @click="makeInvite"
          >
            {{ inviteUrl ? 'New link' : 'Create link' }}
          </BaseButton>
        </div>

        <div v-if="inviteUrl" class="lw-field">
          <span>Invite link</span>
          <input
            :value="inviteUrl"
            readonly
            @focus="$event.target.select()"
          />
          <BaseButton variant="secondary" @click="copyInvite">
            Copy link
          </BaseButton>
        </div>

        <div class="lw-summary-row">
          <div>
            <strong>Import ladder</strong>
            <small>
              Upload names, emails and current positions. Existing club members
              are reused.
            </small>
          </div>

          <BaseButton variant="secondary" @click="openImport">
            Import
          </BaseButton>
        </div>
      </section>

      <footer class="lw-footer">
        <BaseButton variant="secondary" @click="backToLadder">
          Back
        </BaseButton>

        <BaseButton :disabled="busy" @click="addMembers">
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
          <h2>Starting order</h2>
          <p>
            The arrow controls work on keyboard, touch and slow devices. No
            drag-and-drop library is required.
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
          @click="
            router.push({
              name: 'LadderSetup',
              params: { ladderId, step: 'members' },
            })
          "
        >
          Back
        </BaseButton>

        <BaseButton :disabled="busy" @click="saveOrder">
          Save & continue
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
