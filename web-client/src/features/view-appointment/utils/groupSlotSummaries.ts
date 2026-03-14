// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

import type { SlotSummary } from '../api/getAppointment.js';
import { formatSlotSummary, getDisplayDate, getWeekdayLabel, type FormattedSlotSummary } from './formatSlot.js';

export type SlotGroup = {
  date: string;
  displayDate: string;
  weekdayLabel: string;
  summaries: FormattedSlotSummary[];
};

export function groupSlotSummaries(slotSummaries: SlotSummary[]): SlotGroup[] {
  const today = new Date().toISOString().slice(0, 10);
  const grouped = new Map<string, SlotGroup>();

  slotSummaries.filter((s) => s.date >= today).forEach((summary) => {
    const formatted = formatSlotSummary(summary);
    const existing = grouped.get(summary.date);
    if (!existing) {
      grouped.set(summary.date, {
        date: summary.date,
        displayDate: getDisplayDate(summary.date),
        weekdayLabel: getWeekdayLabel(summary.date),
        summaries: [formatted]
      });
      return;
    }
    existing.summaries.push(formatted);
  });

  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
}
