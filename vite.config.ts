import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/d4-damage-calc/',
  plugins: [tailwindcss()],
});
