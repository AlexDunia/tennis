import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ADMIN_SETUP_STEPS, createDefaultClubSetup } from '../config/admin.js'
import {
  discardClubSetupDraft,
  getClubDirectory,
  getClubSetup,
  joinClubWithInvite,
  previewClubInvite,
  rotateClubInvite,
  saveClubSetup,
  saveClubSetupDraft,
  switchActiveClub,
  updateActiveClubSetup,
} from '../services/AdminService.js'
import { sanitizeDirectoryId } from '../utils/admin/clubSetup.js'
import { useAuthStore } from './auth.js'

export const useAdminStore = defineStore('admin', () => {
  const authStore = useAuthStore()
  const setup = ref(createDefaultClubSetup())
  const clubs = ref([])
  const memberships = ref([])
  const activeClubId = ref('')
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref('')

  function actor() {
    const user = authStore.user || {}
    return {
      ...authStore.accessProfile,
      userId: user.id || user.playerId || user.email || '',
      id: user.id || '',
      playerId: user.playerId || '',
      email: user.email || '',
    }
  }

  function currentUserId() {
    const value = actor()
    return sanitizeDirectoryId(value.userId || value.id || value.playerId || value.email)
  }

  function applyDirectory(directory) {
    clubs.value = Array.isArray(directory?.clubs) ? directory.clubs : []
    memberships.value = Array.isArray(directory?.memberships) ? directory.memberships : []
    activeClubId.value = directory?.activeClubId || ''
  }

  const activeClub = computed(
    () => clubs.value.find((club) => club.id === activeClubId.value) || null,
  )
  const clubOptions = computed(() => {
    const userId = currentUserId()
    return clubs.value.map((club) => ({
      id: club.id,
      name: club.name,
      role:
        memberships.value.find(
          (membership) => membership.userId === userId && membership.clubId === club.id,
        )?.role || 'player',
    }))
  })
  const hasMultipleClubs = computed(() => clubOptions.value.length > 1)
  const isConfigured = computed(() => {
    const activeSetup = activeClub.value?.setup
    return Boolean(
      activeSetup?.status === 'active' && activeSetup.completedStep === ADMIN_SETUP_STEPS.length,
    )
  })
  const activeLadders = computed(() => {
    const source = activeClub.value?.setup || setup.value
    return source.ladders.filter((ladder) => ladder.enabled && !ladder.archived)
  })
  const resumeStep = computed(() => {
    const nextIndex = Math.min(
      Math.max(Number(setup.value.completedStep) || 0, 0),
      ADMIN_SETUP_STEPS.length - 1,
    )
    return ADMIN_SETUP_STEPS[nextIndex]?.key || 'workspace'
  })

  async function loadClubs() {
    isLoading.value = true
    error.value = ''
    try {
      const directory = await getClubDirectory(actor())
      applyDirectory(directory)
      return clubs.value
    } catch (loadError) {
      error.value = loadError?.message || 'Unable to load your clubs.'
      throw loadError
    } finally {
      isLoading.value = false
    }
  }

  async function loadSetup() {
    isLoading.value = true
    error.value = ''
    try {
      const directory = await getClubDirectory(actor())
      applyDirectory(directory)
      setup.value = await getClubSetup(actor())
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
      setup.value = await saveClubSetupDraft(input, actor())
      return setup.value
    } catch (saveError) {
      error.value = saveError?.message || 'Unable to save the setup draft.'
      throw saveError
    } finally {
      isSaving.value = false
    }
  }

  async function startFreshSetup() {
    return saveDraft(createDefaultClubSetup())
  }

  async function publishSetup(input) {
    isSaving.value = true
    error.value = ''
    try {
      setup.value = await saveClubSetup(input, actor())
      const directory = await getClubDirectory(actor())
      applyDirectory(directory)
      return setup.value
    } catch (saveError) {
      error.value = saveError?.message || 'Unable to publish the club setup.'
      throw saveError
    } finally {
      isSaving.value = false
    }
  }

  async function previewInvite(code) {
    error.value = ''
    try {
      return await previewClubInvite(code, actor())
    } catch (inviteError) {
      error.value = inviteError?.message || 'This invite code is not valid.'
      throw inviteError
    }
  }

  async function joinClub(code) {
    isSaving.value = true
    error.value = ''
    try {
      const result = await joinClubWithInvite(code, actor())
      const directory = await getClubDirectory(actor())
      applyDirectory(directory)
      setup.value = result.club?.setup || createDefaultClubSetup()
      return result
    } catch (joinError) {
      error.value = joinError?.message || 'Unable to join this club.'
      throw joinError
    } finally {
      isSaving.value = false
    }
  }

  async function switchClub(clubId) {
    isLoading.value = true
    error.value = ''
    try {
      const club = await switchActiveClub(clubId, actor())
      const directory = await getClubDirectory(actor())
      applyDirectory(directory)
      setup.value = club?.setup || createDefaultClubSetup()
      return club
    } catch (switchError) {
      error.value = switchError?.message || 'Unable to switch clubs.'
      throw switchError
    } finally {
      isLoading.value = false
    }
  }

  async function updateActiveClub(input) {
    isSaving.value = true
    error.value = ''
    try {
      const club = await updateActiveClubSetup(input, actor())
      const directory = await getClubDirectory(actor())
      applyDirectory(directory)
      setup.value = club.setup
      return club
    } catch (saveError) {
      error.value = saveError?.message || 'Unable to save the club changes.'
      throw saveError
    } finally {
      isSaving.value = false
    }
  }

  async function rotateInvite(role) {
    isSaving.value = true
    error.value = ''
    try {
      const invite = await rotateClubInvite(role, actor())
      const directory = await getClubDirectory(actor())
      applyDirectory(directory)
      setup.value =
        directory.clubs.find((club) => club.id === directory.activeClubId)?.setup || setup.value
      return invite
    } catch (rotateError) {
      error.value = rotateError?.message || 'Unable to make a new invite.'
      throw rotateError
    } finally {
      isSaving.value = false
    }
  }

  async function discardDraft() {
    isSaving.value = true
    error.value = ''
    try {
      setup.value = await discardClubSetupDraft(actor())
      const directory = await getClubDirectory(actor())
      applyDirectory(directory)
      return setup.value
    } catch (discardError) {
      error.value = discardError?.message || 'Unable to discard the draft.'
      throw discardError
    } finally {
      isSaving.value = false
    }
  }

  function clearError() {
    error.value = ''
  }

  return {
    setup,
    clubs,
    memberships,
    activeClubId,
    activeClub,
    clubOptions,
    hasMultipleClubs,
    isLoading,
    isSaving,
    error,
    isConfigured,
    activeLadders,
    resumeStep,
    loadClubs,
    loadSetup,
    startFreshSetup,
    saveDraft,
    publishSetup,
    previewInvite,
    joinClub,
    switchClub,
    updateActiveClub,
    rotateInvite,
    discardDraft,
    clearError,
  }
})
