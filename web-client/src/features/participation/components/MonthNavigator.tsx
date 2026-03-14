import { getMonthStart } from '../utils/slotKey.js';

type Props = {
  monthOffset: number;
  onChange: (offset: number) => void;
};

export function MonthNavigator({ monthOffset, onChange }: Props) {
  const monthStart = getMonthStart(monthOffset);
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth() + 1;
  const label = `${year}년 ${month}월`;

  return (
    <div className="flex items-center justify-between rounded-2xl bg-white border border-[var(--participation-border)] px-4 py-3">
      <button
        type="button"
        aria-label="이전 달"
        onClick={() => onChange(monthOffset - 1)}
        className="rounded-lg border border-[var(--participation-border)] px-3 py-2 text-sm hover:bg-[var(--participation-neutral-50)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(21,101,192,0.45)]"
      >
        ← 이전
      </button>
      <p className="text-sm font-semibold" aria-live="polite">
        {label}
      </p>
      <button
        type="button"
        aria-label="다음 달"
        onClick={() => onChange(monthOffset + 1)}
        className="rounded-lg border border-[var(--participation-border)] px-3 py-2 text-sm hover:bg-[var(--participation-neutral-50)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(21,101,192,0.45)]"
      >
        다음 →
      </button>
    </div>
  );
}
