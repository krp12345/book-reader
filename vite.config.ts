/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

/**
 * Emit the default stylesheet as a standalone `book-reader.css` asset.
 *
 * The CSS is deliberately *not* imported by `src/index.ts`, so importing the
 * library's JS never pulls it in — the stylesheet stays opt-in
 * (`import 'book-reader/styles.css'`) and tree-shake-safe. This plugin copies
 * the plain CSS straight into `dist` (no transform needed) for each output.
 */
function emitDefaultStylesheet(): Plugin {
  const src = resolve(__dirname, 'src/styles/book-reader.css');
  return {
    name: 'book-reader:emit-stylesheet',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'book-reader.css',
        source: readFileSync(src, 'utf8'),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    dts({ include: ['src'], rollupTypes: true }),
    emitDefaultStylesheet(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'BookReader',
      fileName: (format) => `book-reader.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
