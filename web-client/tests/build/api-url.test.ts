/**
 * Test to verify that the API URL is correctly configured in the build output
 * This test checks the bundled JavaScript files to ensure the API URL is not hardcoded to localhost
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Build Output API URL Configuration', () => {
  const distDir = join(__dirname, '../../dist');
  const assetsDir = join(distDir, 'assets');
  
  let bundleContent: string;
  let foundApiUrl: string | null = null;

  beforeAll(() => {
    // Check if dist directory exists
    if (!existsSync(distDir)) {
      throw new Error('dist directory does not exist. Please run build first.');
    }

    // Find JavaScript files in dist/assets
    const files = readdirSync(assetsDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    
    if (jsFiles.length === 0) {
      throw new Error('No JavaScript files found in dist/assets');
    }

    // Read all JS files and concatenate their content
    bundleContent = jsFiles
      .map(file => readFileSync(join(assetsDir, file), 'utf-8'))
      .join('\n');

    // Extract the API URL from the bundle
    // Pattern 1: Old pattern with globalThis - __API_BASE_URL__??"http://..."
    // Pattern 2: Direct assignment after Vite replacement - ki="/api"
    const patterns = [
      /__API_BASE_URL__\?\?"([^"]+)"/,
      /globalThis\.__API_BASE_URL__\?\?"([^"]+)"/,
      /API_BASE_URL__:"([^"]+)"/,
      /ki="([^"]+)"/,  // After Vite replaces __API_BASE_URL__, it assigns to variable
    ];

    for (const pattern of patterns) {
      const match = bundleContent.match(pattern);
      if (match) {
        foundApiUrl = match[1];
        break;
      }
    }
  });

  it('should have built the application', () => {
    expect(existsSync(distDir)).toBe(true);
    expect(existsSync(assetsDir)).toBe(true);
  });

  it('should contain API URL configuration in bundle', () => {
    expect(foundApiUrl).not.toBeNull();
  });

  it('should not use localhost as the API URL in production builds', () => {
    expect(foundApiUrl).not.toBeNull();
    // The API URL should not contain localhost or 127.0.0.1 in production builds
    // After the fix, it should use a relative path like /api
    const isLocalhost = foundApiUrl?.includes('localhost') || foundApiUrl?.includes('127.0.0.1');
    
    expect(isLocalhost).toBe(false); // Fixed: should NOT use localhost
    expect(foundApiUrl).toBe('/api'); // Should use relative path
  });

  it('should expose API URL for verification', () => {
    console.log('Found API URL in bundle:', foundApiUrl);
  });
});
