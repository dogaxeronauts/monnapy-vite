import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    define: {
      // Build-time replacement - güvenli çünkü bundled olarak gelir
      __MULTISYNQ_API_KEY__: JSON.stringify(env.MULTISYNQ_API_KEY),
      __REACT_TOGETHER_PASSWORD__: JSON.stringify(env.REACT_TOGETHER_PASSWORD)
    }
  }
})
