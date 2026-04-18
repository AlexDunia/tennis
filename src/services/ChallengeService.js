import ApiService from './ApiService'

export async function getChallenges() {
  const response = await ApiService.get('/challenges')
  return response.data
}

export async function createChallenge(payload) {
  const response = await ApiService.post('/challenges', payload)
  return response.data
}

export async function acceptChallenge(challengeId, scheduledAt) {
  const response = await ApiService.post(`/challenges/${challengeId}/accept`, { scheduledAt })
  return response.data
}

export async function reviewChallenge(challengeId) {
  const response = await ApiService.post(`/challenges/${challengeId}/review`, {})
  return response.data
}
