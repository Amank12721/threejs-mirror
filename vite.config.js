import { defineConfig } from 'vite'
import glslify from 'rollup-plugin-glslify'
import * as path from 'path'

export default defineConfig({
  root: 'src',
  base: './', // Changed for Vercel deployment
  build: {
    outDir: '../dist',
    chunkSizeWarningLimit: 1000, // Increase limit to 1000kb
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'three-addons': [
            'three/examples/jsm/controls/OrbitControls.js',
            'three/examples/jsm/objects/Reflector.js',
            'three/examples/jsm/loaders/GLTFLoader.js',
            'three/examples/jsm/exporters/GLTFExporter.js'
          ]
        }
      }
    }
  },
  server: {
    host: true, // to test on other devices with IP address
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [glslify()],
})
