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

export type CalendarCell = {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  slots: Record<string, FormattedSlotSummary | null>;
};

export type CalendarMonth = {
  year: number;
  month: number;
  label: string;
  weeks: CalendarCell[][];
};

function formatDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function buildMonthlyCalendar(slotGroups: SlotGroup[]): CalendarMonth[] {
  if (slotGroups.length === 0) return [];

  // Build lookup: date -> meal -> FormattedSlotSummary
  const slotMap = new Map<string, Map<string, FormattedSlotSummary>>();
  for (const group of slotGroups) {
    const mealMap = new Map<string, FormattedSlotSummary>();
    for (const s of group.summaries) {
      mealMap.set(s.mealType, s);
    }
    slotMap.set(group.date, mealMap);
  }

  // Find unique months from the data
  const monthSet = new Set<string>();
  for (const group of slotGroups) {
    const d = new Date(group.date + 'T00:00:00Z');
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    monthSet.add(key);
  }
  const months = Array.from(monthSet).sort();

  return months.map((monthKey) => {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr); // 1-based

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));

    // Start grid from the Sunday before (or on) the 1st
    const startDow = monthStart.getUTCDay(); // 0=Sun
    const gridStart = new Date(monthStart);
    gridStart.setUTCDate(gridStart.getUTCDate() - startDow);

    const totalDays = Math.ceil(
      (monthEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24) + 1
    );
    const totalWeeks = Math.ceil(totalDays / 7);

    const weeks: CalendarCell[][] = [];
    for (let w = 0; w < totalWeeks; w++) {
      const week: CalendarCell[] = [];
      for (let d = 0; d < 7; d++) {
        const current = new Date(gridStart);
        current.setUTCDate(gridStart.getUTCDate() + w * 7 + d);
        const dateStr = formatDateKey(current);

        const mealMap = slotMap.get(dateStr);
        const slots: Record<string, FormattedSlotSummary | null> = {};
        for (const meal of MEAL_ROWS) {
          slots[meal] = mealMap?.get(meal) ?? null;
        }

        week.push({
          date: dateStr,
          dayOfMonth: current.getUTCDate(),
          isCurrentMonth:
            current.getUTCMonth() === month - 1 && current.getUTCFullYear() === year,
          slots
        });
      }
      weeks.push(week);
    }

    return {
      year,
      month,
      label: `${year}년 ${month}월`,
      weeks
    };
  });
}
