<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import EmptyState from '../components/EmptyState.vue'
import { useAdminStore } from '../stores/admin.js'
import { useAuthStore } from '../stores/auth.js'
import { useNotificationStore } from '../stores/notification.js'
import { collectClubMembers } from '../utils/club/memberData.js'
import { sanitizeDirectoryId } from '../utils/admin/clubSetup.js'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import '../assets/ladder-workspace.css'

const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const ready = ref(false)
const saving = ref(false)
const error = ref('')

const form = reactive({
  name: '',
  email: '',
  phone: '',
  gender: '',
  dob: '',
  level: '',
})

const actorId = computed(() =>
  sanitizeDirectoryId(
    authStore.user?.id ||
      authStore.user?.playerId ||
      authStore.user?.email ||
      '',
  ),
)

const member = computed(() =>
  collectClubMembers(adminStore.activeClub?.setup || {}).find(
    (item) => sanitizeDirectoryId(item.userId) === actorId.value,
  ),
)

function fill() {
  const value = member.value
  if (!value) return

  form.name = value.name || ''
  form.email = value.email || ''
  form.phone = value.phone || ''
  form.gender = value.gender || ''
  form.dob = value.dob || ''
  form.level = value.level || ''
}

async function save() {
  if (!member.value || saving.value) return

  saving.value = true
  error.value = ''

  try {
    /*
     * Explicit personal-field allowlist.
     * No role, rank, LadderEntry, Ladder rules or position can be submitted.
     */
    await adminStore.saveMemberRecord(member.value.id, {
      name: form.name,
      email: form.email,
      phone: form.phone,
      gender: form.gender,
      dob: form.dob,
      level: form.level,
    })

    notificationStore.addToast({
      title: 'Profile updated',
      message: 'GORRA will use these details where they are relevant.',
      type: 'success',
    })

    await adminStore.loadClubs()
    fill()
  } catch (saveError) {
    error.value = saveError?.message || 'Unable to update your information.'
  } finally {
    saving.value = false
  }
}

useShellNestedHeader(() => ({
  label: 'Personal information',
  backLabel: 'Back to profile',
  back: () => router.push({ name: 'Profile' }),
  crumbs: [
    { label: 'Profile' },
    { label: 'Personal information' },
  ],
}))

onMounted(async () => {
  try {
    if (!adminStore.activeClub) await adminStore.loadClubs()
    fill()
  } catch (loadError) {
    error.value = loadError?.message || 'Unable to load your information.'
  } finally {
    ready.value = true
  }
})
</script>

<template>
  <main v-if="ready" class="ladder-workspace-page">
    <header class="ladder-workspace-page__header">
      <p class="ladder-workspace-page__eyebrow">Your profile</p>
      <h1>Personal information</h1>
      <p class="ladder-workspace-page__description">
        Change your reusable personal details here once. Ladder positions and
        competition settings are controlled by your club administrator.
      </p>
    </header>

    <EmptyState
      v-if="!member"
      illustration="profile"
      title="No linked club profile yet"
      description="When your GORRA account is linked to your club member record, your personal information will appear here."
    />

    <form v-else class="lw-form" @submit.prevent="save">
      <p v-if="error" class="lw-alert" role="alert">{{ error }}</p>

      <section class="lw-section">
        <div class="lw-grid">
          <label class="lw-field lw-field--full">
            <span>Full name</span>
            <input
              v-model="form.name"
              maxlength="100"
              autocomplete="name"
              required
            />
          </label>

          <label class="lw-field">
            <span>Email</span>
            <input
              v-model="form.email"
              type="email"
              maxlength="254"
              autocomplete="email"
            />
          </label>

          <label class="lw-field">
            <span>Phone number</span>
            <input
              v-model="form.phone"
              maxlength="30"
              inputmode="tel"
              autocomplete="tel"
            />
          </label>

          <label class="lw-field">
            <span>Gender</span>
            <select v-model="form.gender">
              <option value="">Not set</option>
              <option value="men">Man</option>
              <option value="women">Woman</option>
            </select>
          </label>

          <label class="lw-field">
            <span>Date of birth</span>
            <input v-model="form.dob" type="date" autocomplete="bday" />
          </label>

          <label class="lw-field lw-field--full">
            <span>Skill level</span>
            <input
              v-model="form.level"
              maxlength="50"
              autocomplete="off"
              placeholder="Your club’s level label"
            />
          </label>
        </div>
      </section>

      <footer class="lw-footer">
        <BaseButton
          variant="secondary"
          type="button"
          @click="router.push({ name: 'Profile' })"
        >
          Cancel
        </BaseButton>

        <BaseButton type="submit" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </BaseButton>
      </footer>
    </form>
  </main>
</template>
