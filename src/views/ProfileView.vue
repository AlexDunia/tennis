<script setup>
// IMPORTS
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import PersonAvatar from '../components/PersonAvatar.vue'

// PROPS
// none

// EMITS
// none

// ROUTER / ROUTE
// none

// STORES
const authStore = useAuthStore()

// REACTIVE STATE
// none

// COMPUTED PROPERTIES
const profileName = computed(() => authStore.user?.name ?? 'Shell player')
const profileEmail = computed(() => authStore.user?.email ?? 'player@shell.com')
const statusTag = computed(() => (authStore.isLoggedIn ? 'Active access' : 'Guest'))
const profileAvatar = computed(() => authStore.user?.avatar || '')

// METHODS
// none

// WATCHERS
// none

// LIFECYCLE HOOKS
// none
</script>

<template>
  <section class="profile">
    <header class="profile__header">
      <h1 class="profile__title">My profile</h1>
      <p class="profile__status">{{ statusTag }}</p>
    </header>
    <div class="profile__card">
      <PersonAvatar :image="profileAvatar" :name="profileName" size="72" class="profile__avatar" />
      <p class="profile__name">{{ profileName }}</p>
      <p class="profile__email">{{ profileEmail }}</p>
      <p class="profile__detail">
        Court bookings, match history, and scoreboard credentials are synced locally with your Shell
        account.
      </p>
    </div>
  </section>
</template>

<style scoped>
.profile {
  padding: 2rem 1.25rem;
}
.profile__card {
  margin-top: 1rem;
  background: #fff;
  border-radius: 1.25rem;
  padding: 1.5rem;
  box-shadow: 0 35px 70px rgba(0, 0, 0, 0.08);
}

.profile__avatar {
  display: block;
  margin: 0 auto 1rem;
}

.profile__title {
  margin: 0;
}
.profile__status {
  margin: 0.5rem 0 0;
  color: rgba(0, 0, 0, 0.6);
}
.profile__name {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}
.profile__email {
  margin: 0.35rem 0;
  color: rgba(0, 0, 0, 0.65);
}
.profile__detail {
  margin: 0;
  color: rgba(0, 0, 0, 0.6);
}
</style>
