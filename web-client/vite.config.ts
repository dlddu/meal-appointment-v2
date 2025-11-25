import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Implemented for spec: agent/specs/meal-appointment-architecture-spec.md
  const defaultApiBaseUrl =
    env.VITE_API_BASE_URL ?? (mode === 'production' ? '/api' : 'http://localhost:4000/api');
  return {
    plugins: [react()],
    define: {
      __API_BASE_URL__: JSON.stringify(defaultApiBaseUrl)
    }
  };
});
