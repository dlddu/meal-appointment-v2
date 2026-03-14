// Tests for spec: agent/specs/meal-appointment-participation-frontend-test-spec.md

import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildSlotsForWeek, buildSlotsForMonth, compareSlotKeys, formatDateKey, getWeekStart, getMonthStart, getMonthEnd } from '../utils/slotKey.js';

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

  it('computes the first day of the month with offset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);
    const start = getMonthStart(0);
    expect(start.toISOString().slice(0, 10)).toBe('2024-05-01');

    const nextMonth = getMonthStart(1);
    expect(nextMonth.toISOString().slice(0, 10)).toBe('2024-06-01');
  });

  it('computes the last day of the month with offset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);
    const end = getMonthEnd(0);
    expect(end.toISOString().slice(0, 10)).toBe('2024-05-31');

    const febEnd = getMonthEnd(-3); // February 2024 (leap year)
    expect(febEnd.toISOString().slice(0, 10)).toBe('2024-02-29');
  });

  it('builds slot options for the entire month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);

    const slots = buildSlotsForMonth(
      [{ dayPattern: 'WEEKDAY', mealTypes: ['LUNCH'] }],
      0
    );

    // May 2024 has 23 weekdays
    expect(slots.length).toBe(23);
    expect(slots[0].slotKey).toBe('2024-05-01#LUNCH');
    expect(slots[0].dayLabel).toBe('수요일');

    // Last weekday in May 2024 is May 31 (Friday)
    const lastSlot = slots[slots.length - 1];
    expect(lastSlot.slotKey).toBe('2024-05-31#LUNCH');
    expect(lastSlot.dayLabel).toBe('금요일');
  });
});
