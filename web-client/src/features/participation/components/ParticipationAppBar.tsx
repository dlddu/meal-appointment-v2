// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import { Link } from 'react-router-dom';
import { participationStrings } from '../strings.js';

type Props = {
  title: string;
  isLoading?: boolean;
  backTo?: string;
};

export function ParticipationAppBar({ title, isLoading, backTo }: Props) {
  return (
    <header className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-[var(--participation-border)] px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
      <div>
        <p className="text-xs text-slate-500">식사 약속</p>
        <h1 className="text-xl font-semibold text-slate-900" aria-live="polite">
          {isLoading ? participationStrings.loading : title}
        </h1>
      </div>
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 rounded-xl border border-[var(--participation-border)] bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label={participationStrings.backToStatus}
        >
          <span aria-hidden="true">&larr;</span>
          {participationStrings.backToStatus}
        </Link>
      )}
    </header>
  );
}
