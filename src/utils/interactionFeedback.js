import { playLadderMoveClick } from './notificationSound'

const interactiveSelector = [
  'button', 'a[href]', 'summary', 'input', 'select', 'textarea',
  '[role="button"]', '[role="link"]', '[role="tab"]',
  '[role="menuitem"]', '[role="checkbox"]', '[role="switch"]',
].join(',')

export function installInteractionFeedback(root = document) {
  const onClick = (event) => {
    if (!event.isTrusted) return

    const control = event.composedPath().find(
      (node) => node instanceof Element && node.matches(interactiveSelector),
    )

    if (!control || control.closest('[disabled], [aria-disabled="true"], [inert]')) return

    playLadderMoveClick().catch(() => {})
  }

  root.addEventListener('click', onClick, true)
  return () => root.removeEventListener('click', onClick, true)
}
