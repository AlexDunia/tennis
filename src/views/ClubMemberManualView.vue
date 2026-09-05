<script setup>
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useAdminStore } from '../stores/admin'
import { useNotificationStore } from '../stores/notification'

const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()

const error = ref('')
const saving = ref(false)
const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  gender: '',
  dob: '',
  level: '',
  rating: '',
  memberNumber: '',
  yearOfEntry: '',
  role: 'player',
})

const club = computed(() => adminStore.activeClub)

async function submit() {
  error.value = ''
  saving.value = true

  try {
    const result = await adminStore.addMemberRecord(form)

    notificationStore.addToast({
      message: `${result.member.name} was added.`,
      type: 'success',
    })

    await router.push({
      name: 'ClubMemberDetail',
      params: { memberId: result.member.id },
    })
  } catch (submitError) {
    error.value = submitError?.message || 'We could not add this member.'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await adminStore.loadClubs()
  } catch (loadError) {
    error.value = loadError?.message || 'We could not open this club.'
  }
})
useShellNestedHeader(() => ({
  label: 'Back to members',
  back: () => router.push({ name: 'ClubMembers' }),
  crumbs: [
    { label: 'Club', to: { name: 'Club' } },
    { label: 'Members', to: { name: 'ClubMembers' } },
    { label: 'Add member' },
  ],
}))
</script>

<template>
  <main class="gorra-club-ref ref-page ref-page-narrow">

    <header class="ref-page-head">
      <div class="ref-page-head-main">
        <h1>Add someone yourself</h1>
        <p>
          Enter what you already know. Gorra checks the same information the member would normally
          complete themselves.
        </p>
      </div>
    </header>

    <p v-if="error" class="ref-inline-alert" role="alert">{{ error }}</p>

    <form class="ref-form-card" @submit.prevent="submit">
      <section class="ref-profile-section">
        <header class="ref-profile-section-head">
          <strong>About them</strong>
        </header>

        <div class="ref-form-grid">
          <label class="ref-form-field">
            <span>First name</span>
            <input
              v-model="form.firstName"
              type="text"
              maxlength="60"
              autocomplete="given-name"
              required
            />
          </label>

          <label class="ref-form-field">
            <span>Last name</span>
            <input
              v-model="form.lastName"
              type="text"
              maxlength="60"
              autocomplete="family-name"
              required
            />
          </label>

          <label class="ref-form-field">
            <span>Email</span>
            <input
              v-model="form.email"
              type="email"
              maxlength="254"
              autocomplete="email"
            />
          </label>

          <label class="ref-form-field">
            <span>Phone</span>
            <input
              v-model="form.phone"
              type="tel"
              maxlength="30"
              autocomplete="tel"
            />
          </label>

          <label class="ref-form-field">
            <span>Gender</span>
            <select v-model="form.gender">
              <option value="">Not added</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </label>

          <label class="ref-form-field">
            <span>Date of birth</span>
            <input v-model="form.dob" type="date" autocomplete="bday" />
          </label>
        </div>
      </section>

      <section class="ref-profile-section">
        <header class="ref-profile-section-head">
          <strong>Their tennis</strong>
        </header>

        <div class="ref-form-grid">
          <label class="ref-form-field">
            <span>Playing Level</span>
            <input
              v-model="form.level"
              type="text"
              maxlength="50"
              placeholder="For example, Intermediate"
            />
          </label>

          <label class="ref-form-field">
            <span>Rating</span>
            <input
              v-model="form.rating"
              type="text"
              maxlength="40"
              inputmode="decimal"
            />
          </label>
        </div>
      </section>

      <section class="ref-profile-section">
        <header class="ref-profile-section-head">
          <strong>At this club</strong>
        </header>

        <div class="ref-form-grid">
          <label class="ref-form-field">
            <span>Member / Reference Number</span>
            <input v-model="form.memberNumber" type="text" maxlength="80" />
          </label>

          <label class="ref-form-field">
            <span>Year of Entry</span>
            <input
              v-model="form.yearOfEntry"
              type="number"
              min="1900"
              :max="new Date().getFullYear() + 1"
              inputmode="numeric"
            />
          </label>

          <label class="ref-form-field">
            <span>Role</span>
            <select v-model="form.role">
              <option value="player">Member</option>
              <option value="co-admin">Co-admin</option>
              <option value="admin">Admin</option>
            </select>
            <small>Roles belong to this club relationship, not to the person's Gorra account.</small>
          </label>
        </div>
      </section>

      <footer class="ref-form-actions">
        <button class="ref-button" type="button" @click="router.push({ name: 'ClubMembers' })">
          Cancel
        </button>
        <button class="ref-button primary" type="submit" :disabled="saving">
          {{ saving ? 'Adding…' : 'Add member' }}
        </button>
      </footer>
    </form>
  </main>
</template>
