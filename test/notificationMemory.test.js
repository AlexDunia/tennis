import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const storeSource = readFileSync(
  'src/stores/notification.js',
  'utf8',
)

const shelfSource = readFileSync(
  'src/components/ToastShelf.vue',
  'utf8',
)

const soundSource = readFileSync(
  'src/utils/notificationSound.js',
  'utf8',
)

test('Gorra toast feedback uses the Notification memory contract', () => {
  assert.match(storeSource, /duration = 5000/)
  assert.match(storeSource, /sound = 'toast'/)
  assert.match(storeSource, /toasts\.value\.unshift\(toast\)/)

  assert.doesNotMatch(shelfSource, /toast__progress/)
  assert.doesNotMatch(shelfSource, /toastProgress/)
  assert.match(shelfSource, /toast__close/)
  assert.match(shelfSource, /background:\s*#163d2b/)
  assert.match(shelfSource, /width:\s*min\(326px,\s*85vw\)/)
})

test('toast and ladder movement sounds use native Web Audio rather than a plugin', () => {
  assert.match(soundSource, /AudioContext/)
  assert.match(soundSource, /playToastPop/)
  assert.match(soundSource, /playLadderMoveClick/)
  assert.doesNotMatch(soundSource, /new Audio\(/)
})

