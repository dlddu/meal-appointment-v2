// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

import type { AppointmentViewResponse } from '../api/getAppointment.js';
import { formatSlotKey } from './formatSlot.js';

export type ParticipantMatrixEntry = {
  slotKey: string;
  displayLabel: string;
  participants: string[];
};

export function buildParticipantMatrix(
  participants: AppointmentViewResponse['participants'],
  slotSummaries: AppointmentViewResponse['aggregates']['slotSummaries']
): ParticipantMatrixEntry[] {
  const map = new Map<string, string[]>();
  slotSummaries.forEach((summary) => {
    map.set(summary.slotKey, []);
  });

  participants.forEach((participant) => {
    participant.responses.forEach((slotKey) => {
      if (!map.has(slotKey)) {
        map.set(slotKey, []);
      }
      map.get(slotKey)!.push(participant.nickname);
    });
  });

  return slotSummaries.map((summary) => ({
    slotKey: summary.slotKey,
    displayLabel: formatSlotKey(summary.slotKey),
    participants: map.get(summary.slotKey) ?? []
  }));
}
