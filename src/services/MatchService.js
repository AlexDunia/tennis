import ApiService from './ApiService'

export async function getMatches() {
  const response = await ApiService.get('/matches')
  return response.data
}

export async function submitMatchResult(matchId, payload) {
  const response = await ApiService.post(`/matches/${matchId}/result`, payload)
  return response.data
}
