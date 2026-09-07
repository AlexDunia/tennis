import { playLadderMoveClick } from './notificationSound'

const interactiveSelector = [
  'button', 'a[href]', 'summary', 'input', 'select', 'textarea',
  '[role="button"]', '[role="link"]', '[role="tab"]',
  '[role="menuitem"]', '[role="checkbox"]', '[role="switch"]',
].join(',')

export function installInteractionFeedback(root = document) {
  let pendingSound = null
  let lastClickAt = -Infinity

  const onClick = (event) => {
    if (!event.isTrusted) return

    const control = event.composedPath().find(
      (node) => node instanceof Element && node.matches(interactiveSelector),
    )

    if (!control || control.closest('[disabled], [aria-disabled="true"], [inert]')) return

    const requestedAt = performance.now()
    if (pendingSound !== null || requestedAt - lastClickAt < 100) return
    lastClickAt = requestedAt

    // Let the control's handler and Vue updates finish before doing audio work.
    pendingSound = window.setTimeout(() => {
      pendingSound = null
      if (root.visibilityState === 'hidden' || performance.now() - requestedAt > 120) return
      playLadderMoveClick().catch(() => {})
    }, 0)
  }

  root.addEventListener('click', onClick, true)
  return () => {
    root.removeEventListener('click', onClick, true)
    if (pendingSound !== null) window.clearTimeout(pendingSound)
  }
}
