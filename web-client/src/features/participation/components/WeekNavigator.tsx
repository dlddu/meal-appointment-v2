// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import { formatDateKey, getWeekStart } from '../utils/slotKey.js';

type Props = {
  weekOffset: number;
  onChange: (offset: number) => void;
};

export function WeekNavigator({ weekOffset, onChange }: Props) {
  const start = getWeekStart(weekOffset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const rangeText = `${formatDateKey(start)} ~ ${formatDateKey(end)}`;

  return (
    <div className="flex items-center justify-between rounded-2xl bg-white border border-[var(--participation-border)] px-4 py-3">
      <div>
        <p className="text-xs text-slate-500">이번 주</p>
        <p className="text-sm font-semibold" aria-live="polite">
          {rangeText}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="이전 주"
          onClick={() => onChange(weekOffset - 1)}
          className="rounded-lg border border-[var(--participation-border)] px-3 py-2 text-sm hover:bg-[var(--participation-neutral-50)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(21,101,192,0.45)]"
        >
          ← 이전
        </button>
        <button
          type="button"
          aria-label="다음 주"
          onClick={() => onChange(weekOffset + 1)}
          className="rounded-lg border border-[var(--participation-border)] px-3 py-2 text-sm hover:bg-[var(--participation-neutral-50)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(21,101,192,0.45)]"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}
