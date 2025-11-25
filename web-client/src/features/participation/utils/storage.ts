// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

const NICKNAME_KEY = 'participation.nickname';
const PIN_KEY = 'participation.pin';
const LAST_APPOINTMENT_KEY = 'participation.lastAppointmentId';

type Credentials = {
  nickname: string;
  pin?: string;
  appointmentId?: string;
};

export function loadCredentials(): Credentials | null {
  if (typeof window === 'undefined') return null;
  const nickname = localStorage.getItem(NICKNAME_KEY);
  if (!nickname) return null;
  const pin = localStorage.getItem(PIN_KEY) ?? undefined;
  const appointmentId = localStorage.getItem(LAST_APPOINTMENT_KEY) ?? undefined;
  return { nickname, pin, appointmentId };
}

export function saveCredentials({ nickname, pin, appointmentId }: Credentials): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NICKNAME_KEY, nickname);
  if (pin) {
    localStorage.setItem(PIN_KEY, pin);
  } else {
    localStorage.removeItem(PIN_KEY);
  }
  if (appointmentId) {
    localStorage.setItem(LAST_APPOINTMENT_KEY, appointmentId);
  }
}

export function clearCredentials(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(NICKNAME_KEY);
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(LAST_APPOINTMENT_KEY);
}
