import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// BASE: use VITE_BASE=/nome-do-repo/ para GitHub Pages. Padrão "/" (Vercel/Netlify).
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Treinos TAF',
        short_name: 'Treinos',
        description: 'Organização inteligente de treinos de musculação e preparação para o TAF',
        lang: 'pt-BR',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true
      }
    })
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }
})
