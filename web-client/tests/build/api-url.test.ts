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
    // We look for strings that match API URL patterns
    // This is more robust than looking for specific JavaScript patterns
    const urlPatterns = [
      // Match full URLs: http(s)://...
      /["']https?:\/\/[^"']+["']/g,
      // Match relative paths starting with /api or /v1, etc.
      /["']\/(?:api|v\d+)[^"']*["']/g,
    ];

    const foundUrls: string[] = [];
    for (const pattern of urlPatterns) {
      const matches = bundleContent.matchAll(pattern);
      for (const match of matches) {
        // Remove quotes
        const url = match[0].slice(1, -1);
        // Filter out URLs that are clearly not API endpoints
        if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
          foundUrls.push(url);
        } else if (url.includes('localhost') || url.includes('127.0.0.1')) {
          // Also track localhost URLs to detect the bug
          foundUrls.push(url);
        }
      }
    }

    // Use the first URL that looks like an API endpoint
    foundApiUrl = foundUrls.find(url => 
      url.includes('/api') || url.includes('/v1') || url.match(/\/v\d+/)
    ) || null;
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
