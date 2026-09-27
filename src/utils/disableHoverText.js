function removeTitle(element) {
  if (element instanceof Element && element.hasAttribute('title')) {
    element.removeAttribute('title')
  }
}

function removeTitlesFrom(node) {
  if (node instanceof Element) {
    removeTitle(node)
    node.querySelectorAll('[title]').forEach(removeTitle)
    return
  }

  if (node instanceof Document) {
    node.querySelectorAll('[title]').forEach(removeTitle)
  }
}

// Native `title` popovers are hover-only text. Keep names in aria-labels instead.
export function suppressNativeHoverText(root = document) {
  removeTitlesFrom(root)

  const observedRoot = root instanceof Document ? root.documentElement : root
  if (!observedRoot) return () => {}

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        removeTitle(mutation.target)
        return
      }

      mutation.addedNodes.forEach(removeTitlesFrom)
    })
  })

  observer.observe(observedRoot, {
    attributes: true,
    attributeFilter: ['title'],
    childList: true,
    subtree: true,
  })

  return () => observer.disconnect()
}