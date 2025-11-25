// Tests for spec: agent/specs/meal-appointment-participation-frontend-test-spec.md

import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildSlotsForWeek, compareSlotKeys, formatDateKey, getWeekStart } from '../utils/slotKey.js';

const baseDate = new Date('2024-05-08T12:00:00Z');

afterEach(() => {
  vi.useRealTimers();
});

describe('slotKey utilities', () => {
  it('formats dates as UTC YYYY-MM-DD', () => {
    const date = new Date('2024-05-06T23:00:00+09:00');
    expect(formatDateKey(date)).toBe('2024-05-06');
  });

  it('computes the Monday start of the given week offset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);
    const start = getWeekStart(0);
    expect(start.toISOString().slice(0, 10)).toBe('2024-05-06');

    const nextWeek = getWeekStart(1);
    expect(nextWeek.toISOString().slice(0, 10)).toBe('2024-05-13');
  });

  it('builds slot options for each matching rule within a week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);

    const slots = buildSlotsForWeek(
      [
        { dayPattern: 'EVERYDAY', mealTypes: ['BREAKFAST'] },
        { dayPattern: 'WEEKDAY', mealTypes: ['LUNCH'] },
        { dayPattern: '2024-05-11', mealTypes: ['DINNER'] }
      ],
      0
    );

    const first = slots.find((slot) => slot.slotKey === '2024-05-06#BREAKFAST');
    expect(first?.dayLabel).toBe('월요일');

    expect(slots).toContainEqual(
      expect.objectContaining({ slotKey: '2024-05-11#DINNER', dayLabel: '토요일', mealType: 'DINNER' })
    );
    expect(slots.some((slot) => slot.slotKey.endsWith('#LUNCH'))).toBe(true);
  });

  it('sorts slot keys by date then meal type', () => {
    const keys = ['2024-05-07#DINNER', '2024-05-06#BREAKFAST', '2024-05-06#DINNER'];
    const sorted = [...keys].sort(compareSlotKeys);
    expect(sorted).toEqual(['2024-05-06#BREAKFAST', '2024-05-06#DINNER', '2024-05-07#DINNER']);
  });
});
