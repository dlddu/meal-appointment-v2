// Tests for spec: agent/specs/meal-appointment-create-appointment-frontend-test-spec.md

import { describe, expect, it } from 'vitest';
import { formReducer, initialFormState } from '../formReducer.js';

const baseState = initialFormState;

describe('Appointment form reducer', () => {
  it('trims whitespace when updating title and summary', () => {
    const titleState = formReducer(baseState, {
      type: 'UPDATE_FIELD',
      field: 'title',
      value: '  점심  '
    });
    expect(titleState.title).toBe('점심');

    const summaryState = formReducer(baseState, {
      type: 'UPDATE_FIELD',
      field: 'summary',
      value: '  안내 문구  '
    });
    expect(summaryState.summary).toBe('안내 문구');
  });

  it('only flips the requested touched flag', () => {
    const titleTouched = formReducer(baseState, {
      type: 'SET_TOUCHED',
      field: 'title',
      value: true
    });

    expect(titleTouched.touched).toEqual({
      title: true,
      summary: false,
      template: false
    });

    const templateTouched = formReducer(titleTouched, {
      type: 'SET_TOUCHED',
      field: 'template',
      value: true
    });

    expect(templateTouched.touched).toEqual({
      title: true,
      summary: false,
      template: true
    });
  });
});
