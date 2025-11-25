// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

export type TemplateRule = {
  dayPattern: string;
  mealTypes: string[];
};

export type SlotOption = {
  slotKey: string;
  dateLabel: string;
  dayLabel: string;
  mealType: string;
};

export function formatDateKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return utc.toISOString().slice(0, 10);
}

export function getWeekStart(offset: number): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() + mondayOffset + offset * 7);
  return start;
}

function dayMatchesRule(date: Date, rule: TemplateRule): boolean {
  const day = date.getUTCDay();
  const dateKey = formatDateKey(date);
  if (rule.dayPattern === 'EVERYDAY') return true;
  if (rule.dayPattern === 'WEEKDAY') return day >= 1 && day <= 5;
  if (rule.dayPattern === 'WEEKEND') return day === 0 || day === 6;
  return rule.dayPattern === dateKey;
}

export function buildSlotsForWeek(rules: TemplateRule[], weekOffset: number): SlotOption[] {
  const weekStart = getWeekStart(weekOffset);
  const slots: SlotOption[] = [];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  for (let i = 0; i < 7; i += 1) {
    const current = new Date(weekStart);
    current.setUTCDate(weekStart.getUTCDate() + i);
    const dateKey = formatDateKey(current);
    const mealTypes = new Set<string>();
    rules.forEach((rule) => {
      if (dayMatchesRule(current, rule)) {
        rule.mealTypes.forEach((meal) => mealTypes.add(meal));
      }
    });

    mealTypes.forEach((mealType) => {
      slots.push({
        slotKey: `${dateKey}#${mealType}`,
        dateLabel: dateKey,
        dayLabel: `${dayNames[current.getUTCDay()]}요일`,
        mealType
      });
    });
  }

  return slots;
}

export function compareSlotKeys(a: string, b: string): number {
  const [dateA, mealA] = a.split('#');
  const [dateB, mealB] = b.split('#');
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return mealA.localeCompare(mealB);
}
