// Tests for spec: agent/specs/meal-appointment-view-appointment-frontend-test-spec.md

import { describe, expect, it } from 'vitest';
import { buildParticipantMatrix } from '../utils/buildParticipantMatrix.js';
import {
  formatSlotKey,
  formatSlotSummary,
  getDisplayDate,
  getWeekdayLabel
} from '../utils/formatSlot.js';
import { groupSlotSummaries } from '../utils/groupSlotSummaries.js';
import type { AppointmentViewResponse, SlotSummary } from '../api/getAppointment.js';

const slotSummaries: SlotSummary[] = [
  { slotKey: '2024-05-03#LUNCH', date: '2024-05-03', mealType: 'LUNCH', availableCount: 2, availabilityRatio: 0.75 },
  { slotKey: '2024-05-03#DINNER', date: '2024-05-03', mealType: 'DINNER', availableCount: 1, availabilityRatio: 0.55 },
  { slotKey: '2024-05-04#BREAKFAST', date: '2024-05-04', mealType: 'BREAKFAST', availableCount: 0, availabilityRatio: 0.2 }
];

const participants: AppointmentViewResponse['participants'] = [
  { participantId: 'p1', nickname: '알파', submittedAt: '2024-05-02T12:00:00.000Z', responses: ['2024-05-03#LUNCH'] },
  { participantId: 'p2', nickname: '베타', submittedAt: '2024-05-02T13:00:00.000Z', responses: ['2024-05-03#LUNCH', '2024-05-03#DINNER'] }
];

describe('slot formatter utilities', () => {
  it('converts slot summary ratios to formatted labels and tones', () => {
    const formatted = slotSummaries.map(formatSlotSummary);
    expect(formatted[0]).toMatchObject({ ratioLabel: '75% 응답', ratioTone: 'primary', mealLabel: '점심' });
    expect(formatted[1]).toMatchObject({ ratioLabel: '55% 응답', ratioTone: 'warning', mealLabel: '저녁' });
    expect(formatted[2]).toMatchObject({ ratioLabel: '20% 응답', ratioTone: 'error', mealLabel: '아침' });
  });

  it('groups slot summaries by date and sorts in ascending order', () => {
    const grouped = groupSlotSummaries(slotSummaries);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ date: '2024-05-03', summaries: [{ mealLabel: '점심' }, { mealLabel: '저녁' }] });
    expect(grouped[1].date).toBe('2024-05-04');
  });

  it('formats slot keys into readable labels', () => {
    expect(formatSlotKey('2024-05-03#LUNCH')).toContain('5월 3일 점심');
  });

  it('builds a participant matrix aligned with slot summaries', () => {
    const matrix = buildParticipantMatrix(participants, slotSummaries);
    expect(matrix).toHaveLength(3);
    expect(matrix[0]).toMatchObject({ slotKey: '2024-05-03#LUNCH', participants: ['알파', '베타'] });
    expect(matrix[2]).toMatchObject({ slotKey: '2024-05-04#BREAKFAST', participants: [] });
  });

  it('exposes Korean formatted dates and weekdays', () => {
    expect(getDisplayDate('2024-05-03')).toContain('5월');
    expect(getWeekdayLabel('2024-05-03')).not.toHaveLength(0);
  });
});
