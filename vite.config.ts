/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const DAY = 24 * 60 * 60;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Park Plate',
        short_name: 'Park Plate',
        description: 'Private WDW quick-service and refill map for the Disney Dining Plan.',
        theme_color: '#14213d',
        background_color: '#14213d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // App shell, plus only the latin subsets of the self-hosted fonts.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webmanifest}', 'assets/*-latin-[0-9]*-normal-*.woff2'],
        globIgnores: ['**/tiles/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // The app stores the whole extract in this cache on first map open
            // (src/map/tiles.ts); range requests are then sliced from it.
            urlPattern: ({ url }) => url.pathname.startsWith('/tiles/') && url.pathname.endsWith('.pmtiles'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pmtiles',
              rangeRequests: true,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Fallback street map when no PMTiles extract is deployed: keep the tiles you viewed.
            urlPattern: ({ url }) => url.hostname === 'tile.openstreetmap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 4000, maxAgeSeconds: 7 * DAY },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/media/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'media',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * DAY },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Google Places photos: terms forbid long-term caching.
            urlPattern: ({ url }) => /googleusercontent\.com$|googleapis\.com$/.test(url.hostname),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    // `npm run dev` serves the client only. Use `vercel dev` for the API too.
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
  },
});
