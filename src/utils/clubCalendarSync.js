const CHANNEL_NAME = 'gorra-club-calendar'
const STORAGE_KEY = 'gorra-club-calendar-sync'
export function notifyClubCalendarChange() {
  if (typeof window === 'undefined') return
  const message = { type: 'scheduled-match', at: Date.now() }
  let delivered = false
  try { const channel = new BroadcastChannel(CHANNEL_NAME); channel.postMessage(message); channel.close(); delivered = true } catch {}
  if (!delivered) { try { window.localStorage.setItem(STORAGE_KEY, String(message.at)) } catch {} }
}
export function subscribeToClubCalendarChanges(onChange) {
  if (typeof window === 'undefined') return () => {}
  let channel
  const handleMessage = () => onChange()
  const handleStorage = (event) => { if (event.key === STORAGE_KEY) onChange() }
  try { channel = new BroadcastChannel(CHANNEL_NAME); channel.addEventListener('message', handleMessage) } catch {}
  window.addEventListener('storage', handleStorage)
  return () => { channel?.removeEventListener('message', handleMessage); channel?.close(); window.removeEventListener('storage', handleStorage) }
}