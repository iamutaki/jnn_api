import { argon2id } from '@noble/hashes/argon2.js'

const OPS = { t: 2, m: 19456, p: 1 } as const

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function encodeArgon2(salt: Uint8Array, hash: Uint8Array): string {
  return `$argon2id$v=19$m=${OPS.m},t=${OPS.t},p=${OPS.p}$${toBase64(salt)}$${toBase64(hash)}`
}

function parseArgon2(encoded: string): {
  salt: Uint8Array
  hash: Uint8Array
  m: number
  t: number
  p: number
} {
  const parts = encoded.split('$')
  const params = parts[3].split(',')
  const m = Number(params[0].split('=')[1])
  const t = Number(params[1].split('=')[1])
  const p = Number(params[2].split('=')[1])
  const salt = fromBase64(parts[4])
  const hash = fromBase64(parts[5])
  return { salt, hash, m, t, p }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = argon2id(password, salt, OPS)
  return encodeArgon2(salt, hash)
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  const parsed = parseArgon2(hash)
  const { m, t, p, salt } = parsed
  const derived = argon2id(plaintext, salt, { t, m, p })
  if (derived.length !== parsed.hash.length) return false
  for (let i = 0; i < derived.length; i++) {
    if (derived[i] !== parsed.hash[i]) return false
  }
  return true
}
