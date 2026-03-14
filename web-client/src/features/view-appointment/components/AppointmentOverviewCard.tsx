// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

import type { AppointmentViewResponse } from '../api/getAppointment.js';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

type AppointmentOverviewCardProps = {
  appointment: AppointmentViewResponse['appointment'];
  template: AppointmentViewResponse['template'];
  participants: AppointmentViewResponse['participants'];
};

export function AppointmentOverviewCard({ appointment, template, participants }: AppointmentOverviewCardProps) {
  const lastResponseAt = participants
    .filter((p) => p.submittedAt)
    .map((p) => new Date(p.submittedAt).getTime())
    .reduce<number | null>((max, t) => (max === null || t > max ? t : max), null);
  return (
    <section className="bg-white rounded-2xl border border-[var(--color-view-border)] shadow-[0_12px_24px_rgba(15,23,42,0.08)] p-7 sm:p-6">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">약속 개요</h2>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="rounded-full bg-[var(--color-view-neutral)] px-3 py-1 text-xs font-semibold text-slate-700">템플릿 기반 슬롯만 표시</span>
          <span className="text-xs text-slate-500">템플릿: {template.name}</span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">{appointment.title}</h1>
        <p className="text-base text-slate-700">{appointment.summary || '약속 설명이 없습니다.'}</p>
      </div>
      <dl className="mt-6 grid grid-cols-1 gap-4 text-sm text-slate-600 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="font-semibold text-slate-800">생성 시각</dt>
          <dd>{formatDateTime(appointment.createdAt)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-semibold text-slate-800">마지막 업데이트</dt>
          <dd>{lastResponseAt ? formatDateTime(new Date(lastResponseAt).toISOString()) : '-'}</dd>
        </div>
      </dl>
    </section>
  );
}
