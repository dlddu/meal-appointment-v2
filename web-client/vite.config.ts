import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Implemented for spec: agent/specs/meal-appointment-architecture-spec.md
  // Check process.env first for Docker builds, then fallback to .env files, then mode-based defaults
  const defaultApiBaseUrl =
    process.env.VITE_API_BASE_URL ?? 
    env.VITE_API_BASE_URL ?? 
    (mode === 'production' ? '/api' : 'http://localhost:4000/api');
  return {
    plugins: [react()],
    define: {
      __API_BASE_URL__: JSON.stringify(defaultApiBaseUrl)
    }
  };
});
