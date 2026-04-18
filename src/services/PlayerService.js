import ApiService from './ApiService'

export async function getPlayers() {
  const response = await ApiService.get('/players')
  return response.data
}

export async function getPlayerById(playerId) {
  const response = await ApiService.get('/players')
  return response.data.data.find((player) => player.id === playerId)
}
