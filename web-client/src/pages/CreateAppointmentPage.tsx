// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppointmentForm } from '../features/create-appointment/components/AppointmentForm.js';
import { CreateSuccessPanel } from '../features/create-appointment/components/CreateSuccessPanel.js';
import { createAppointmentStrings, createAppointmentTemplateOptions } from '../features/create-appointment/strings.js';
import { useCreateAppointment } from '../features/create-appointment/hooks/useCreateAppointment.js';
import type { CreateAppointmentFormState } from '../features/create-appointment/types.js';

const TEMPLATE_OPTIONS = createAppointmentTemplateOptions;

type FormAction =
  | { type: 'UPDATE_FIELD'; field: 'title' | 'summary' | 'timeSlotTemplateId'; value: string }
  | { type: 'SET_TOUCHED'; field: 'title' | 'summary' | 'template'; value: boolean }
  | { type: 'TOUCH_ALL' };

const initialState: CreateAppointmentFormState = {
  title: '',
  summary: '',
  timeSlotTemplateId: '',
  touched: {
    title: false,
    summary: false,
    template: false
  }
};

function formReducer(state: CreateAppointmentFormState, action: FormAction): CreateAppointmentFormState {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return {
        ...state,
        [action.field]: action.value,
        touched: {
          ...state.touched,
          ...(action.field === 'timeSlotTemplateId' ? { template: true } : {})
        }
      };
    case 'SET_TOUCHED':
      return {
        ...state,
        touched: {
          ...state.touched,
          [action.field]: action.value
        }
      };
    case 'TOUCH_ALL':
      return {
        ...state,
        touched: {
          title: true,
          summary: true,
          template: true
        }
      };
    default:
      return state;
  }
}

type FieldErrors = Partial<Record<'title' | 'summary' | 'timeSlotTemplateId', string>>;

function validateForm(state: CreateAppointmentFormState): FieldErrors {
  const errors: FieldErrors = {};
  const trimmedTitle = state.title.trim();
  if (!trimmedTitle) {
    errors.title = createAppointmentStrings.form.titleRequired;
  } else if (trimmedTitle.length > 60) {
    errors.title = createAppointmentStrings.form.titleTooLong;
  }

  if (state.summary.trim().length > 200) {
    errors.summary = createAppointmentStrings.form.summaryTooLong;
  }

  if (!state.timeSlotTemplateId) {
    errors.timeSlotTemplateId = createAppointmentStrings.form.templateRequired;
  }

  return errors;
}

type CreateAppointmentPageProps = {
  apiBaseUrl: string;
};

export function CreateAppointmentPage({ apiBaseUrl }: CreateAppointmentPageProps) {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const { submit, retry, clearError, resetResult, fieldErrors, bannerError, result, isPending } =
    useCreateAppointment(apiBaseUrl);
  const [templateToast, setTemplateToast] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const templateGroupRef = useRef<HTMLDivElement>(null);
  const lastServerErrorRef = useRef<string | null>(null);

  const clientErrors = useMemo(() => validateForm(state), [state]);

  const mergedErrors = useMemo(() => {
    const combined: FieldErrors = { ...clientErrors };
    Object.entries(fieldErrors).forEach(([key, value]) => {
      if (!combined[key as keyof FieldErrors] && value) {
        combined[key as keyof FieldErrors] = value;
      }
    });
    return combined;
  }, [clientErrors, fieldErrors]);

  useEffect(() => {
    const signature = Object.entries(fieldErrors)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
    if (signature && signature !== lastServerErrorRef.current) {
      lastServerErrorRef.current = signature;
      dispatch({ type: 'TOUCH_ALL' });
    }
    if (!signature) {
      lastServerErrorRef.current = null;
    }
  }, [fieldErrors]);

  const showBanner = useMemo(() => {
    if (bannerMessage) {
      return { type: 'local', message: bannerMessage } as const;
    }
    if (!bannerError) {
      return null;
    }
    if (bannerError.type === 'server') {
      return { type: 'server', message: createAppointmentStrings.banners.serverError } as const;
    }
    return { type: 'network', message: createAppointmentStrings.banners.networkError } as const;
  }, [bannerError, bannerMessage]);

  const isNetworkBanner = showBanner?.type === 'network';

  const handleFieldChange = (field: 'title' | 'summary' | 'timeSlotTemplateId', value: string) => {
    if (bannerMessage) {
      setBannerMessage(null);
    }
    if (bannerError) {
      clearError();
    }
    if (result) {
      resetResult();
    }
    dispatch({ type: 'UPDATE_FIELD', field, value });
  };

  const handleBlur = (field: 'title' | 'summary' | 'timeSlotTemplateId') => {
    dispatch({ type: 'SET_TOUCHED', field: field === 'timeSlotTemplateId' ? 'template' : field, value: true });
  };

  useEffect(() => {
    if (!templateToast) {
      return;
    }
    const timer = window.setTimeout(() => setTemplateToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [templateToast]);

  const handleTemplateUnavailable = () => {
    setTemplateToast(createAppointmentStrings.form.templateUnavailable);
  };

  const focusFirstError = (errors: FieldErrors) => {
    if (errors.title) {
      titleRef.current?.focus();
      return;
    }
    if (errors.summary) {
      summaryRef.current?.focus();
      return;
    }
    if (errors.timeSlotTemplateId) {
      templateGroupRef.current?.focus();
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateForm(state);
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'TOUCH_ALL' });
      focusFirstError(errors);
      return;
    }
    submit({
      title: state.title.trim(),
      summary: state.summary.trim(),
      timeSlotTemplateId: state.timeSlotTemplateId
    });
  };

  const handleCopyError = (message: string) => {
    setBannerMessage(message);
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_rgba(42,111,151,0.12)_0%,_rgba(248,250,252,0.9)_40%,_#f8fafc_100%)] py-10 px-4 text-slate-900">
      <div className="max-w-[1080px] mx-auto flex flex-col items-center gap-8">
        <section className="text-center" aria-labelledby="create-hero-heading">
          <h1 id="create-hero-heading" className="text-3xl md:text-4xl font-bold text-slate-900">
            {createAppointmentStrings.hero.title}
          </h1>
          <p className="text-slate-600 mt-3 max-w-2xl">
            {createAppointmentStrings.hero.subtitle}
          </p>
        </section>

        {showBanner && (
          <div
            role="alert"
            className="w-full max-w-[960px] bg-error text-white px-6 py-3 rounded-[12px] flex items-center justify-between"
          >
            <span>{showBanner.message}</span>
            {isNetworkBanner && (
              <button
                type="button"
                className="bg-white/20 px-4 py-1 rounded-[8px] font-semibold"
                onClick={retry}
              >
                {createAppointmentStrings.banners.retry}
              </button>
            )}
          </div>
        )}

        <section
          aria-labelledby="create-form-section"
          className="w-full max-w-[960px] bg-surface rounded-[20px] shadow-[0_12px_24px_rgba(15,23,42,0.12)] px-6 py-7 md:px-12 md:py-10"
        >
          <div className="mb-8">
            <h2 id="create-form-section" className="text-2xl font-semibold">
              {createAppointmentStrings.form.sectionTitle}
            </h2>
            <p className="text-slate-500 mt-2">{createAppointmentStrings.form.sectionHelper}</p>
          </div>
          <AppointmentForm
            state={state}
            errors={mergedErrors}
            onFieldChange={handleFieldChange}
            onBlur={handleBlur}
            onSubmit={handleSubmit}
            templateOptions={TEMPLATE_OPTIONS}
            isSubmitting={isPending}
            onTemplateUnavailable={handleTemplateUnavailable}
            titleRef={titleRef}
            summaryRef={summaryRef}
            templateGroupRef={templateGroupRef}
          />
          {templateToast && (
            <div className="mt-4 text-sm text-secondary" role="status" aria-live="polite">
              {templateToast}
            </div>
          )}
        </section>

        <section className="w-full max-w-[960px]" aria-labelledby="create-success-section">
          <h2 id="create-success-section" className="sr-only">
            {createAppointmentStrings.success.sectionTitle}
          </h2>
          <CreateSuccessPanel result={result} onCopyError={handleCopyError} />
        </section>

        <footer className="text-center text-slate-500 text-sm">
          <p>{createAppointmentStrings.footer.note}</p>
        </footer>
      </div>
    </main>
  );
}
