import { validateMatchRulesSnapshot } from '../matchRules.js'

export function resolvedRuleAdapter(source, snapshot, warnings = []) {
  const validation = validateMatchRulesSnapshot(snapshot)
  if (!validation.valid) {
    return {
      ok: false,
      source,
      state: 'invalid',
      snapshot: null,
      issues: validation.errors,
      warnings: [...warnings, ...validation.warnings],
    }
  }
  return {
    ok: true,
    source,
    state: 'resolved',
    snapshot,
    issues: [],
    warnings: [...warnings, ...validation.warnings],
  }
}

export function unresolvedRuleAdapter(source, message, path = '') {
  return {
    ok: false,
    source,
    state: 'legacy_unresolved',
    snapshot: null,
    issues: [{ path, code: 'legacy_unresolved', message }],
    warnings: [],
  }
}
