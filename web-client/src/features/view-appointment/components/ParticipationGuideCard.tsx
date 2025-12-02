// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

import { viewAppointmentStrings } from '../strings.js';

type ParticipationGuideCardProps = {
  appointmentTitle?: string;
  onNavigateToRespond?: () => void;
  onShare?: () => Promise<void> | void;
};

export function ParticipationGuideCard({ appointmentTitle, onNavigateToRespond, onShare }: ParticipationGuideCardProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-view-border)] bg-white p-6 shadow-[0_12px_24px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex flex-1 items-start gap-3">
        <div className="mt-1 grid h-10 w-10 place-items-center rounded-full bg-[var(--color-view-primary)] text-sm font-semibold uppercase tracking-wide text-white">
          참여
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-view-secondary)]">
            {viewAppointmentStrings.participationLabel}
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            {appointmentTitle ? `${appointmentTitle} 참여하기` : viewAppointmentStrings.participationHeading}
          </h2>
          <p className="text-sm leading-6 text-slate-700">{viewAppointmentStrings.participationDescription}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              <span className="font-semibold text-slate-900">{viewAppointmentStrings.respond}</span> {viewAppointmentStrings.participationStepRespond}
            </li>
            <li>
              <span className="font-semibold text-slate-900">{viewAppointmentStrings.share}</span> {viewAppointmentStrings.participationStepShare}
            </li>
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button
          type="button"
          onClick={onNavigateToRespond}
          className="rounded-xl bg-[var(--color-view-primary)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-view-secondary)]"
        >
          {viewAppointmentStrings.respond}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="rounded-xl bg-[var(--color-view-secondary)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-view-secondary)]"
        >
          {viewAppointmentStrings.share}
        </button>
      </div>
    </section>
  );
}
