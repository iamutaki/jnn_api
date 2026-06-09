/**
 * Lightweight ULID generator for Cloudflare Workers.
 *
 * ULID = 48-bit timestamp + 80-bit randomness
 * Format: 26 chars, Crockford's Base32, lexicographically sortable.
 *
 * Why not `uuid`? ULIDs are sortable by time, which makes them
 * better for database indexing — new rows append naturally.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford Base32
const RANDOM_LEN = 16

function randomBytes(count: number): string {
  const bytes = new Uint8Array(count)
  // crypto.getRandomValues is available in Workers runtime
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => ENCODING[(b >> 3) & 0x1f] + ENCODING[b & 0x1f])
    .join('')
    .slice(0, count)
}

function encodeTime(now: number): string {
  let time = now
  let encoded = ''
  for (let i = 10; i > 0; i--) {
    const mod = time % 32
    encoded = ENCODING[mod] + encoded
    time = Math.floor(time / 32)
  }
  return encoded
}

export function ulid(): string {
  const timestamp = Date.now()
  return encodeTime(timestamp) + randomBytes(RANDOM_LEN)
}
