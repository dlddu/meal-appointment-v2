// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md
// Implemented for spec: agent/specs/meal-appointment-architecture-spec.md

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { CreateAppointmentPage } from './CreateAppointmentPage.js';
import { ViewAppointmentPage } from './ViewAppointmentPage.js';

const ParticipateAppointmentPage = lazy(() => import('./ParticipateAppointmentPage.js'));

const defaultApiBaseUrl =
  typeof window !== 'undefined' && import.meta.env.PROD
    ? `${window.location.origin}/api`
    : 'http://localhost:4000/api';

export const API_BASE_URL: string = (globalThis as any).__API_BASE_URL__ ?? defaultApiBaseUrl;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/create" replace />} />
        <Route path="/create" element={<CreateAppointmentPage apiBaseUrl={API_BASE_URL} />} />
        <Route
          path="/appointments/:appointmentId"
          element={<ViewAppointmentPage apiBaseUrl={API_BASE_URL} />}
        />
        <Route
          path="/appointments/:appointmentId/participate"
          element={
            <Suspense fallback={<div className="p-6 text-center text-sm">Loading...</div>}>
              <ParticipateAppointmentPage apiBaseUrl={API_BASE_URL} />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
