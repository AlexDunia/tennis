<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import { useAdminStore } from '../stores/admin.js'
import { useNotificationStore } from '../stores/notification.js'
import { collectClubMembers } from '../utils/club/memberData.js'
import {
  evaluateLadderEligibility,
  ladderRequirementsLabel,
} from '../domain/ladderWorkspace.js'
import { playerRatingSystem } from '../domain/playerRatings.js'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import '../assets/ladder-workspace.css'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()

const ready = ref(false)
const busy = ref(false)
const error = ref('')
const selected = ref(new Set())

const ladderId = computed(() => String(route.params.ladderId || ''))
const activeClub = computed(() => adminStore.activeClub)
const clubName = computed(() => activeClub.value?.name || 'this club')

const ladder = computed(
  () =>
    activeClub.value?.setup?.ladders?.find(
      (item) => item.id === ladderId.value && !item.archived,
    ) || null,
)

const members = computed(() =>
  collectClubMembers(activeClub.value?.setup || {}),
)

const existingIds = computed(
  () =>
    new Set(
      (ladder.value?.entries || []).map((entry) => entry.memberId),
    ),
)

const availableMembers = computed(() =>
  members.value.filter((member) => !existingIds.value.has(member.id)),
)

const requirements = computed(() =>
  ladderRequirementsLabel(
    ladder.value?.eligibility,
    activeClub.value?.setup?.playerLevels?.levels || [],
  ),
)

function backToAddPeople() {
  router.push({
    name: 'LadderSetup',
    params: {
      ladderId: ladderId.value,
      step: 'members',
    },
  })
}

function memberMeta(member) {
  return member.email || member.phone || 'Club member'
}

function memberEligibility(member) {
  return evaluateLadderEligibility({
    eligibility: ladder.value?.eligibility,
    profile: member,
  })
}

function canAddMember(member) {
  const result = memberEligibility(member)
  return result.complete && result.eligible
}

function eligibilityLabel(member) {
  const result = memberEligibility(member)

  if (result.complete && result.eligible) {
    return 'Eligible'
  }

  if (!result.complete) {
    const missing = result.missing || []

    if (missing.includes('rating')) {
      const system = playerRatingSystem(
        ladder.value?.eligibility?.skill?.ratingSystem,
      )
      return `Needs ${system?.acronym || 'rating'}`
    }

    if (missing.includes('clubLevel')) return 'Needs playing level'
    if (missing.includes('dob')) return 'Needs date of birth'
    if (missing.includes('gender')) return 'Needs gender'

    return 'Needs information'
  }

  if (result.reason === 'age') return 'Not eligible - age'
  if (result.reason === 'gender') return 'Not eligible - gender'
  if (result.reason === 'skill') return 'Not eligible - playing level'

  if (result.reason === 'rating') {
    const system = playerRatingSystem(
      ladder.value?.eligibility?.skill?.ratingSystem,
    )
    return `Not eligible - ${system?.acronym || 'rating'}`
  }

  return 'Not eligible'
}

function toggle(member) {
  if (!canAddMember(member)) return

  const next = new Set(selected.value)

  if (next.has(member.id)) next.delete(member.id)
  else next.add(member.id)

  selected.value = next
}

async function addSelected() {
  if (busy.value || !selected.value.size) return

  busy.value = true
  error.value = ''

  try {
    const count = selected.value.size

    await adminStore.addLadderMembers(
      ladderId.value,
      [...selected.value],
    )

    await adminStore.loadClubs()

    notificationStore.addToast({
      title: count === 1 ? 'Player added' : 'Players added',
      message:
        count === 1
          ? `1 player was added to ${ladder.value?.name || 'the Ladder'}.`
          : `${count} players were added to ${ladder.value?.name || 'the Ladder'}.`,
      type: 'success',
    })

    await backToAddPeople()
  } catch (saveError) {
    error.value =
      saveError?.message ||
      'Unable to add these club members.'
  } finally {
    busy.value = false
  }
}

useShellNestedHeader(() => ({
  label: 'Choose club members',
  backLabel: 'Back to add people',
  back: backToAddPeople,
  crumbs: [
    { label: 'Ladder' },
    { label: ladder.value?.name || 'Ladder' },
    { label: 'Add people' },
    { label: 'Club members' },
  ],
}))

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
    }
  } catch (loadError) {
    error.value =
      loadError?.message ||
      'Unable to open club members.'
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
    <section class="lw-subpage-lead">
      <strong>Club members</strong>
      <p>
        Pick people already in {{ clubName }}.
        {{ requirements }}
      </p>
    </section>

    <p v-if="error" class="lw-alert" role="alert">
      {{ error }}
    </p>

    <div v-if="availableMembers.length" class="lw-list">
      <label
        v-for="member in availableMembers"
        :key="member.id"
        class="lw-list-row lw-member-picker-row"
        :class="{
          'lw-list-row--disabled': !canAddMember(member),
        }"
      >
        <input
          type="checkbox"
          :checked="selected.has(member.id)"
          :disabled="!canAddMember(member)"
          @change="toggle(member)"
        />

        <span>
          <strong>{{ member.name }}</strong>
          <small>
            {{ memberMeta(member) }}
            /
            {{ eligibilityLabel(member) }}
          </small>
        </span>

        <PersonAvatar
          :name="member.name || 'Member'"
          :image="member.photoUrl || ''"
          :size="36"
        />
      </label>
    </div>

    <section v-else class="lw-simple-empty">
      <strong>No club members to add</strong>
      <p>
        Everyone currently available in {{ clubName }} is already on this Ladder.
      </p>
    </section>

    <footer v-if="availableMembers.length" class="lw-footer">
      <BaseButton
        :disabled="busy || !selected.size"
        @click="addSelected"
      >
        {{
          busy
            ? 'Adding...'
            : selected.size === 1
              ? 'Add 1 player'
              : `Add ${selected.size} players`
        }}
      </BaseButton>
    </footer>
  </main>
</template>
