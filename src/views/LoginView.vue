<script setup>
// IMPORTS
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

// PROPS
// none

// EMITS
// none

// ROUTER / ROUTE
const router = useRouter()

// STORES
const authStore = useAuthStore()

// REACTIVE STATE
const username = ref('')
const password = ref('')
const errorMessage = ref('')

// COMPUTED PROPERTIES
// none

// METHODS
async function handleLogin() {
  try {
    errorMessage.value = ''
    await authStore.login({ username: username.value, password: password.value })
    router.push('/dashboard')
  } catch (error) {
    errorMessage.value = error.message ?? 'Invalid credentials'
  }
}

// WATCHERS
// none

// LIFECYCLE HOOKS
// none
</script>

<template>
  <section class="login">
    <div class="login__card">
      <h1 class="login__title">Log in to ShellTennis</h1>
      <p class="login__lead">Secure access for Port Harcourt court, matches, and live scoreboard.</p>
      <form class="login__form" @submit.prevent="handleLogin">
        <label class="login__label" for="username">Shell email</label>
        <input class="login__input" id="username" v-model="username" type="text" required />
        <label class="login__label" for="password">Password</label>
        <input class="login__input" id="password" v-model="password" type="password" required />
        <p v-if="errorMessage" class="login__error">{{ errorMessage }}</p>
        <button class="login__button" type="submit">{{ authStore.isAuthLoading ? 'Signing in...' : 'Sign in' }}</button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.login {
  min-height: calc(100vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}
.login__card {
  max-width: 420px;
  width: 100%;
  background: #fff;
  border-radius: 1.25rem;
  padding: 2rem;
  box-shadow: 0 40px 80px rgba(0, 0, 0, 0.15);
}
.login__title {
  margin: 0;
  font-size: 1.75rem;
}
.login__lead {
  margin: 0.35rem 0 1.5rem;
  color: rgba(0, 0, 0, 0.65);
}
.login__form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.login__label {
  font-weight: 600;
}
.login__input {
  border-radius: 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.25);
  padding: 0.85rem;
  font-size: 1rem;
}
.login__button {
  margin-top: 1rem;
  border: none;
  border-radius: 0.9rem;
  background: #bf0a30;
  color: #fff;
  padding: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}
.login__error {
  margin: 0;
  color: #bf0a30;
  font-weight: 600;
}
</style>
