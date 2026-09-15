<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useAdminStore } from '../stores/admin.js'
import { useNotificationStore } from '../stores/notification.js'
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

const ladderId = computed(() => String(route.params.ladderId || ''))
const activeClub = computed(() => adminStore.activeClub)

const ladder = computed(
  () =>
    activeClub.value?.setup?.ladders?.find(
      (item) => item.id === ladderId.value && !item.archived,
    ) || null,
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

async function makeInvite() {
  if (busy.value) return

  busy.value = true
  error.value = ''

  try {
    const invite = await adminStore.rotateLadderInvite(ladderId.value)

    const href = router.resolve({
      name: 'LadderInvite',
      params: {
        token: invite.token,
      },
    }).href

    inviteUrl.value =
      new URL(href, window.location.origin).toString()
  } catch (inviteError) {
    error.value =
      inviteError?.message ||
      'Unable to make this invite link.'
  } finally {
    busy.value = false
  }
}

async function copyInvite() {
  if (!inviteUrl.value) return

  try {
    await navigator.clipboard.writeText(inviteUrl.value)

    notificationStore.addToast({
      message: 'Ladder invite copied.',
      type: 'success',
    })
  } catch {
    notificationStore.addToast({
      message: inviteUrl.value,
      type: 'info',
    })
  }
}

useShellNestedHeader(() => ({
  label: 'Share ladder invite',
  backLabel: 'Back to add people',
  back: backToAddPeople,
  crumbs: [
    { label: 'Ladder' },
    { label: ladder.value?.name || 'Ladder' },
    { label: 'Add people' },
    { label: 'Invite' },
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
      return
    }

    await makeInvite()
  } catch (loadError) {
    error.value =
      loadError?.message ||
      'Unable to open this Ladder invite.'
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
      <strong>Share one link</strong>
      <p>
        Players can use this link to request to join {{ ladder.name }}.
        GORRA checks the Ladder requirements automatically.
      </p>
    </section>

    <p v-if="error" class="lw-alert" role="alert">
      {{ error }}
    </p>

    <section class="lw-invite-share">
      <span class="ref-feature-icon" aria-hidden="true">
        <FlowIcon name="send" />
      </span>

      <div class="lw-invite-share__copy">
        <strong>{{ ladder.name }} invite</strong>
        <small>
          Anyone with this link can open the Ladder join flow.
        </small>
      </div>

      <div class="lw-invite-share__actions">
        <BaseButton
          :disabled="busy || !inviteUrl"
          @click="copyInvite"
        >
          <FlowIcon name="copy" />
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
    </section>

    <label v-if="inviteUrl" class="lw-field lw-invite-url">
      <span>Invite link</span>
      <input
        :value="inviteUrl"
        readonly
        @focus="$event.target.select()"
      />
    </label>
  </main>
</template>
