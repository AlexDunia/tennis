<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
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

const avatarText = computed(() => {
  const value = String(profile.name || authStore.user?.name || 'Player').trim()
  const parts = value.split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : value.slice(0, 2)).toUpperCase()
})

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
  <section class="account-settings" aria-labelledby="account-settings-title">
    <header class="account-settings__header">
      <span class="account-settings__avatar" aria-hidden="true">{{ avatarText }}</span>
      <div>
        <p>Your account</p>
        <h1 id="account-settings-title">Account settings</h1>
        <span>Update the details used across GORRA.</span>
      </div>
    </header>

    <div class="account-settings__grid">
      <form class="account-card" @submit.prevent="saveProfile">
        <div class="account-card__heading">
          <div>
            <p>Profile</p>
            <h2>Personal details</h2>
          </div>
        </div>
        <p v-if="profileError" class="account-alert" role="alert">{{ profileError }}</p>
        <label
          ><span>Name</span
          ><input v-model="profile.name" type="text" maxlength="100" autocomplete="name" required
        /></label>
        <label
          ><span>Email</span
          ><input
            v-model="profile.email"
            type="email"
            maxlength="160"
            autocomplete="email"
            required
        /></label>
        <label
          ><span>Phone</span
          ><input v-model="profile.phone" type="tel" maxlength="40" autocomplete="tel"
        /></label>
        <button class="button-primary" type="submit">Save profile</button>
      </form>

      <form class="account-card" @submit.prevent="updatePassword">
        <div class="account-card__heading">
          <div>
            <p>Security</p>
            <h2>Change password</h2>
          </div>
        </div>
        <p v-if="passwordError" class="account-alert" role="alert">{{ passwordError }}</p>
        <label
          ><span>Current password</span
          ><input v-model="currentPassword" type="password" autocomplete="current-password"
        /></label>
        <label
          ><span>New password</span
          ><input v-model="newPassword" type="password" minlength="10" autocomplete="new-password"
        /></label>
        <label
          ><span>Confirm new password</span
          ><input
            v-model="confirmPassword"
            type="password"
            minlength="10"
            autocomplete="new-password"
        /></label>
        <button class="button-secondary" type="submit" :disabled="passwordBusy">
          {{ passwordBusy ? 'Updating…' : 'Update password' }}
        </button>
      </form>
    </div>

    <section class="account-card account-card--signout">
      <div>
        <p>Session</p>
        <h2>Sign out of this device</h2>
      </div>
      <button class="button-secondary" type="button" @click="signOut">Sign out</button>
    </section>
  </section>
</template>

<style scoped>
.account-settings {
  display: grid;
  gap: 24px;
  width: min(100%, 940px);
}

.account-settings__header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--color-border);
}

.account-settings__avatar {
  display: grid;
  flex: 0 0 58px;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface-soft);
  color: var(--color-primary-strong);
  font-size: 15px;
  font-weight: var(--font-weight-bold);
}

.account-settings__header div,
.account-card__heading div {
  display: grid;
  gap: 2px;
}

.account-settings__header p,
.account-settings__header h1,
.account-settings__header span,
.account-card p,
.account-card h2 {
  margin: 0;
}

.account-settings__header p,
.account-card p {
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.account-settings__header h1 {
  font-size: clamp(24px, 4vw, 34px);
}

.account-settings__header div > span {
  color: var(--color-muted);
}

.account-settings__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.account-card {
  display: grid;
  align-content: start;
  gap: 14px;
  min-width: 0;
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}

.account-card h2 {
  font-size: 18px;
}

.account-card label {
  display: grid;
  gap: 6px;
  color: var(--color-text-soft);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.account-card input {
  width: 100%;
}

.account-card button {
  justify-self: start;
  margin-top: 4px;
}

.account-alert {
  padding: 10px 12px;
  border: 1px solid #f2c8c8;
  border-radius: var(--app-inner-radius);
  background: #fff6f6;
  color: #9e2929 !important;
  font-size: 12px !important;
  font-weight: var(--font-weight-semibold) !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
}

.account-card--signout {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

@media (max-width: 720px) {
  .account-settings__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .account-card--signout {
    grid-template-columns: 1fr;
  }
}
</style>
