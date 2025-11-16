-- Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  nickname VARCHAR(60) NOT NULL,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (appointment_id, nickname)
);

CREATE TABLE IF NOT EXISTS slot_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  slot_key VARCHAR(64) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (appointment_id, slot_key, participant_id)
);

CREATE INDEX IF NOT EXISTS slot_availability_appointment_slot_idx
  ON slot_availability(appointment_id, slot_key);

CREATE INDEX IF NOT EXISTS slot_availability_participant_idx
  ON slot_availability(participant_id);
