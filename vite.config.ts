import path from 'path';
import { webcrypto } from 'node:crypto';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const shopifyProxy = env.VITE_SHOPIFY_STORE && env.VITE_SHOPIFY_TOKEN
      ? {
          '/shopify-proxy': {
            target: `https://${env.VITE_SHOPIFY_STORE}.myshopify.com`,
            changeOrigin: true,
            secure: true,
            rewrite: (path: string) => path.replace(/^\/shopify-proxy/, ''),
            headers: {
              'X-Shopify-Access-Token': env.VITE_SHOPIFY_TOKEN,
            },
          },
        }
      : {};

    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: shopifyProxy,
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
