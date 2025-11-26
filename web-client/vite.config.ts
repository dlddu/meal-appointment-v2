import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables from .env files based on mode
  // This ensures VITE_API_BASE_URL from .env.e2e is loaded in e2e mode
  const env = loadEnv(mode, process.cwd(), '');
  
  // Priority: shell env > .env file > default
  const apiBaseUrl = process.env.VITE_API_BASE_URL ?? env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
  
  return {
    plugins: [react()],
    define: {
      __API_BASE_URL__: JSON.stringify(apiBaseUrl)
    }
  };
});
