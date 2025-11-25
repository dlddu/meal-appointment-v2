import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  // Use process.env directly to get environment variables from the shell
  const apiBaseUrl = process.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
  return {
    plugins: [react()],
    define: {
      __API_BASE_URL__: JSON.stringify(apiBaseUrl)
    }
  };
});
