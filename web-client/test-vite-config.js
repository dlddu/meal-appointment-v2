const { defineConfig } = require('vite');

const config = defineConfig(() => {
  const apiBaseUrl = process.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
  console.log('API Base URL:', apiBaseUrl);
  return {
    define: {
      __API_BASE_URL__: JSON.stringify(apiBaseUrl)
    }
  };
});

console.log('Config:', config);
