# Authorization Backend Contract

The frontend currently supports local/demo roles, but the backend must be the source of truth in production.

## Current Local Admin

`player-02` is treated as `super_admin` locally. This is for development only.

## Backend User Shape

Return these fields from the authenticated user endpoint, for example `/api/me`:

```json
{
  "id": "player-02",
  "name": "Henry Dunia",
  "email": "henry@example.com",
  "roleKey": "super_admin",
  "roles": ["super_admin"],
  "permissions": ["*"]
}
```

For a normal player:

```json
{
  "id": "player-14",
  "name": "Ifeoma Umeh",
  "email": "ifeoma@example.com",
  "roleKey": "player",
  "roles": ["player"],
  "permissions": [
    "tournaments.view",
    "matches.view",
    "rankings.view",
    "challenges.create"
  ]
}
```

## Supported Role Keys

- `player`
- `tournament_admin`
- `super_admin`

## Important Security Rule

The frontend can hide or show buttons, but it must not be trusted for authorization.

Laravel must enforce permissions on protected endpoints, especially:

- creating/updating tournaments
- generating fixtures
- opening/using live scoring
- submitting scores
- closing group stage
- generating knockout
- assigning roles

## Role Assignment

Admins should not be made admin by editing frontend state. In production, use a backend-only action such as:

`PATCH /api/admin/users/{user}/role`

Example payload:

```json
{
  "roleKey": "tournament_admin"
}
```

Only an existing `super_admin` should be allowed to call that endpoint.
