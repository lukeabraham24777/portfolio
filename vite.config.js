import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Vercel serves everything in /api as a serverless function, but `vite dev`
// knows nothing about it — without this the download counter would silently
// fall back to its placeholder in local dev. Mount the real handler on the dev
// server with a minimal Express-shaped req/res shim so dev matches production.
const vercelApiDev = (env) => ({
  name: 'vercel-api-dev',
  configureServer(server) {
    server.middlewares.use('/api/downloads', async (req, res) => {
      const { default: handler } = await server.ssrLoadModule('/api/downloads.js')
      const query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
      const shim = {
        setHeader: (k, v) => res.setHeader(k, v),
        status(code) { res.statusCode = code; return shim },
        json(body) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) },
      }
      // The handler reads credentials off process.env, same as on Vercel.
      process.env.UPSTASH_REDIS_REST_URL ??= env.UPSTASH_REDIS_REST_URL
      process.env.UPSTASH_REDIS_REST_TOKEN ??= env.UPSTASH_REDIS_REST_TOKEN
      await handler({ query }, shim)
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' prefix → load unprefixed vars too. These stay in the Node process; only
  // VITE_-prefixed vars ever reach the client bundle.
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), vercelApiDev(env)] }
})
