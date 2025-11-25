// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import { useState } from 'react';
import { participationStrings } from '../strings.js';

type Props = {
  title: string;
  isLoading?: boolean;
  onRetry: () => void;
  onHelp: () => void;
};

export function ParticipationAppBar({ title, isLoading, onRetry, onHelp }: Props) {
  const [showOverflow, setShowOverflow] = useState(false);
  return (
    <header className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-[var(--participation-border)] px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
      <div>
        <p className="text-xs text-slate-500">식사 약속</p>
        <h1 className="text-xl font-semibold text-slate-900" aria-live="polite">
          {isLoading ? participationStrings.loading : title}
        </h1>
      </div>
      <div className="hidden sm:flex items-center gap-2">
        <button
          type="button"
          className="rounded-xl border border-[var(--participation-border)] px-3 py-2 text-sm font-semibold text-[var(--participation-secondary)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(21,101,192,0.45)]"
          onClick={onHelp}
          aria-label={participationStrings.helpCta}
        >
          {participationStrings.helpCta}
        </button>
        <button
          type="button"
          className="rounded-xl bg-[var(--participation-secondary)] px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(21,101,192,0.22)] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[rgba(21,101,192,0.45)]"
          onClick={onRetry}
          aria-label={participationStrings.refresh}
        >
          {participationStrings.refresh}
        </button>
      </div>
      <div className="sm:hidden relative">
        <button
          type="button"
          aria-label={participationStrings.mobileOverflowLabel}
          className="rounded-lg border border-[var(--participation-border)] px-3 py-2 text-sm"
          onClick={() => setShowOverflow((prev) => !prev)}
        >
          ☰
        </button>
        {showOverflow && (
          <div className="absolute right-0 mt-2 w-40 rounded-xl border border-[var(--participation-border)] bg-white shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--participation-neutral-50)]"
              onClick={() => {
                setShowOverflow(false);
                onHelp();
              }}
            >
              {participationStrings.helpCta}
            </button>
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--participation-neutral-50)]"
              onClick={() => {
                setShowOverflow(false);
                onRetry();
              }}
            >
              {participationStrings.refresh}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
