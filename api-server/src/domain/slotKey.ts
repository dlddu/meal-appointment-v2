// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

const mealOrder: Record<string, number> = {
  BREAKFAST: 0,
  LUNCH: 1,
  DINNER: 2
};

export function splitSlotKey(slotKey: string): [string, string] {
  const [date, mealType] = slotKey.split('#');
  return [date ?? '', mealType ?? ''];
}

export function compareSlotKeys(a: string, b: string): number {
  const [dateA, mealA] = splitSlotKey(a);
  const [dateB, mealB] = splitSlotKey(b);

  if (dateA !== dateB) {
    return dateA.localeCompare(dateB);
  }

  const rankA = mealOrder[mealA] ?? Number.MAX_SAFE_INTEGER;
  const rankB = mealOrder[mealB] ?? Number.MAX_SAFE_INTEGER;
  if (rankA !== rankB) {
    return rankA - rankB;
  }

  return mealA.localeCompare(mealB);
}
