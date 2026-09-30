// Cloudflare Worker entry. Static files (the Vite build in dist/) are served by
// Workers static assets before this code runs; only requests that match no file
// — i.e. /api/* — reach fetch() below.
//
// The handlers in api/ are unchanged Vercel-style (req, res) functions, so the
// same files keep working on Vercel. This adapter gives them the parts of
// Vercel's req/res they use. Env vars and secrets reach them as process.env via
// the nodejs_compat flag (see wrangler.jsonc).
import resume from '../api/resume.js'
import downloads from '../api/downloads.js'

const ROUTES = {
  '/api/resume': resume,
  '/api/downloads': downloads,
}

// Runs a Vercel-style handler against a Fetch API Request and returns a Response.
async function runVercelHandler(handler, request) {
  const url = new URL(request.url)
  const headers = Object.fromEntries(request.headers)
  // The handlers rate-limit on x-forwarded-for; Cloudflare puts the visitor's
  // IP in cf-connecting-ip instead.
  headers['x-forwarded-for'] ??= request.headers.get('cf-connecting-ip') ?? ''

  let body
  if ((headers['content-type'] || '').includes('application/json')) {
    try { body = await request.json() } catch { body = undefined }
  }

  const req = { method: request.method, url: url.pathname + url.search, headers, query: Object.fromEntries(url.searchParams), body }

  return new Promise((resolve, reject) => {
    const out = new Headers()
    let status = 200
    const res = {
      setHeader(k, v) { out.set(k, v); return res },
      status(code) { status = code; return res },
      json(data) {
        out.set('Content-Type', 'application/json')
        resolve(new Response(JSON.stringify(data), { status, headers: out }))
        return res
      },
      send(data) {
        resolve(new Response(data, { status, headers: out }))
        return res
      },
    }
    Promise.resolve(handler(req, res)).catch(reject)
  })
}

export default {
  async fetch(request, env, ctx) {
    const handler = ROUTES[new URL(request.url).pathname]
    if (!handler) return new Response('Not found', { status: 404 })

    // Vercel's CDN honoured the handlers' s-maxage; Workers doesn't cache
    // function responses on its own, so do it here for GETs (the download
    // counter) to spare Upstash a round trip on every page view.
    const cache = caches.default
    if (request.method === 'GET') {
      const hit = await cache.match(request)
      if (hit) return hit
    }

    const response = await runVercelHandler(handler, request)

    const cc = response.headers.get('Cache-Control') || ''
    if (request.method === 'GET' && response.ok && /s-maxage=\d+/.test(cc)) {
      ctx.waitUntil(cache.put(request, response.clone()))
    }
    return response
  },
}
