import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    outDir: 'build',
    minify: 'esbuild',
  },
  // 确保环境变量被正确加载
  envPrefix: 'VITE_',
  // 明确指定环境文件
  envDir: './'
})
