CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS "SlotAvailability" CASCADE;
DROP TABLE IF EXISTS "Participant" CASCADE;
DROP TABLE IF EXISTS "Appointment" CASCADE;

CREATE TABLE IF NOT EXISTS "time_slot_templates" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleset_json" JSONB NOT NULL
);

CREATE TABLE "appointments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "title" VARCHAR(60) NOT NULL,
    "summary" VARCHAR(200) NOT NULL DEFAULT '',
    "time_slot_template_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
