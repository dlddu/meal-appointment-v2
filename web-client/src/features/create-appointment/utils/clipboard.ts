// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

export function getClipboard(): Clipboard | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  return navigator.clipboard;
}
