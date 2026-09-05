<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useAdminStore } from '../stores/admin'
import { APP_DATA_MODES } from '../dataMode'
import { resolvePostAuthDestination } from '../utils/onboarding/resolvePostAuthDestination.js'
import AppLogo from '../components/AppLogo.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()
const errorMessage = ref('')
const useDemoData = ref(false)

const isSignUp = computed(() => route.meta.authMode === 'signup')

const alternateAuthDestination = computed(() => ({
  name: isSignUp.value ? 'SignIn' : 'SignUp',
  query: {
    ...(route.query.invite
      ? { invite: route.query.invite }
      : {}),
    ...(route.query.redirect
      ? { redirect: route.query.redirect }
      : {}),
    ...(route.query.club
      ? { club: route.query.club }
      : {}),
  },
}))

async function resolveEntryDestination() {
  const intentResolution = resolvePostAuthDestination({
    redirect: route.query.redirect,
    invite: route.query.invite,
  })
  if (intentResolution) return intentResolution.destination

  await adminStore.loadClubs()
  const clubResolution = resolvePostAuthDestination({
    activeClubs: adminStore.clubOptions,
  })

  if (
    clubResolution.activeClubId &&
    clubResolution.activeClubId !== adminStore.activeClubId
  ) {
    await adminStore.switchClub(clubResolution.activeClubId)
  }

  return clubResolution.destination
}

async function enterWorkspace() {
  if (authStore.isAuthLoading) return

  try {
    errorMessage.value = ''
    await authStore.login({
      dataMode:
        !isSignUp.value && useDemoData.value ? APP_DATA_MODES.DEMO : APP_DATA_MODES.EMPTY,
    })
    await router.push(await resolveEntryDestination())
  } catch (error) {
    errorMessage.value = error?.message || 'We could not open the workspace. Please try again.'
  }
}

onMounted(async () => {
  if (!authStore.isAuthenticated) return

  const intentResolution = resolvePostAuthDestination({
    redirect: route.query.redirect,
    invite: route.query.invite,
  })

  if (!intentResolution) return

  try {
    await router.replace(intentResolution.destination)
  } catch (error) {
    errorMessage.value =
      error?.message ||
      'We could not continue this invitation. Please try again.'
  }
})
</script>

<template>
  <section class="auth-page">
    <div class="auth-page__backdrop" aria-hidden="true"></div>
    <div class="auth-page__atmosphere" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>

    <main class="auth-panel">
      <RouterLink class="auth-brand" to="/" aria-label="Gorra home">
        <AppLogo class="auth-brand__logo" />
      </RouterLink>

      <div class="auth-panel__content">
        <p class="auth-access-kicker">
          {{ isSignUp ? 'Getting started' : 'Welcome back' }}
        </p>
        <h1>{{ isSignUp ? 'Create your Gorra account' : 'Welcome back' }}</h1>
        <p class="auth-access-intro">
          {{
            isSignUp
              ? 'One personal account follows you across every club you join, create, or help run.'
              : 'Continue to your Gorra account. Your access comes from each club relationship.'
          }}
        </p>

        <label v-if="!isSignUp" class="auth-data-option">
          <input v-model="useDemoData" type="checkbox" />
          <span>
            <strong>Use sample club data</strong>
            <small>Leave this off to open the true fresh-account experience.</small>
          </span>
        </label>

        <button
          class="auth-submit"
          type="button"
          :disabled="authStore.isAuthLoading"
          @click="enterWorkspace"
        >
          {{
            authStore.isAuthLoading
              ? 'Opening…'
              : isSignUp
                ? 'Create account'
                : 'Sign in'
          }}
        </button>

        <p class="auth-switch">
          {{
            isSignUp
              ? 'Already have a Gorra account?'
              : 'New to Gorra?'
          }}
          <RouterLink :to="alternateAuthDestination">
            {{ isSignUp ? 'Sign in' : 'Create account' }}
          </RouterLink>
        </p>

        <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>
        <p class="auth-quick-note">
          This local prototype uses the configured demo identity. No password is required.
        </p>
      </div>
    </main>
  </section>
</template>

<style scoped>
.auth-page {
  --auth-panel: 520px;
  position: relative;
  min-height: 100svh;
  overflow: hidden;
  background: #07120b;
  color: var(--color-text);
  display: grid;
  place-items: center;
  padding: 4svh 0;
}

.auth-page::after {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 22%, rgba(152, 255, 170, 0.12), transparent 34%);
  pointer-events: none;
  content: '';
}

.auth-page__backdrop {
  position: absolute;
  inset: 0;
  filter: brightness(1.03);
  background:
    linear-gradient(rgba(0, 0, 0, 0.24), rgba(0, 0, 0, 0.24)),
    linear-gradient(
      90deg,
      rgba(4, 14, 8, 0.16),
      transparent 32%,
      transparent 68%,
      rgba(4, 14, 8, 0.12)
    ),
    url('https://res.cloudinary.com/dnuhjsckk/image/upload/v1783930854/647a6b7b-826f-456f-97f9-781bc4d49870_1_gftdpv.png')
      center / cover no-repeat;
}

.auth-page__atmosphere {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.auth-page__atmosphere span {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  opacity: 0;
  animation: auth-ball-drift 8s ease-in-out infinite;
}
.auth-page__atmosphere span:nth-child(1) {
  left: 12%;
  top: 64%;
}
.auth-page__atmosphere span:nth-child(2) {
  right: 14%;
  top: 22%;
  animation-delay: 2.4s;
}
.auth-page__atmosphere span:nth-child(3) {
  right: 24%;
  bottom: 12%;
  animation-delay: 5.1s;
}

.auth-panel {
  position: relative;
  z-index: 1;
  width: min(var(--auth-panel), 100%);
  height: 85svh;
  max-height: 780px;
  margin: 0;
  padding: 28px 34px 26px;
  overflow-y: auto;
  background: #fff;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 32px 100px rgba(3, 12, 6, 0.36);
  animation: auth-panel-arrive 620ms var(--motion-curve) both;
}

.auth-brand {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

.auth-brand__logo {
  width: 120px;
  max-height: 42px;
}

.auth-panel__content {
  width: 100%;
  margin: auto 0;
  padding: 44px 0 30px;
}

h1 {
  max-width: 390px;
  margin: 0 0 12px;
  color: #172319;
  font-size: clamp(34px, 3vw, 43px);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.045em;
  line-height: 1.08;
  white-space: pre-line;
}

.auth-intro {
  margin: -22px 0 28px;
  color: var(--color-muted);
  font-size: 14px;
  line-height: 1.55;
}

.auth-access-kicker {
  margin: 0 0 8px;
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.auth-access-intro {
  margin: 0 0 28px;
  color: var(--color-muted);
  font-size: 14px;
  line-height: 1.55;
}

.auth-data-option {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: start;
  gap: 11px;
  padding: 13px 14px;
  border: var(--app-hairline);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
}

.auth-data-option input {
  width: 18px;
  height: 18px;
  margin: 2px 0 0;
  accent-color: var(--color-primary);
}

.auth-data-option strong,
.auth-data-option small {
  display: block;
}
.auth-data-option strong {
  color: var(--color-text);
  font-size: 12px;
  line-height: 1.4;
}
.auth-data-option small {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: 11px;
  line-height: 1.45;
}

.auth-quick-note {
  margin: 22px 0 0;
  color: #68746b;
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.auth-form {
  display: grid;
  gap: 20px;
}

.auth-field {
  position: relative;
}

.auth-field label {
  position: absolute;
  z-index: 1;
  top: 8px;
  left: 15px;
  color: #55705d;
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.auth-field input {
  width: 100%;
  height: 58px;
  border: 1px solid #9ca8a0;
  border-radius: 9px;
  padding: 23px 15px 8px;
  background: #fff;
  color: #172319;
  font-size: 15px;
}

.auth-field input:focus {
  border-color: var(--color-primary-strong);
  box-shadow: 0 0 0 3px rgba(0, 181, 26, 0.13);
}

.auth-submit {
  width: 100%;
  min-height: 50px;
  margin-top: 24px;
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
  font-size: 15px;
  font-weight: var(--font-weight-semibold);
}

.auth-submit:hover:not(:disabled) {
  border-color: var(--color-primary-strong);
  background: var(--color-primary-strong);
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 31px 0 24px;
  color: #67736a;
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #dbe1dc;
}

.auth-google {
  width: 100%;
  min-height: 50px;
  justify-content: center;
  gap: 12px;
  padding: 12px 18px;
  border: 1px solid #cfd6d0;
  border-radius: 8px;
  background: #fff;
  color: #172319;
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
}

.auth-google:hover {
  border-color: #8b988e;
  background: #f8faf8;
}

.auth-google svg {
  display: block;
  width: 24px;
  height: 24px;
}

.auth-email {
  width: 100%;
  min-height: auto;
  margin: 0 0 24px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #56635a;
  justify-content: space-between;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
}

.auth-email strong {
  color: #007a32;
}

.auth-email:hover {
  transform: none !important;
}

.auth-error {
  margin: 18px 0 0;
  color: #a32020;
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  line-height: 1.45;
  text-align: center;
}

.auth-form .auth-error {
  margin: -6px 0 0;
}

.auth-switch {
  margin: 27px 0 0;
  color: #68746b;
  font-size: 13px;
  text-align: center;
}

.auth-switch a {
  color: #007a32;
  font-weight: var(--font-weight-bold);
}

@media (max-width: 700px) {
  .auth-page {
    background: #fff;
    padding: 0;
  }

  .auth-page__backdrop {
    display: none;
  }

  .auth-page__atmosphere {
    display: none;
  }

  .auth-panel {
    height: 100svh;
    max-height: none;
    padding: 22px 24px 24px;
    border-radius: 0;
    box-shadow: none;
  }

  .auth-panel__content {
    padding-top: 48px;
  }

  h1 {
    margin-bottom: 12px;
    font-size: 34px;
  }
}

@media (max-height: 700px) and (min-width: 701px) {
  .auth-panel {
    padding-top: 20px;
    padding-bottom: 18px;
  }

  .auth-panel__content {
    padding: 24px 0 18px;
  }

  h1 {
    margin-bottom: 24px;
    font-size: 34px;
  }

  .auth-divider {
    margin: 22px 0 18px;
  }

  .auth-switch {
    margin-top: 18px;
  }
}

@keyframes auth-panel-arrive {
  from {
    opacity: 0;
    transform: translateY(18px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes auth-ball-drift {
  0%,
  100% {
    opacity: 0;
    transform: translate3d(0, 28px, 0) scale(0.7);
  }
  25%,
  70% {
    opacity: 0.45;
  }
  50% {
    opacity: 0.7;
    transform: translate3d(20px, -30px, 0) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .auth-panel,
  .auth-page__atmosphere span {
    animation: none;
  }
}
</style>
