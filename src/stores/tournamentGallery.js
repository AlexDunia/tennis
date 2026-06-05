import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createTournamentImage,
  deleteTournamentImage,
  getTournamentImages,
} from '../services/TournamentImageService'

export const useTournamentGalleryStore = defineStore('tournamentGallery', () => {
  const images = ref([])
  const activeTournamentId = ref('')
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')

  async function fetchImages(tournamentId) {
    loading.value = true
    error.value = ''
    activeTournamentId.value = tournamentId

    try {
      const response = await getTournamentImages(tournamentId)
      if (response.success) {
        images.value = response.data
        return response.data
      }
      error.value = response.message || 'Unable to load tournament images.'
    } catch (fetchError) {
      error.value = fetchError?.message || 'Unable to load tournament images.'
    } finally {
      loading.value = false
    }

    images.value = []
    return []
  }

  async function addImage(tournamentId, payload) {
    saving.value = true
    error.value = ''

    try {
      const response = await createTournamentImage(tournamentId, payload)
      if (response.success) {
        images.value = [response.data, ...images.value]
        return response.data
      }
      error.value = response.message || 'Unable to add image.'
    } catch (saveError) {
      error.value = saveError?.message || 'Unable to add image.'
    } finally {
      saving.value = false
    }

    return null
  }

  async function removeImage(tournamentId, imageId) {
    saving.value = true
    error.value = ''

    try {
      const response = await deleteTournamentImage(tournamentId, imageId)
      if (response.success) {
        images.value = images.value.filter((image) => image.id !== imageId)
        return true
      }
      error.value = response.message || 'Unable to remove image.'
    } catch (deleteError) {
      error.value = deleteError?.message || 'Unable to remove image.'
    } finally {
      saving.value = false
    }

    return false
  }

  return {
    images,
    activeTournamentId,
    loading,
    saving,
    error,
    fetchImages,
    addImage,
    removeImage,
  }
})
