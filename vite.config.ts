import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['images/brand/app-icon-192.png', 'images/brand/app-icon-512.png', 'images/brand/apple-touch-icon-180.png'],
    manifest: {
      name: 'Gカード', short_name: 'Gカード', description: '学校で学び、カードで遊ぶ',
      lang: 'ja', start_url: './#/home', scope: './', display: 'standalone',
      background_color: '#0d1530', theme_color: '#0d1530',
      icons: [
        { src: 'images/brand/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: 'images/brand/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: { globIgnores: ['**/images/cards/**'], navigateFallback: 'index.html' },
  })],
  base: process.env.VITE_BASE_PATH || '/',
});
