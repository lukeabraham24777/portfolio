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

export default async function handler(req, res) {
  const key = req.query?.key
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ error: 'unknown key' })
  }

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
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
