# Ladder match workspace v1

## Decision

Implementation 1 is local-first. Do not add a Laravel migration, model, controller, route, queue, or autosave request. Individual/Bulk mode, uncommitted Bulk drafts, and an Individual challenger selection are Pinia plus localStorage only. Search, hover, drag, modal and calendar posture remain memory-only. Real matches stay behind the existing authoritative API.

## Canonical future DTO

`exportLadderSnapshot(clubId, ladderId)` returns a versioned draft DTO containing only schema metadata, opaque club/ladder/player IDs, timestamps, and draft pairing IDs. It is never permission, membership, eligibility, availability, rank, or match evidence.

## Future sync boundary

Only if cross-device drafts become necessary, use:

- `GET /api/v1/clubs/{club}/ladders/{ladder}/workspace-draft`
- `PUT /api/v1/clubs/{club}/ladders/{ladder}/workspace-draft`
- `DELETE /api/v1/clubs/{club}/ladders/{ladder}/workspace-draft`

Laravel must authenticate the actor, derive identity from the request, scope ladder to club, require membership and match-management permission, verify each player belongs to the ladder, bound payloads, use optimistic concurrency, rate-limit writes, return `Cache-Control: private, no-store`, and revalidate all rules when committing a real match. Never accept `user_id` from draft JSON.

Mode is a user preference, not ladder configuration. A future server table may use a unique `(user_id, club_id, ladder_id, kind)` draft record with versioned JSON payload.

```text
local draft -> commit attempt -> Laravel authorization, membership, eligibility and availability validation -> canonical match/challenge
```