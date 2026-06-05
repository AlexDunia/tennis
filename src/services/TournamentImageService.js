import ApiService from './ApiService'

export async function getTournamentImages(tournamentId) {
  const response = await ApiService.get(`/tournaments/${tournamentId}/images`)
  return response.data
}

export async function getTournamentImage(tournamentId, imageId) {
  const response = await ApiService.get(`/tournaments/${tournamentId}/images/${imageId}`)
  return response.data
}

export async function createTournamentImage(tournamentId, payload) {
  const response = await ApiService.post(`/tournaments/${tournamentId}/images`, payload)
  return response.data
}

export async function deleteTournamentImage(tournamentId, imageId) {
  const response = await ApiService.delete(`/tournaments/${tournamentId}/images/${imageId}`)
  return response.data
}
