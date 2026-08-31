# Admin Ladder Match backend contract

The Vue client calls this operation through ChallengeService; it does not write Ladder,
challenge, or match records directly.

## Read models

- GET /clubs/{clubId}/ladders/{ladderId} returns the Ladder identity, default rules, and
  ranked members.
- GET /clubs/{clubId}/ladders/{ladderId}/players/{playerId}/challenge-eligibility returns
  the authoritative eligible opponents and any blocking reason.

The current local frontend derives the same view from AdminStore, PlayerStore, and
LadderAccessService. The backend response becomes authoritative when these endpoints exist.

## Create operation

POST /admin/ladder-matches

Authentication supplies the acting user. The client payload is:

```json
{
  "ladderId": "open-singles",
  "challengerPlayerId": "player-05",
  "opponentPlayerId": "player-03",
  "timing": "now",
  "scheduledAt": null,
  "courtId": null,
  "matchRuleSource": "ladder_default",
  "matchRules": {
    "matchType": "singles",
    "matchFormat": "best_of_3",
    "setWinRule": "standard",
    "gameScoringRule": "normal",
    "finalSetRule": "same",
    "locked": true
  }
}
```

timing is now or scheduled. scheduledAt is required as an ISO-8601 timestamp for a
scheduled match. matchRuleSource is ladder_default or admin_override. When the Ladder
default is selected, the server ignores client-supplied rule values and applies its own current
default. An override is scoped to the created match and never mutates the Ladder configuration.

Success returns both records used by existing GORRA flows:

```json
{
  "success": true,
  "data": {
    "challenge": {},
    "match": {}
  }
}
```

For now, the match is returned in the state accepted by /play/{matchId}. For scheduled,
the match and challenge are returned in the existing scheduled lifecycle.

## Required backend validation

The backend must verify all of the following in one transaction:

- the actor can create a Ladder match on behalf of both players for the active club;
- the Ladder belongs to that club and is active;
- both players are active members of that Ladder;
- the opponent is inside the current challenge window;
- neither player has a blocking active challenge when the Ladder policy forbids it;
- rematch cooldown and other Ladder policies allow the pairing;
- a scheduled timestamp is valid and in the future;
- the selected court, if any, belongs to the club;
- Ladder defaults are loaded server-side;
- every admin override value is supported;
- the requested challenge/match state transition is valid;
- challenge and match records, audit actor, rule snapshot, and pre-match ranks persist atomically.

Expected validation failures use 403 for missing authority, 404 for records outside the
actor's club scope, 409 for lifecycle conflicts, and 422 for invalid eligibility, schedule,
court, or rule input.

## Current local-mode note

ApiService implements the same shape for the local mock. It validates ranking eligibility,
active-challenge limits, future scheduling, and supported rule values. It cannot provide secure
authorization because it runs in the browser; production authorization remains a backend
responsibility.
