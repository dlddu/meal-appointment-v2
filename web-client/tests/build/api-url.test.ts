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
    // We search for the actual URL patterns rather than relying on minified variable names
    // Pattern 1: Old pattern with globalThis - __API_BASE_URL__??"http://..."
    // Pattern 2: Direct string literals that look like API URLs
    const patterns = [
      /__API_BASE_URL__\?\?"([^"]+)"/,
      /globalThis\.__API_BASE_URL__\?\?"([^"]+)"/,
      /API_BASE_URL__:"([^"]+)"/,
      // Match any variable assignment to a string that looks like an API path
      // This is more robust than matching specific variable names like 'ki'
      /=["'](\/(api|v\d+)[^"']*|https?:\/\/[^"']+\/api[^"']*)["']/,
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
    // After the fix, it should use a relative path like /api or an external URL
    const isLocalhost = foundApiUrl?.includes('localhost') || foundApiUrl?.includes('127.0.0.1');
    
    expect(isLocalhost).toBe(false); // Should NOT use localhost in production
    
    // Verify the URL is either a relative path or an absolute URL (not localhost)
    // This makes the test flexible for different deployment scenarios
    const isValidUrl = foundApiUrl?.startsWith('/') || foundApiUrl?.startsWith('http');
    expect(isValidUrl).toBe(true);
  });

  it('should expose API URL for verification', () => {
    console.log('Found API URL in bundle:', foundApiUrl);
  });
});
