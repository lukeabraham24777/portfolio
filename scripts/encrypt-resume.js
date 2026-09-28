// Encrypts a résumé PDF into api/_resume.enc.js for the PIN-gated /api/resume.
//
//   RESUME_KEY=<64 hex chars> node scripts/encrypt-resume.js path/to/resume.pdf
//
// RESUME_KEY must match the value set in Vercel. Never commit the plaintext
// PDF — this repo is public; only the ciphertext belongs in git.
import crypto from 'node:crypto'
import fs from 'node:fs'

const [pdfPath] = process.argv.slice(2)
const key = Buffer.from(process.env.RESUME_KEY || '', 'hex')
if (!pdfPath || key.length !== 32) {
  console.error('usage: RESUME_KEY=<64 hex chars> node scripts/encrypt-resume.js <resume.pdf>')
  process.exit(1)
}

const iv = crypto.randomBytes(12)
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
const ct = Buffer.concat([cipher.update(fs.readFileSync(pdfPath)), cipher.final()])
const blob = Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')

fs.writeFileSync(new URL('../api/_resume.enc.js', import.meta.url), `// AES-256-GCM ciphertext of the résumé PDF: base64(iv[12] | tag[16] | ciphertext).
// Safe to commit — useless without RESUME_KEY, which lives only in Vercel env.
// Regenerate with scripts/encrypt-resume.js.
export default ${JSON.stringify(blob)}
`)
console.log(`wrote api/_resume.enc.js (${ct.length} bytes encrypted)`)
