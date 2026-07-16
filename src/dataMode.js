import { ref } from 'vue'

export const APP_DATA_MODES = Object.freeze({
  EMPTY: 'empty',
  DEMO: 'demo',
})

export const DEFAULT_APP_DATA_MODE = APP_DATA_MODES.EMPTY
export const APP_DATA_MODE_STORAGE_KEY = 'gorra.appDataMode.v1'

function normalizeDataMode(mode) {
  return mode === APP_DATA_MODES.DEMO ? APP_DATA_MODES.DEMO : APP_DATA_MODES.EMPTY
}

function readStoredDataMode() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_APP_DATA_MODE
  }

  return normalizeDataMode(window.localStorage.getItem(APP_DATA_MODE_STORAGE_KEY))
}

export const appDataMode = ref(readStoredDataMode())

export function getAppDataMode() {
  return appDataMode.value
}

export function setAppDataMode(mode) {
  const nextMode = normalizeDataMode(mode)
  appDataMode.value = nextMode

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(APP_DATA_MODE_STORAGE_KEY, nextMode)
  }

  return nextMode
}

export function isEmptyDataMode() {
  return getAppDataMode() === APP_DATA_MODES.EMPTY
}
