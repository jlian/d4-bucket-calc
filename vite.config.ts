import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/d4-bucket-calc/',
  plugins: [tailwindcss()],
});
