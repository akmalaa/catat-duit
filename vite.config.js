import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'CatatDuit',
        short_name: 'CatatDuit',
        description: 'Catat pengeluaran harianmu dengan cepat',
        theme_color: '#0d0e1a',
        background_color: '#0d0e1a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/logo.jpg', sizes: '512x512', type: 'image/jpeg', purpose: 'any' },
          { src: '/logo.jpg', sizes: '512x512', type: 'image/jpeg', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 31536000 }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ]
})
