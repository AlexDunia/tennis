-- Gorra multi-club membership model (PostgreSQL).
-- Invitation secrets are generated with a cryptographically secure random source.
-- The application hashes each secret with SHA-256 before it reaches this database.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE club_membership_role AS ENUM ('admin', 'co-admin', 'player');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 100),
  phone text,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  logo_url text,
  location text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'Africa/Lagos',
  courts text[] NOT NULL DEFAULT '{}',
  season_start date,
  season_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clubs_season_dates_valid CHECK (
    season_start IS NULL OR season_end IS NULL OR season_end >= season_start
  )
);

CREATE TABLE club_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  role club_membership_role NOT NULL DEFAULT 'player',
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_memberships_user_club_unique UNIQUE (user_id, club_id)
);

-- This table stores the club currently shown to a user. The composite foreign
-- key means a user can select only a club they actually belong to.
CREATE TABLE user_active_clubs (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  club_id uuid NOT NULL,
  selected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_active_clubs_membership_fk
    FOREIGN KEY (user_id, club_id)
    REFERENCES club_memberships(user_id, club_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

CREATE TABLE club_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  role club_membership_role NOT NULL DEFAULT 'player',
  -- Exactly 32 bytes: SHA-256(secret). There is intentionally no raw token column.
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  created_by_user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_invitations_creator_membership_fk
    FOREIGN KEY (created_by_user_id, club_id)
    REFERENCES club_memberships(user_id, club_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT club_invitations_acceptance_valid CHECK (
    (accepted_at IS NULL AND accepted_by_user_id IS NULL)
    OR (accepted_at IS NOT NULL AND accepted_by_user_id IS NOT NULL)
  )
);

CREATE INDEX club_memberships_club_role_idx
  ON club_memberships (club_id, role);

CREATE INDEX club_memberships_user_idx
  ON club_memberships (user_id);

CREATE INDEX club_invitations_open_idx
  ON club_invitations (club_id, expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX club_invitations_creator_idx
  ON club_invitations (created_by_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER clubs_set_updated_at
BEFORE UPDATE ON clubs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER club_memberships_set_updated_at
BEFORE UPDATE ON club_memberships
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN club_invitations.token_hash IS
  'SHA-256 hash of a cryptographically random invite secret; never store the raw secret.';

COMMENT ON TABLE user_active_clubs IS
  'One active club selection per user, constrained to an existing membership.';
