<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import { useAuthStore } from '../stores/auth.js'
import {
  joinLadderWithInvite,
  previewLadderInvite,
} from '../services/AdminService.js'
import { ladderEligibilityMissingFields } from '../domain/ladderWorkspace.js'
import '../assets/ladder-workspace.css'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const ready = ref(false)
const busy = ref(false)
const error = ref('')
const success = ref(false)
const preview = ref(null)

const form = reactive({
  name: '',
  email: '',
  phone: '',
  gender: '',
  dob: '',
})

const token = computed(() => String(route.params.token || ''))
const knownProfile = computed(() => preview.value?.knownProfile || null)

const combinedProfile = computed(() => ({
  ...(knownProfile.value || {}),
  ...Object.fromEntries(
    Object.entries(form).filter(([, value]) =>
      String(value || '').trim(),
    ),
  ),
}))

const missing = computed(() =>
  preview.value
    ? ladderEligibilityMissingFields(
        preview.value.eligibility,
        combinedProfile.value,
      )
    : [],
)

const needsGender = computed(
  () =>
    preview.value?.eligibility?.gender !== 'any' &&
    (!knownProfile.value?.gender || missing.value.includes('gender')),
)

const needsDob = computed(
  () =>
    preview.value?.eligibility?.age?.mode === 'range' &&
    (!knownProfile.value?.dob || missing.value.includes('dob')),
)

const needsClubLevel = computed(() =>
  missing.value.includes('clubLevel'),
)

const needsRating = computed(() =>
  missing.value.includes('rating'),
)

const knownIneligible = computed(
  () =>
    preview.value?.eligibilityResult?.complete === true &&
    preview.value?.eligibilityResult?.eligible === false,
)

const canSubmit = computed(
  () =>
    !busy.value &&
    !needsClubLevel.value &&
    !needsRating.value &&
    !knownIneligible.value,
)

function actor() {
  const user = authStore.user || {}

  return {
    userId: user.id || user.playerId || user.email || '',
    id: user.id || '',
    playerId: user.playerId || '',
    email: user.email || '',
  }
}

function applyKnownProfile() {
  const profile = knownProfile.value
  if (!profile) return

  form.name = profile.name || ''
  form.email = profile.email || ''
  form.phone = profile.phone || ''
  form.gender = profile.gender || ''
  form.dob = profile.dob || ''
}

async function load() {
  error.value = ''

  try {
    const result = await previewLadderInvite(token.value, actor())

    preview.value = {
      ...result,
      eligibility: result.eligibilityRules,
    }

    if (result.knownProfile) applyKnownProfile()
    if (result.alreadyJoined) success.value = true
  } catch (loadError) {
    error.value =
      loadError?.message || 'This ladder invite is not available.'
  } finally {
    ready.value = true
  }
}

async function join() {
  if (!canSubmit.value) return

  busy.value = true
  error.value = ''

  try {
    await joinLadderWithInvite(token.value, form, actor())
    success.value = true
  } catch (joinError) {
    error.value = joinError?.message || 'Unable to join this ladder.'
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="ladder-workspace-page">
    <template v-if="ready && preview">
      <header class="ladder-workspace-page__header">
        <p class="ladder-workspace-page__eyebrow">{{ preview.clubName }}</p>
        <h1>{{ preview.ladderName }}</h1>
        <p class="ladder-workspace-page__description">
          {{ preview.requirementsLabel }}
        </p>
      </header>

      <section v-if="success" class="lw-section">
        <p class="lw-success">
          You’re on the list for {{ preview.ladderName }}. The club administrator
          will choose your starting position.
        </p>

        <BaseButton
          v-if="authStore.isAuthenticated"
          @click="router.push({ name: 'Rankings' })"
        >
          Open GORRA
        </BaseButton>
      </section>

      <form v-else class="lw-form" @submit.prevent="join">
        <p v-if="error" class="lw-alert" role="alert">{{ error }}</p>

        <section class="lw-section">
          <div class="lw-section__heading">
            <h2>
              {{
                knownProfile
                  ? `Join ${preview.ladderName}`
                  : 'Join this ladder'
              }}
            </h2>
            <p v-if="knownProfile">
              GORRA already knows your profile. We only ask for a personal
              detail when this ladder actually needs it.
            </p>
          </div>

          <p v-if="needsClubLevel" class="lw-note">
            This ladder uses a club-set playing level. A {{ preview.clubName }}
            admin needs to set your level before GORRA can confirm that you can
            join.
          </p>

          <p v-else-if="knownIneligible" class="lw-note">
            Your current club information does not match this ladder’s
            requirements. Ask a club admin if your playing level needs review.
          </p>

          <div class="lw-grid">
            <label
              v-if="!knownProfile?.name"
              class="lw-field lw-field--full"
            >
              <span>Full name</span>
              <input
                v-model="form.name"
                maxlength="100"
                autocomplete="name"
                required
              />
            </label>

            <label v-if="!knownProfile?.email" class="lw-field">
              <span>Email</span>
              <input
                v-model="form.email"
                type="email"
                maxlength="254"
                autocomplete="email"
              />
            </label>

            <label v-if="!knownProfile?.phone" class="lw-field">
              <span>Phone number</span>
              <input
                v-model="form.phone"
                maxlength="30"
                inputmode="tel"
                autocomplete="tel"
              />
            </label>

            <label v-if="needsGender" class="lw-field">
              <span>Gender</span>
              <select v-model="form.gender" required>
                <option value="">Choose</option>
                <option value="men">Man</option>
                <option value="women">Woman</option>
              </select>
            </label>

            <label v-if="needsDob" class="lw-field">
              <span>Date of birth</span>
              <input
                v-model="form.dob"
                type="date"
                autocomplete="bday"
                required
              />
            </label>
          </div>
        </section>

        <footer class="lw-footer">
          <BaseButton type="submit" :disabled="!canSubmit">
            {{
              busy
                ? 'Joining…'
                : knownProfile
                  ? `Join ${preview.ladderName}`
                  : 'Join ladder'
            }}
          </BaseButton>
        </footer>
      </form>
    </template>

    <p v-else-if="ready" class="lw-alert" role="alert">
      {{ error }}
    </p>
  </main>
</template>
