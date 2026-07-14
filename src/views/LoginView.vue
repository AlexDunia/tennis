<script setup>
import { computed, nextTick, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const fullName = ref('')
const step = ref('email')
const errorMessage = ref('')
const passwordInput = ref(null)

const isSignUp = computed(() => route.meta.authMode === 'signup')
const heading = computed(() =>
  isSignUp.value ? 'Join Gorra.\nWhat\'s your email?' : 'Welcome back!\nWhat\'s your email?',
)

async function continueWithEmail() {
  errorMessage.value = ''
  step.value = 'credentials'
  await nextTick()
  passwordInput.value?.focus()
}

async function handleAuth() {
  try {
    errorMessage.value = ''
    const fallbackName = email.value.split('@')[0] || 'Gorra member'
    await authStore.login({
      username: isSignUp.value ? fullName.value || fallbackName : fallbackName,
      password: password.value,
    })
    router.push('/dashboard')
  } catch (error) {
    errorMessage.value = error.message ?? 'We could not continue. Please try again.'
  }
}

function editEmail() {
  step.value = 'email'
  password.value = ''
  errorMessage.value = ''
}

function continueWithProvider(provider) {
  errorMessage.value = `${provider} sign in will be available soon. Please continue with email.`
}
</script>

<template>
  <section class="auth-page">
    <div class="auth-page__backdrop" aria-hidden="true"></div>

    <main class="auth-panel">
      <RouterLink class="auth-brand" to="/" aria-label="Gorra home">
        <span class="auth-brand__mark">G</span>
        <span>GORRA</span>
      </RouterLink>

      <div class="auth-panel__content">
        <template v-if="step === 'email'">
          <h1>{{ heading }}</h1>

          <form class="auth-form" @submit.prevent="continueWithEmail">
            <div class="auth-field">
              <label for="email">Email</label>
              <input
                id="email"
                v-model.trim="email"
                name="email"
                type="email"
                autocomplete="email"
                required
                autofocus
              />
            </div>
            <button class="auth-submit" type="submit">Continue</button>
          </form>

          <div class="auth-divider"><span>Or continue with</span></div>

          <button class="auth-google" type="button" @click="continueWithProvider('Google')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.7h3.4c2-1.8 2.8-4.5 2.8-7.7Z"/><path fill="#34a853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.7c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.8A10.4 10.4 0 0 0 12 22Z"/><path fill="#fbbc05" d="M6.2 13.5a6.2 6.2 0 0 1 0-3.9V6.8H2.7a10.1 10.1 0 0 0 0 9.5l3.5-2.8Z"/><path fill="#ea4335" d="M12 5.3c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 2.7 6.8l3.5 2.8C7 7.1 9.3 5.3 12 5.3Z"/></svg>
            <span>Continue with Google</span>
          </button>

          <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>
          <p class="auth-switch">
            {{ isSignUp ? 'Already a member?' : 'New to Gorra?' }}
            <RouterLink :to="isSignUp ? '/signin' : '/signup'">
              {{ isSignUp ? 'Sign in' : 'Create an account' }}
            </RouterLink>
          </p>
        </template>

        <template v-else>
          <button class="auth-email" type="button" @click="editEmail">
            <span>{{ email }}</span><strong>Change</strong>
          </button>
          <h1>{{ isSignUp ? 'Create your Gorra account' : 'Enter your password' }}</h1>
          <p class="auth-intro">
            {{ isSignUp ? 'One account for your ladder, matches, and tournaments.' : 'Good to see you again. Let’s get you back to the club.' }}
          </p>

          <form class="auth-form" @submit.prevent="handleAuth">
            <div v-if="isSignUp" class="auth-field">
              <label for="full-name">Full name</label>
              <input id="full-name" v-model.trim="fullName" type="text" autocomplete="name" required />
            </div>
            <div class="auth-field">
              <label for="password">Password</label>
              <input
                id="password"
                ref="passwordInput"
                v-model="password"
                type="password"
                :autocomplete="isSignUp ? 'new-password' : 'current-password'"
                minlength="6"
                required
              />
            </div>
            <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>
            <button class="auth-submit" type="submit" :disabled="authStore.isAuthLoading">
              {{ authStore.isAuthLoading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in' }}
            </button>
          </form>
        </template>
      </div>

    </main>
  </section>
</template>

<style scoped>
.auth-page {
  --auth-panel: 470px;
  position: relative;
  min-height: 100svh;
  overflow: hidden;
  background: #07120b;
  color: var(--color-text);
  display: grid;
  place-items: center;
  padding: 4svh 0;
}

.auth-page__backdrop {
  position: absolute;
  inset: 0;
  filter: brightness(1.03);
  background:
    linear-gradient(rgba(0, 0, 0, 0.24), rgba(0, 0, 0, 0.24)),
    linear-gradient(90deg, rgba(4, 14, 8, 0.16), transparent 32%, transparent 68%, rgba(4, 14, 8, 0.12)),
    url('https://res.cloudinary.com/dnuhjsckk/image/upload/v1783930854/647a6b7b-826f-456f-97f9-781bc4d49870_1_gftdpv.png') center / cover no-repeat;
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
  box-shadow: 0 24px 80px rgba(3, 12, 6, 0.3);
}

.auth-brand {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: #101713;
  font-size: 18px;
  font-weight: 900;
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

h1 {
  max-width: 390px;
  margin: 0 0 36px;
  color: #172319;
  font-size: clamp(34px, 3vw, 43px);
  font-weight: 800;
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
  font-weight: 700;
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
  font-weight: 800;
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
  font-weight: 600;
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
  font-weight: 800;
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
  font-weight: 600;
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
  font-weight: 700;
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
  font-weight: 700;
}

@media (max-width: 700px) {
  .auth-page {
    background: #fff;
    padding: 0;
  }

  .auth-page__backdrop {
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
</style>
