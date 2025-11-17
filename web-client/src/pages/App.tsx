// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CreateAppointmentPage } from './CreateAppointmentPage.js';

export const API_BASE_URL: string = (globalThis as any).__API_BASE_URL__ ?? 'http://localhost:4000/api';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/create" replace />} />
        <Route path="/create" element={<CreateAppointmentPage apiBaseUrl={API_BASE_URL} />} />
      </Routes>
    </BrowserRouter>
  );
}
