-- Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ALTER COLUMN nickname TYPE VARCHAR(30);

ALTER TABLE slot_availability
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
