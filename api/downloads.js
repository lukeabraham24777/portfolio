// Vercel serverless function — proxies a live counter out of Upstash Redis.
//
// The whole point of this file is that the Upstash token stays here, on the
// server, where the browser can never see it. Do NOT move these reads into the
// client with a VITE_ prefix: Vite inlines those into the public bundle.
//
// Only keys in ALLOWED_KEYS can be read, so this endpoint can't be turned into
// a general-purpose window into the database.
const ALLOWED_KEYS = new Set([
  'cmdtab:downloads',
])

// Credential resolution, in priority order. Vercel's Redis marketplace
// integration injects KV_REST_API_*; a hand-added pair (and .env.local for
// local dev) uses UPSTASH_REDIS_REST_*. Accepting both means the same code runs
// in either setup with no per-environment configuration.
//
// This endpoint only ever reads, so prefer the read-only token when the
// integration provides one — nothing here should be able to write.
const restUrl = () =>
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL
const restToken = () =>
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_READ_ONLY_TOKEN ||
  process.env.KV_REST_API_TOKEN

export default async function handler(req, res) {
  // TEMPORARY DIAGNOSTIC — delete this block once the counter is confirmed
  // working. Reports whether the runtime can see the credentials, never their
  // values: presence, length, the names of any UPSTASH-ish vars (catches typos
  // and stray whitespace), and which environment is actually serving.
  if (req.query?.debug === '1') {
    const url = restUrl() || ''
    const token = restToken() || ''
    return res.status(200).json({
      hasUrl: Boolean(url),
      hasToken: Boolean(token),
      urlLength: url.length,
      tokenLength: token.length,
      // Wide net: integration-injected credentials show up under names like
      // KV_REST_API_URL just as often as UPSTASH_*.
      upstashishNames: Object.keys(process.env).filter(k => /upstash|redis|kv_|rest_api/i.test(k)),
      vercelEnv: process.env.VERCEL_ENV ?? null,
      node: process.version,
    })
  }

  const key = req.query?.key
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ error: 'unknown key' })
  }

  const url = restUrl()
  const token = restToken()
  if (!url || !token) {
    return res.status(500).json({ error: 'counter backend not configured' })
  }

  try {
    const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) throw new Error(`upstash HTTP ${r.status}`)
    const { result } = await r.json()

    const count = Number(result)
    if (result === null || !Number.isFinite(count)) {
      return res.status(404).json({ error: 'no value at key' })
    }

    // Served from Vercel's edge cache for a minute, and served stale for five
    // more while it refreshes — still "live", without a round trip to Upstash
    // on every page view.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res.status(200).json({ count })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}
