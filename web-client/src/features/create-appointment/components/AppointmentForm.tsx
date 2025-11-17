// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

import type React from 'react';
import { useMemo } from 'react';
import type { CreateAppointmentFormState, TemplateOption } from '../types.js';
import { createAppointmentStrings } from '../strings.js';
import { TemplateOptionCard } from './TemplateOptionCard.js';

type AppointmentFormProps = {
  state: CreateAppointmentFormState;
  errors: Partial<Record<'title' | 'summary' | 'timeSlotTemplateId', string>>;
  onFieldChange: (field: 'title' | 'summary' | 'timeSlotTemplateId', value: string) => void;
  onBlur: (field: 'title' | 'summary' | 'timeSlotTemplateId') => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  templateOptions: TemplateOption[];
  isSubmitting: boolean;
  onTemplateUnavailable: () => void;
  titleRef: React.RefObject<HTMLInputElement>;
  summaryRef: React.RefObject<HTMLTextAreaElement>;
  templateGroupRef: React.RefObject<HTMLDivElement>;
};

export function AppointmentForm({
  state,
  errors,
  onFieldChange,
  onBlur,
  onSubmit,
  templateOptions,
  isSubmitting,
  onTemplateUnavailable,
  titleRef,
  summaryRef,
  templateGroupRef
}: AppointmentFormProps) {
  const remaining = 200 - state.summary.length;
  const summaryExceeded = remaining < 0;

  const summaryCounterText = useMemo(() => {
    if (summaryExceeded) {
      return createAppointmentStrings.form.summaryExceeded(Math.abs(remaining));
    }
    return createAppointmentStrings.form.summaryRemaining(remaining);
  }, [remaining, summaryExceeded]);

  return (
    <form
      onSubmit={onSubmit}
      aria-label={createAppointmentStrings.accessibility.formRegion}
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-3">
        <label htmlFor="appointment-title" className="font-semibold text-slate-900">
          {createAppointmentStrings.form.titleLabel}
        </label>
        <input
          id="appointment-title"
          name="title"
          type="text"
          value={state.title}
          onChange={(event) => onFieldChange('title', event.target.value)}
          onBlur={() => onBlur('title')}
          className="w-full h-12 rounded-[12px] border border-border px-4 py-3 text-base focus:outline-none focus:border-primary focus:ring-4 focus:ring-[rgba(42,111,151,0.15)]"
          placeholder={createAppointmentStrings.form.titlePlaceholder}
          aria-invalid={Boolean(errors.title)}
          ref={titleRef}
        />
        {errors.title && state.touched.title && (
          <p className="text-sm text-error" aria-live="polite">
            {errors.title}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label htmlFor="appointment-summary" className="font-semibold text-slate-900">
            {createAppointmentStrings.form.summaryLabel}
          </label>
          <span className="text-sm text-slate-500">{createAppointmentStrings.form.summaryHelper}</span>
        </div>
        <textarea
          id="appointment-summary"
          name="summary"
          value={state.summary}
          onChange={(event) => onFieldChange('summary', event.target.value)}
          onBlur={() => onBlur('summary')}
          className="w-full min-h-[128px] rounded-[12px] border border-border px-4 py-3 text-base focus:outline-none focus:border-primary focus:ring-4 focus:ring-[rgba(42,111,151,0.15)] resize-none"
          placeholder={createAppointmentStrings.form.summaryPlaceholder}
          aria-invalid={Boolean(errors.summary)}
          ref={summaryRef}
        />
        <div className="flex items-center justify-between">
          {errors.summary && state.touched.summary && (
            <p className="text-sm text-error" aria-live="polite">
              {errors.summary}
            </p>
          )}
          <span className={`text-sm ${summaryExceeded ? 'text-error' : 'text-slate-500'}`}>{summaryCounterText}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-900">{createAppointmentStrings.form.templateLabel}</span>
          <span className="text-sm text-slate-500">{createAppointmentStrings.form.templateHint}</span>
        </div>
        <div
          role="radiogroup"
          aria-label={createAppointmentStrings.accessibility.templateGroupLabel}
          className="grid gap-4 md:grid-cols-2"
          tabIndex={-1}
          ref={templateGroupRef}
        >
          {templateOptions.map((option) => (
            <TemplateOptionCard
              key={option.id}
              option={option}
              selected={state.timeSlotTemplateId === option.id}
              onSelect={() => onFieldChange('timeSlotTemplateId', option.id)}
              onUnavailable={onTemplateUnavailable}
            />
          ))}
        </div>
        {errors.timeSlotTemplateId && state.touched.template && (
          <p className="text-sm text-error" aria-live="polite">
            {errors.timeSlotTemplateId}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="h-[52px] bg-primary text-white rounded-[12px] font-semibold shadow-[0_8px_16px_rgba(42,111,151,0.22)] transition-transform focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-3">
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            {createAppointmentStrings.form.submitting}
          </span>
        ) : (
          createAppointmentStrings.form.submit
        )}
      </button>
    </form>
  );
}
