// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

import type { SlotSummary } from '../api/getAppointment.js';

const mealLabels: Record<string, string> = {
  BREAKFAST: '아침',
  LUNCH: '점심',
  DINNER: '저녁'
};

type RatioTone = 'primary' | 'warning' | 'error';

export type FormattedSlotSummary = SlotSummary & {
  displayDate: string;
  weekdayLabel: string;
  mealLabel: string;
  ratioLabel: string;
  ratioTone: RatioTone;
};

export function getWeekdayLabel(date: string) {
  return new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(new Date(date));
}

export function getDisplayDate(date: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(date));
}

export function formatSlotSummary(summary: SlotSummary): FormattedSlotSummary {
  const ratio = summary.availabilityRatio ?? 0;
  const ratioPercent = Math.round(ratio * 100);
  let ratioTone: RatioTone = 'error';
  if (ratio >= 0.7) {
    ratioTone = 'primary';
  } else if (ratio >= 0.4) {
    ratioTone = 'warning';
  }

  const mealLabel = mealLabels[summary.mealType] ?? summary.mealType;

  return {
    ...summary,
    displayDate: getDisplayDate(summary.date),
    weekdayLabel: getWeekdayLabel(summary.date),
    mealLabel,
    ratioLabel: `${ratioPercent}% 응답`,
    ratioTone
  };
}

export function formatSlotKey(slotKey: string) {
  const [date, mealType] = slotKey.split('#');
  const mealLabel = mealLabels[mealType] ?? mealType;
  return `${getDisplayDate(date)} ${mealLabel}`;
}
