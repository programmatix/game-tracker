import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  server: {
    proxy: {
      '/bgg': {
        target: 'https://boardgamegeek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bgg/, ''),
      },
    },
  },
})
