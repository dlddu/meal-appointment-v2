// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import { participationStrings } from '../strings.js';

type Props = {
  title: string;
  isLoading?: boolean;
};

export function ParticipationAppBar({ title, isLoading }: Props) {
  return (
    <header className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-[var(--participation-border)] px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
      <div>
        <p className="text-xs text-slate-500">식사 약속</p>
        <h1 className="text-xl font-semibold text-slate-900" aria-live="polite">
          {isLoading ? participationStrings.loading : title}
        </h1>
      </div>
    </header>
  );
}
