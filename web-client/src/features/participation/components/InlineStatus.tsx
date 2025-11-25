// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

type Props = {
  variant: 'success' | 'error' | 'warning';
  message: string;
};

export function InlineStatus({ variant, message }: Props) {
  const color =
    variant === 'success'
      ? 'text-[var(--participation-success)]'
      : variant === 'warning'
        ? 'text-[var(--participation-warning)]'
        : 'text-[var(--participation-error)]';
  return (
    <p className={`text-sm ${color}`} role={variant === 'error' ? 'alert' : 'status'} aria-live="polite">
      {message}
    </p>
  );
}
