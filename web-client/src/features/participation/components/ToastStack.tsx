// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

type Toast = {
  id: string;
  message: string;
  variant?: 'success' | 'error' | 'warning';
};

type Props = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

export function ToastStack({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 space-y-2" aria-live="polite" role="status">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.2)] ${
            toast.variant === 'success'
              ? 'bg-[var(--participation-primary)]'
              : toast.variant === 'warning'
                ? 'bg-[var(--participation-warning)] text-slate-900'
                : 'bg-[var(--participation-error)]'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{toast.message}</span>
            <button
              type="button"
              aria-label="닫기"
              className="text-xs underline"
              onClick={() => onDismiss(toast.id)}
            >
              닫기
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
