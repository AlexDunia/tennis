# Club deletion v1 — backend contract

This is a destructive, server-authoritative action. The browser only collects an exact-name confirmation and renders the result. It must never be trusted to decide who can delete a club or which related records can survive.

## Endpoint

`DELETE /api/clubs/:clubId`

The frontend enables this endpoint with:

```env
VITE_API_BASE_URL=https://api.example.com
VITE_CLUB_DELETE_API=true
# Optional if the endpoint differs from /api/clubs/:clubId:
VITE_CLUB_DELETE_ENDPOINT=https://api.example.com/api/clubs/:clubId
```

The normal authenticated session/cookie authorizes the call. Do not accept an `actorId`, role, permission, or delete capability in the request body or URL.

### Request

```http
DELETE /api/clubs/clb_123
Accept: application/json
Content-Type: application/json
Idempotency-Key: 2a4a…
```

```json
{
  "confirmationName": "Greenview Tennis Club"
}
```

`Idempotency-Key` is required. Repeating the same key must return the original successful result, not perform a second destructive operation.

## Server authorization and validation

In this order, the server must:

1. Require an authenticated session (`401` otherwise).
2. Resolve the club from `clubId`; do not trust a client-supplied club object.
3. Lock the club row/aggregate for the transaction.
4. Confirm the caller is the club’s original creator (`403` otherwise). A co-admin cannot delete a club.
5. Compare `confirmationName` to the canonical current club name after the same server-side normalization used for club names (`422` if it differs).
6. Delete the club in one transaction. Concurrent delete attempts must resolve to the same idempotent result or a clean `404`/`409`, never partial cleanup.

## Transaction work

Hard-delete or cascade-delete all club-scoped operational records: memberships, invitations, member records, ladders and their entries, ladder asks/outbox items, tournaments, matches, challenges, courts, media references, and club settings. Revoke pending access records before deletion.

Keep only an immutable audit event/tombstone outside the deleted aggregate, with actor id, club id, timestamp, and reason `club_deleted`; never retain member profile data in that event.

For every affected user, recalculate their active club to their next active membership or `null`. This is part of the same transaction.

## Success response

Return a sanitized, current directory for the caller so the client can update immediately without reusing stale local club data:

```json
{
  "data": {
    "deletedClubId": "clb_123",
    "deletedClubName": "Greenview Tennis Club",
    "deletedAt": "2026-09-28T09:41:00.000Z",
    "activeClubId": "clb_987",
    "directory": {
      "schemaVersion": 2,
      "activeClubId": "clb_987",
      "clubs": [],
      "memberships": []
    }
  }
}
```

`directory` must be filtered for the authenticated caller just like the normal “my clubs” read. Do not return invitations, member private data, or data for inaccessible clubs.

## Errors

Use this shape for every error:

```json
{
  "error": {
    "code": "CLUB_DELETE_FORBIDDEN",
    "message": "Only the club creator can permanently delete this club."
  }
}
```

- `401 AUTH_REQUIRED`
- `403 CLUB_DELETE_FORBIDDEN`
- `404 CLUB_NOT_FOUND`
- `409 CLUB_DELETE_CONFLICT`
- `422 CLUB_DELETE_CONFIRMATION_MISMATCH`
- `429 RATE_LIMITED`

## Frontend behavior

The client sends only the name confirmation and authenticated request. On success it applies `directory`, returns to Clubs, and shows one success message. On failure it keeps the confirmation dialog open and displays the server message. The local-storage deletion path remains available only while `VITE_CLUB_DELETE_API` is not enabled.