import type { FormattedSlotSummary } from './formatSlot.js';
import type { SlotGroup } from './groupSlotSummaries.js';

export const MEAL_ROWS = ['LUNCH', 'DINNER'] as const;
export type MealRow = (typeof MEAL_ROWS)[number];

const MEAL_ROW_LABELS: Record<MealRow, string> = {
  LUNCH: '점심',
  DINNER: '저녁'
};

export function getMealRowLabel(meal: MealRow): string {
  return MEAL_ROW_LABELS[meal];
}

export type WeekDay = {
  date: string;
  displayDate: string;
  weekdayLabel: string;
  slots: Record<string, FormattedSlotSummary | null>;
};

export type CalendarWeek = {
  weekStart: string;
  weekEnd: string;
  days: WeekDay[];
};

function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function buildWeeklyCalendar(slotGroups: SlotGroup[]): CalendarWeek[] {
  if (slotGroups.length === 0) return [];

  // Collect all dates and build a lookup map
  const slotMap = new Map<string, Map<string, FormattedSlotSummary>>();
  const dateInfoMap = new Map<string, { displayDate: string; weekdayLabel: string }>();

  for (const group of slotGroups) {
    dateInfoMap.set(group.date, {
      displayDate: group.displayDate,
      weekdayLabel: group.weekdayLabel
    });
    const mealMap = new Map<string, FormattedSlotSummary>();
    for (const s of group.summaries) {
      mealMap.set(s.mealType, s);
    }
    slotMap.set(group.date, mealMap);
  }

  // Find all unique week starts
  const allDates = slotGroups.map((g) => g.date).sort();
  const weekStartSet = new Set<string>();
  for (const date of allDates) {
    weekStartSet.add(formatDateKey(getMonday(date)));
  }
  const weekStarts = Array.from(weekStartSet).sort();

  const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

  return weekStarts.map((ws) => {
    const monday = new Date(ws + 'T00:00:00');
    const days: WeekDay[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateKey = formatDateKey(d);
      const info = dateInfoMap.get(dateKey);

      const displayDate =
        info?.displayDate ??
        new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(d);
      const weekdayLabel = info?.weekdayLabel ?? WEEKDAY_LABELS[i];

      const mealMap = slotMap.get(dateKey);
      const slots: Record<string, FormattedSlotSummary | null> = {};
      for (const meal of MEAL_ROWS) {
        slots[meal] = mealMap?.get(meal) ?? null;
      }

      days.push({ date: dateKey, displayDate, weekdayLabel, slots });
    }

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      weekStart: ws,
      weekEnd: formatDateKey(sunday),
      days
    };
  });
}
