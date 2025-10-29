-- CreateTable
CREATE TABLE "TimeSlotTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rulesetJson" JSONB NOT NULL,
    CONSTRAINT "TimeSlotTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "timeSlotTemplateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "optionalPinHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SlotAvailability" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "slotInstanceId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SlotAvailability_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_timeSlotTemplateId_fkey" FOREIGN KEY ("timeSlotTemplateId") REFERENCES "TimeSlotTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Participant" ADD CONSTRAINT "Participant_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SlotAvailability" ADD CONSTRAINT "SlotAvailability_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SlotAvailability" ADD CONSTRAINT "SlotAvailability_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE UNIQUE INDEX "Participant_appointmentId_nickname_key" ON "Participant"("appointmentId", "nickname");

CREATE UNIQUE INDEX "SlotAvailability_appointmentId_slotInstanceId_participan_key" ON "SlotAvailability"("appointmentId", "slotInstanceId", "participantId");
