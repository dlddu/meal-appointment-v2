import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const reuse = process.env.CI ? false : true;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:5173',
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
  webServer: [
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
  ]
});
