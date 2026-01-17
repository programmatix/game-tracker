import { defineConfig, type PluginOption } from 'vite'
import solid from 'vite-plugin-solid'
import devtools from 'solid-devtools/vite'

export default defineConfig(({ command }) => {
  const plugins: PluginOption[] = [solid()]

  if (command === 'serve') {
    plugins.unshift(
      devtools({
        locator: {
          targetIDE: 'vscode',
          jsxLocation: true,
          componentLocation: true,
        },
      }),
    )
  }

  return {
    plugins,
    server: {
      proxy: {
        '/bgg': {
          target: 'https://boardgamegeek.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/bgg/, ''),
        },
      },
    },
  }
})
