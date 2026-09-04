<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'
import { sanitizePlainText } from '../utils/formSafety'

const router = useRouter()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const profile = reactive({
  name: authStore.user?.name || '',
  email: authStore.user?.email || '',
  phone: authStore.user?.phone || '',
})
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const profileError = ref('')
const passwordError = ref('')
const passwordBusy = ref(false)

const accountName = computed(() => profile.name || authStore.user?.name || 'Player')

function saveProfile() {
  const name = sanitizePlainText(profile.name, 100)
  const email = sanitizePlainText(profile.email, 160).toLowerCase()
  const phone = sanitizePlainText(profile.phone, 40)

  if (name.length < 2) {
    profileError.value = 'Enter your name.'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    profileError.value = 'Enter a working email address.'
    return
  }

  authStore.$patch({
    user: {
      ...authStore.user,
      name,
      email,
      phone,
    },
  })
  Object.assign(profile, { name, email, phone })
  profileError.value = ''
  notificationStore.addToast({ message: 'Profile saved.', type: 'success' })
}

async function updatePassword() {
  passwordError.value = ''
  if (!currentPassword.value) passwordError.value = 'Enter your current password.'
  else if (newPassword.value.length < 10 || !/\d/.test(newPassword.value)) {
    passwordError.value = 'Use at least 10 characters and one number.'
  } else if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'The new passwords do not match.'
  }
  if (passwordError.value) return

  passwordBusy.value = true
  await new Promise((resolve) => window.setTimeout(resolve, 300))
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordBusy.value = false
  notificationStore.addToast({ message: 'Password updated.', type: 'success' })
}

async function signOut() {
  authStore.logout()
  await router.replace({ name: 'SignIn' })
}
</script>

<template>
  <section class="account-settings" aria-label="Account settings">
    <header class="account-context">
      <PersonAvatar :name="accountName" :image="authStore.user?.avatar || ''" :size="52" />
      <div>
        <p>Personal account</p>
        <h2>{{ accountName }}</h2>
        <span>These details belong to you, not to a club.</span>
      </div>
    </header>

    <div class="account-settings__grid">
      <form class="account-card" @submit.prevent="saveProfile">
        <header class="account-card__heading">
          <h2>Personal details</h2>
          <p>Used across your Gorra account.</p>
        </header>
        <p v-if="profileError" class="account-alert" role="alert">{{ profileError }}</p>
        <BaseInput
          v-model="profile.name"
          label="Name"
          type="text"
          maxlength="100"
          autocomplete="name"
          required
        />
        <BaseInput
          v-model="profile.email"
          label="Email"
          type="email"
          maxlength="160"
          autocomplete="email"
          required
        />
        <BaseInput
          v-model="profile.phone"
          label="Phone"
          type="tel"
          maxlength="40"
          autocomplete="tel"
        />
        <BaseButton type="submit">Save profile</BaseButton>
      </form>

      <form class="account-card" @submit.prevent="updatePassword">
        <header class="account-card__heading">
          <h2>Password</h2>
          <p>Use at least 10 characters and one number.</p>
        </header>
        <p v-if="passwordError" class="account-alert" role="alert">{{ passwordError }}</p>
        <BaseInput
          v-model="currentPassword"
          label="Current password"
          type="password"
          autocomplete="current-password"
        />
        <BaseInput
          v-model="newPassword"
          label="New password"
          type="password"
          minlength="10"
          autocomplete="new-password"
        />
        <BaseInput
          v-model="confirmPassword"
          label="Confirm new password"
          type="password"
          minlength="10"
          autocomplete="new-password"
        />
        <BaseButton type="submit" variant="secondary" :disabled="passwordBusy">
          {{ passwordBusy ? 'Updating…' : 'Update password' }}
        </BaseButton>
      </form>
    </div>

    <section class="session-row">
      <div>
        <h2>Session</h2>
        <p>Sign out of Gorra on this device.</p>
      </div>
      <BaseButton variant="secondary" @click="signOut">Sign out</BaseButton>
    </section>
  </section>
</template>

<style scoped>
.account-settings {
  display: grid;
  width: 100%;
  gap: 32px;
  padding: 4px 0 42px;
}

.account-context {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-border);
}

.account-context > div,
.account-card__heading {
  display: grid;
  gap: 3px;
}

.account-context p,
.account-context h2,
.account-context span,
.account-card__heading h2,
.account-card__heading p,
.session-row h2,
.session-row p {
  margin: 0;
}

.account-context p {
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.account-context h2 {
  color: var(--color-text);
  font-size: 18px;
  font-weight: var(--font-weight-semibold);
}

.account-context span,
.account-card__heading p,
.session-row p {
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.5;
}

.account-settings__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.account-card {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 14px;
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}

.account-card__heading {
  margin-bottom: 4px;
}

.account-card__heading h2,
.session-row h2 {
  color: var(--color-text);
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
}

.account-card :deep(.base-button) {
  justify-self: start;
  margin-top: 4px;
}

.account-alert {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #efc8c8;
  border-radius: 9px;
  background: #fff7f7;
  color: #8b2d2d;
  font-size: 12px;
}

.session-row {
  display: flex;
  min-height: 82px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 0;
  border-top: 1px solid var(--color-border);
}

@media (max-width: 760px) {
  .account-settings__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .account-settings {
    gap: 28px;
  }

  .account-context,
  .session-row {
    align-items: flex-start;
  }

  .session-row {
    flex-direction: column;
  }

  .session-row :deep(.base-button),
  .account-card :deep(.base-button) {
    width: 100%;
  }
}
</style>
