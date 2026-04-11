-- CreateTable: time_slot_templates
CREATE TABLE IF NOT EXISTS "time_slot_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleset_json" TEXT NOT NULL
);

-- CreateTable: appointments
CREATE TABLE IF NOT EXISTS "appointments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "time_slot_template_id" TEXT NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
    "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);

-- CreateTable: participants
CREATE TABLE IF NOT EXISTS "participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appointment_id" TEXT NOT NULL REFERENCES "appointments"("id") ON DELETE CASCADE,
    "nickname" TEXT NOT NULL,
    "pin_hash" TEXT,
    "submitted_at" TEXT,
    "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE ("appointment_id", "nickname")
);

-- CreateTable: slot_availability
CREATE TABLE IF NOT EXISTS "slot_availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appointment_id" TEXT NOT NULL REFERENCES "appointments"("id") ON DELETE CASCADE,
    "participant_id" TEXT NOT NULL REFERENCES "participants"("id") ON DELETE CASCADE,
    "slot_key" TEXT NOT NULL,
    "submitted_at" TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE ("appointment_id", "slot_key", "participant_id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "slot_availability_appointment_slot_idx" ON "slot_availability"("appointment_id", "slot_key");
CREATE INDEX IF NOT EXISTS "slot_availability_participant_idx" ON "slot_availability"("participant_id");
