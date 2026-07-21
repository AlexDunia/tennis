<script setup>
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { APP_DATA_MODES } from '../dataMode'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const selectedRole = ref('')
const errorMessage = ref('')
const useDemoData = ref(false)
const roleOptions = [
  {
    key: 'player',
    label: 'I am a player',
    description: 'Join your club and start playing.',
  },
  {
    key: 'club_admin',
    label: 'Club admin',
    description: 'Create your club, shape its ladders, and welcome members.',
  },
]

const isSignUp = computed(() => route.meta.authMode === 'signup')

function chooseRole(roleKey) {
  selectedRole.value = roleKey
  errorMessage.value = ''
  if (!isSignUp.value) enterWorkspace(roleKey)
}

async function enterWorkspace(roleKey = selectedRole.value) {
  if (authStore.isAuthLoading) return
  if (!roleKey) {
    errorMessage.value = 'Choose the option that sounds like you.'
    return
  }

  try {
    selectedRole.value = roleKey
    errorMessage.value = ''
    const isAdmin = roleKey === 'club_admin' || roleKey === 'super_admin'
    await authStore.login({
      username: isAdmin ? 'Heredina' : 'Club Player',
      email: isAdmin ? 'admin@gorra.demo' : 'player@gorra.demo',
      roleKey,
      dataMode: isAdmin || useDemoData.value ? APP_DATA_MODES.DEMO : APP_DATA_MODES.EMPTY,
    })
    if (isSignUp.value) {
      const destination = isAdmin
        ? {
            name: 'AdminSetup',
            query: route.query.invite
              ? { view: 'join', from: 'signup', invite: route.query.invite }
              : { view: 'start', from: 'signup' },
          }
        : {
            name: 'PlayerClubJoin',
            query: { club: route.query.club, invite: route.query.invite },
          }
      await router.push(destination)
      return
    }
    const redirect = String(route.query.redirect || '')
    const safeRedirect = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : ''
    await router.push(safeRedirect || { name: 'Dashboard' })
  } catch (error) {
    errorMessage.value = error?.message || 'We could not open the workspace. Please try again.'
  }
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-page__backdrop" aria-hidden="true"></div>
    <div class="auth-page__atmosphere" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>

    <main class="auth-panel">
      <RouterLink class="auth-brand" to="/" aria-label="Gorra home">
        <span class="auth-brand__mark">G</span>
        <span>GORRA</span>
      </RouterLink>

      <div class="auth-panel__content">
        <div v-if="isSignUp" class="auth-progress" aria-label="Signup progress">
          <span class="auth-progress__step auth-progress__step--done"><i>OK</i> Account</span>
          <span class="auth-progress__line" aria-hidden="true"></span>
          <span class="auth-progress__step auth-progress__step--active" aria-current="step"
            ><i>2</i> Your role</span
          >
        </div>
        <p class="auth-access-kicker">
          {{ isSignUp ? 'Getting started' : 'Welcome back' }}
        </p>
        <h1>{{ isSignUp ? 'How will you use Gorra?' : 'How would you like to enter?' }}</h1>
        <p class="auth-access-intro">
          {{
            isSignUp
              ? 'Choose the role that fits today. We will tailor every next step around it.'
              : 'Choose a role to open the application.'
          }}
        </p>

        <div
          class="auth-role-picker"
          role="group"
          aria-label="Choose account type"
          :aria-busy="authStore.isAuthLoading"
        >
          <button
            v-for="option in roleOptions"
            :key="option.key"
            type="button"
            class="auth-role-option"
            :class="{ 'auth-role-option--active': selectedRole === option.key }"
            :aria-pressed="selectedRole === option.key"
            :disabled="authStore.isAuthLoading"
            @click="chooseRole(option.key)"
          >
            <span class="auth-role-option__icon" aria-hidden="true">
              <svg v-if="option.key !== 'player'" viewBox="0 0 24 24">
                <path d="M12 3 4.5 6v5.2c0 4.6 3.2 8.1 7.5 9.8 4.3-1.7 7.5-5.2 7.5-9.8V6L12 3Z" />
                <path d="m8.5 12 2.2 2.2 4.8-5" />
              </svg>
              <svg v-else viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4" />
                <path d="M4.5 21c.8-4.2 3.4-6.5 7.5-6.5s6.7 2.3 7.5 6.5" />
              </svg>
            </span>
            <span>
              <strong>{{
                authStore.isAuthLoading && selectedRole === option.key ? 'Opening…' : option.label
              }}</strong>
              <small>{{ option.description }}</small>
            </span>
            <span class="auth-role-option__check" aria-hidden="true">
              <svg viewBox="0 0 18 18"><path d="m4 9 3 3 7-7" /></svg>
            </span>
          </button>
        </div>

        <button
          v-if="isSignUp"
          class="auth-submit auth-continue"
          type="button"
          :disabled="!selectedRole || authStore.isAuthLoading"
          @click="enterWorkspace()"
        >
          {{ authStore.isAuthLoading ? 'Opening…' : 'Continue' }}
        </button>

        <label v-else class="auth-data-option">
          <input v-model="useDemoData" type="checkbox" />
          <span>
            <strong>Use sample club data for User</strong>
            <small>Leave this off to open the true fresh-account experience.</small>
          </span>
        </label>

        <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>
        <p v-if="!isSignUp" class="auth-quick-note">
          User opens the fresh match dashboard. Admin always keeps the original populated club data.
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
  gap: 9px;
  color: #101713;
  font-size: 18px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
  line-height: 1;
  text-decoration: none;
}

.auth-brand__mark {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50% 50% 50% 12%;
  background: var(--color-primary);
  color: white;
  font-family: Georgia, serif;
  font-size: 19px;
  font-style: italic;
  letter-spacing: 0;
  transform: rotate(-5deg);
}

.auth-panel__content {
  width: 100%;
  margin: auto 0;
  padding: 44px 0 30px;
}

.auth-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 30px;
  color: #819087;
  font-size: 10.5px;
  font-weight: var(--font-weight-medium);
}
.auth-progress__step {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.auth-progress__step i {
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  border: 1px solid #dce4de;
  border-radius: 50%;
  background: #fff;
  font-size: 8px;
  font-style: normal;
}
.auth-progress__step--done i {
  border-color: #c8e9cf;
  background: #eaf7ed;
  color: #16743a;
}
.auth-progress__step--active {
  color: #172319;
}
.auth-progress__step--active i {
  border-color: #172319;
  color: #172319;
}
.auth-progress__line {
  width: 32px;
  height: 1px;
  background: #dce4de;
}

h1 {
  max-width: 390px;
  margin: 0 0 36px;
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
  margin: -24px 0 32px;
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

.auth-role-picker {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: -18px 0 24px;
}

.auth-role-option {
  position: relative;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 22px;
  min-height: 90px;
  align-items: center;
  column-gap: 15px;
  padding: 18px;
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: #fff;
  box-shadow: var(--flow-shadow-quiet);
  color: #172319;
  text-align: left;
  white-space: normal;
  transition:
    transform 220ms var(--motion-curve),
    border-color 220ms ease,
    background 220ms ease,
    box-shadow 220ms var(--motion-curve);
}
.auth-role-option:hover:not(:disabled) {
  transform: translateY(-3px);
  border-color: #c9d7cd;
  box-shadow: 0 15px 34px rgba(15, 34, 24, 0.08);
}

.auth-role-option--active {
  border-color: color-mix(in srgb, var(--color-primary) 34%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 2.5%, #fff);
  box-shadow: 0 14px 34px rgba(19, 107, 54, 0.09);
}

.auth-role-option__icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 13px;
  background: #edf5ef;
  color: #087524;
}

.auth-role-option__icon svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.auth-role-option__check {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 1px solid #d8e1da;
  border-radius: 50%;
  color: transparent;
  transition:
    transform 220ms var(--motion-spring),
    color 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
}
.auth-role-option__check svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.auth-role-option--active .auth-role-option__check {
  transform: scale(1.08);
  border-color: var(--color-primary-strong);
  background: var(--color-primary-strong);
  color: #fff;
}
.auth-role-option strong,
.auth-role-option small {
  display: block;
}
.auth-role-option strong {
  font-size: 16px;
  font-weight: var(--font-weight-semibold);
}
.auth-role-option small {
  margin-top: 5px;
  color: #69776c;
  font-size: 13px;
  font-weight: var(--font-weight-regular);
  line-height: 1.5;
}
.auth-continue {
  margin-bottom: 18px;
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

  .auth-role-picker {
    grid-template-columns: 1fr;
  }

  h1 {
    margin-bottom: 30px;
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
