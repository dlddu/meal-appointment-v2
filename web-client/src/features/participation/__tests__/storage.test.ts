// Tests for spec: agent/specs/meal-appointment-participation-frontend-test-spec.md

import { describe, expect, it, beforeEach } from 'vitest';
import { clearCredentials, loadCredentials, saveCredentials } from '../utils/storage.js';

describe('storage utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and loads nickname, pin, and appointment id', () => {
    saveCredentials({ nickname: '테스터', pin: '1234', appointmentId: 'apt-1' });
    const loaded = loadCredentials();

    expect(loaded).toEqual({ nickname: '테스터', pin: '1234', appointmentId: 'apt-1' });
  });

  it('removes pin when an empty value is provided', () => {
    saveCredentials({ nickname: '테스터', pin: '9999', appointmentId: 'apt-2' });
    saveCredentials({ nickname: '테스터', pin: undefined, appointmentId: 'apt-2' });

    const loaded = loadCredentials();
    expect(loaded?.pin).toBeUndefined();
  });

  it('clears all values', () => {
    saveCredentials({ nickname: '테스터', pin: '8888', appointmentId: 'apt-3' });
    clearCredentials();

    expect(loadCredentials()).toBeNull();
    expect(localStorage.getItem('participation.nickname')).toBeNull();
  });
});
