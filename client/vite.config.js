import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      clientPort: 5000
    },
    proxy: {
      '/api': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('[Vite Proxy] Error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('[Vite Proxy] Forwarding:', req.method, req.url, '-> http://0.0.0.0:3000' + req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('[Vite Proxy] Response:', proxyRes.statusCode, 'from', req.url);
          });
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@assets': '/attached_assets'
    }
  }
})
