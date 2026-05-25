import ApiService from './ApiService'

export async function getMatches() {
  const response = await ApiService.get('/matches')
  return response.data
}

export async function getMatch(matchId) {
  const response = await ApiService.get(`/matches/${matchId}`)
  return response.data
}

export async function updateMatch(matchId, payload) {
  const response = await ApiService.patch(`/matches/${matchId}`, payload)
  return response.data
}

export async function submitMatchResult(matchId, payload) {
  const response = await ApiService.post(`/matches/${matchId}/result`, payload)
  return response.data
}
