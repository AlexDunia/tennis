function numericPriority(candidate) {
  const value = Number(candidate?.priority)

  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY
}

function numericSortTime(candidate) {
  const value = Number(candidate?.sortAt)

  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
}

/*
 * Home Priority arbitration.
 *
 * Individual domain resolvers decide whether a real
 * state deserves consideration.
 *
 * This function decides which candidate wins.
 *
 * It has:
 * - no router
 * - no storage
 * - no Vue
 * - no mutations
 *
 * Future Laravel data can feed this exact contract.
 */
export function resolveHomePriorities(candidates = []) {
  if (!Array.isArray(candidates)) {
    return []
  }

  const eligible = candidates.filter(
    (candidate) =>
      candidate && typeof candidate === 'object' && Number.isFinite(Number(candidate.priority)),
  )

  if (!eligible.length) {
    return []
  }

  return [...eligible].sort((left, right) => {
    const priorityDifference = numericPriority(right) - numericPriority(left)

    if (priorityDifference) {
      return priorityDifference
    }

    /*
     * Same priority family:
     * the nearest meaningful time wins.
     */
    const timeDifference = numericSortTime(left) - numericSortTime(right)

    if (Number.isFinite(timeDifference) && timeDifference !== 0) {
      return timeDifference
    }

    /*
     * Stable final tie-breaker so ordering never
     * depends on browser implementation details.
     */
    return String(left.id || '').localeCompare(String(right.id || ''))
  })
}

export function resolveHomePriority(candidates = []) {
  return resolveHomePriorities(candidates)[0] || null
}
