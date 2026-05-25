import ApiService from './ApiService'

export async function getTournaments() {
  const response = await ApiService.get('/tournaments')
  return response.data
}

export async function getTournament(tournamentId) {
  const response = await ApiService.get(`/tournaments/${tournamentId}`)
  return response.data
}

export async function createTournamentRequest(payload) {
  const response = await ApiService.post('/tournaments', payload)
  return response.data
}

export async function updateTournamentRequest(tournamentId, payload) {
  const response = await ApiService.put(`/tournaments/${tournamentId}`, payload)
  return response.data
}

export async function generateFixturesRequest(tournamentId, categoryId) {
  const response = await ApiService.post(
    `/tournaments/${tournamentId}/categories/${categoryId}/generate-fixtures`,
  )
  return response.data
}

export async function closeRoundRobinRequest(tournamentId, categoryId) {
  const response = await ApiService.post(
    `/tournaments/${tournamentId}/categories/${categoryId}/close-round-robin`,
  )
  return response.data
}

export async function getScheduleRequest(tournamentId) {
  const response = await ApiService.get(`/tournaments/${tournamentId}/schedule`)
  return response.data
}
