import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// Dependency closure officecrypto-tool + vite-plugin-node-polyfills (dipakai buat decrypt xlsx e-statement
// di ImportStatementSheet, dynamic import). Cuma dipakai fitur ini, gak dipakai bagian app lain — dikelompokkan
// ke satu chunk biar bisa di-globIgnores dari precache PWA (lihat workbox.globIgnores di bawah).
const STATEMENT_CRYPTO_DEPS = new Set([
  '@rollup/plugin-inject', 'adler-32', 'asn1.js', 'assert', 'bn.js', 'brorand', 'browser-resolve',
  'browserify-aes', 'browserify-cipher', 'browserify-des', 'browserify-rsa', 'browserify-sign',
  'browserify-zlib', 'buffer', 'buffer-xor', 'builtin-status-codes', 'cfb', 'cipher-base',
  'console-browserify', 'constants-browserify', 'crc-32', 'create-ecdh', 'create-hash', 'create-hmac',
  'crypto-browserify', 'crypto-js', 'des.js', 'diffie-hellman', 'domain-browser', 'elliptic', 'evp_bytestokey',
  'events', 'hash-base', 'hash.js', 'hmac-drbg', 'https-browserify', 'ieee754', 'inherits', 'isarray',
  'isomorphic-timers-promises', 'md5.js', 'miller-rabin', 'minimalistic-assert', 'minimalistic-crypto-utils',
  'node-stdlib-browser', 'officecrypto-tool', 'os-browserify', 'pako', 'parse-asn1', 'path-browserify',
  'pbkdf2', 'process', 'public-encrypt', 'punycode', 'querystring-es3', 'randombytes', 'randomfill',
  'readable-stream', 'ripemd160', 'safe-buffer', 'sax', 'setimmediate', 'sha.js', 'stream-browserify',
  'stream-http', 'string_decoder', 'timers-browserify', 'tty-browserify', 'url', 'util', 'util-deprecate',
  'vm-browserify', 'xml2js', 'xmlbuilder', 'xtend',
])

export default defineConfig({
  plugins: [
    react(),
    // Dibutuhkan oleh officecrypto-tool (dipakai buat decrypt xlsx e-statement) — polyfill Node crypto/buffer/process
    // di browser. Sudah dicek: polyfill ini cuma nempel di chunk yang benar-benar require dia (dynamic import di
    // statementParser.js), bundle utama app gak kebawa berat (tetap ~198KB, sama kayak sebelum fitur ini ada).
    nodePolyfills({
      globals: { Buffer: true, process: true },
      protocolImports: true,
    }),
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
        // Chunk decrypt/parse e-statement (officecrypto-tool + polyfill + xlsx) sengaja gak di-precache —
        // berat (~1.3MB) dan cuma dipakai kalau user buka fitur Import, jangan dipaksa didownload semua orang
        // di background pas install/update PWA. Tetap ke-fetch normal on-demand pas fitur itu dibuka.
        // (nama chunk-nya dipastiin unik lewat manualChunks di bawah, biar globIgnores gak nyenggol chunk lain)
        globIgnores: ['**/xlsx-*.js', '**/statement-crypto-vendor-*.js'],
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
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          const pkg = id.split('node_modules/').pop().split('/')[0]
          if (STATEMENT_CRYPTO_DEPS.has(pkg)) return 'statement-crypto-vendor'
        },
      },
    },
  },
})
