import { inject, onUnmounted, watchEffect } from 'vue'

export function useShellNestedHeader(factory) {
  const shell = inject('gorraShell', null)
  const owner = Symbol('gorra-nested-header')

  watchEffect(() => {
    const config = typeof factory === 'function' ? factory() : factory

    if (!config) {
      shell?.clearNestedHeader?.(owner)
      return
    }

    shell?.setNestedHeader?.(owner, config)
  })

  onUnmounted(() => {
    shell?.clearNestedHeader?.(owner)
  })
}
