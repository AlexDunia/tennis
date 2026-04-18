const defaultDelay = 550

function createId(prefix = 'item') {
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now()}-${random}`
}

function createTimestamp() {
  return new Date().toISOString()
}

function fakeRequest(payload, delay = defaultDelay) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(payload), delay)
  })
}

export { fakeRequest, createId, createTimestamp }
