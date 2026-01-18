import { defineConfig, loadEnv, type PluginOption } from 'vite'
import solid from 'vite-plugin-solid'
import devtools from 'solid-devtools/vite'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const bggToken = env.BGG_TOKEN || env.VITE_BGG_TOKEN || ''
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
    define: {
      'import.meta.env.BGG_TOKEN': JSON.stringify(bggToken),
    },
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
