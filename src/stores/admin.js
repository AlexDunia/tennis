import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ADMIN_SETUP_STEPS, createDefaultClubSetup } from '../config/admin'
import { getClubSetup, saveClubSetup, saveClubSetupDraft } from '../services/AdminService'
import { useAuthStore } from './auth'

export const useAdminStore = defineStore('admin', () => {
  const authStore = useAuthStore()
  const setup = ref(createDefaultClubSetup())
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref('')

  const isConfigured = computed(
    () => setup.value.status === 'active' && setup.value.completedStep === ADMIN_SETUP_STEPS.length,
  )
  const activeLadders = computed(() => setup.value.ladders.filter((ladder) => ladder.enabled))

  async function loadSetup() {
    isLoading.value = true
    error.value = ''
    try {
      setup.value = await getClubSetup()
      return setup.value
    } catch (loadError) {
      error.value = loadError?.message || 'Unable to load the club setup.'
      throw loadError
    } finally {
      isLoading.value = false
    }
  }

  async function saveDraft(input) {
    isSaving.value = true
    error.value = ''
    try {
      setup.value = await saveClubSetupDraft(input, authStore.accessProfile)
      return setup.value
    } catch (saveError) {
      error.value = saveError?.message || 'Unable to save the setup draft.'
      throw saveError
    } finally {
      isSaving.value = false
    }
  }

  async function publishSetup(input) {
    isSaving.value = true
    error.value = ''
    try {
      setup.value = await saveClubSetup(input, authStore.accessProfile)
      return setup.value
    } catch (saveError) {
      error.value = saveError?.message || 'Unable to publish the club setup.'
      throw saveError
    } finally {
      isSaving.value = false
    }
  }

  return {
    setup,
    isLoading,
    isSaving,
    error,
    isConfigured,
    activeLadders,
    loadSetup,
    saveDraft,
    publishSetup,
  }
})
