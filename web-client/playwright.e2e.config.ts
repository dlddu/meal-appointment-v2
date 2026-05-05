import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const useKind = process.env.E2E_USE_KIND === '1';
const reuse = useKind ? true : !process.env.CI;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

const localWebServer = [
  {
    command: 'npm run start:e2e',
    port: 4002,
    reuseExistingServer: reuse,
    cwd: path.resolve(__dirname, '../api-server'),
    env: {
      NODE_ENV: 'e2e'
    }
  },
  {
    command: 'npm run dev -- --mode e2e --host 127.0.0.1 --port 5173',
    port: 5173,
    reuseExistingServer: reuse,
    cwd: __dirname
  }
];

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL,
    trace: 'off'
  },
  projects: [
    {
      name: 'api-mode',
      use: {
        browserName: 'chromium',
        headless: true
      }
    }
  ],
  webServer: useKind ? undefined : localWebServer
});
