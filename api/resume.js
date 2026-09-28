// Vercel serverless function — PIN-gated résumé.
//
// The repo is public, so the PDF is committed only as AES-256-GCM ciphertext
// (api/_resume.enc.js). This function checks the PIN, then decrypts and
// streams the PDF. Neither secret ever reaches the client bundle:
//   RESUME_PIN — what visitors type
//   RESUME_KEY — 64 hex chars, the AES key (see scripts/encrypt-resume.js)
//
// Wrong guesses are rate-limited per IP in Upstash so the short PIN can't be
// brute-forced. If the limiter is unreachable we fail closed.
import crypto from 'node:crypto'
import encrypted from './_resume.enc.js'

const MAX_ATTEMPTS = 10
const WINDOW_SECONDS = 60 * 60

// Needs a write-capable token (INCR), so the read-only one is not an option.
const restUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const restToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

// Returns the attempt count for this IP within the window, including this one.
const countAttempt = async (ip) => {
  const key = `ratelimit:resume:${ip}`
  const r = await fetch(`${restUrl()}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${restToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['INCR', key], ['EXPIRE', key, WINDOW_SECONDS, 'NX']]),
  })
  if (!r.ok) throw new Error(`upstash HTTP ${r.status}`)
  const [{ result }] = await r.json()
  return Number(result)
}

// Constant-time compare; hashing first equalises lengths for timingSafeEqual.
const pinMatches = (given, expected) => {
  const h = (s) => crypto.createHash('sha256').update(s).digest()
  return crypto.timingSafeEqual(h(given), h(expected))
}

const decryptResume = (keyHex) => {
  const buf = Buffer.from(encrypted, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), buf.subarray(0, 12))
  decipher.setAuthTag(buf.subarray(12, 28))
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()])
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method not allowed' })
  }

  const expectedPin = process.env.RESUME_PIN
  const keyHex = process.env.RESUME_KEY
  if (!expectedPin || !keyHex || !restUrl() || !restToken()) {
    return res.status(500).json({ error: 'resume backend not configured' })
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  let attempts
  try {
    attempts = await countAttempt(ip)
  } catch (e) {
    console.error('rate limiter unavailable:', e.message)
    return res.status(503).json({ error: 'try again later' })
  }
  if (attempts > MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'too many attempts' })
  }

  const pin = String(req.body?.pin ?? '').trim().toLowerCase()
  if (!pinMatches(pin, expectedPin.trim().toLowerCase())) {
    return res.status(401).json({ error: 'wrong pin' })
  }

  try {
    const pdf = decryptResume(keyHex)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="resume.pdf"')
    return res.status(200).send(pdf)
  } catch (e) {
    console.error('resume decrypt failed:', e.message)
    return res.status(500).json({ error: 'resume unavailable' })
  }
}
