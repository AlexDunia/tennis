import ApiService from './ApiService'

export async function getChallenges() {
  const response = await ApiService.get('/challenges')
  return response.data
}

export async function createChallenge(payload) {
  const response = await ApiService.post('/challenges', payload)
  return response.data
}

export async function acceptChallenge(challengeId, scheduledAt, actorId) {
  const response = await ApiService.post(`/challenges/${challengeId}/accept`, { scheduledAt, actorId })
  return response.data
}

export async function reviewChallenge(challengeId, actorId) {
  const response = await ApiService.post(`/challenges/${challengeId}/review`, { actorId })
  return response.data
}

export async function declineChallenge(challengeId, actorId) {
  const response = await ApiService.post(`/challenges/${challengeId}/decline`, { actorId })
  return response.data
}

export async function withdrawChallenge(challengeId, actorId) {
  const response = await ApiService.post(`/challenges/${challengeId}/withdraw`, { actorId })
  return response.data
}
