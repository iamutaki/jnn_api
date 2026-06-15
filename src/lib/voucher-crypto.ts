/**
 * Voucher code cryptography for digital_vouchers.
 *
 * The plaintext voucher code is NEVER persisted. Instead we store:
 *   - code_hash        : HMAC-SHA256(key, plaintext), base64 — lookup-by-code key
 *   - encrypted_code   : AES-256-GCM ciphertext (NO tag), base64
 *   - encryption_iv    : fresh 96-bit random IV per code, base64
 *   - encryption_tag   : 128-bit GCM auth tag, base64
 *   - encryption_key_version : which VOUCHER_ENCRYPTION_KEY_V<n> encrypted it
 *
 * AES-GCM (authenticated encryption): decrypting with the wrong key/IV/tampered
 * ciphertext throws — so a modified encrypted_code is detected, never silently
 * returned as wrong plaintext.
 */
import type { Env } from '../types'

// --- base64 <-> bytes (Workers has no Buffer; atob/btoa are available) ---
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

const enc = new TextEncoder()
const dec = new TextDecoder()

export interface EncryptedCode {
  encryptedCode: string
  iv: string
  tag: string
  keyVersion: number
}

function encryptionKeyFor(env: Env['Bindings'], version: number): string {
  const name = `VOUCHER_ENCRYPTION_KEY_V${version}`
  const val = (env as unknown as Record<string, string>)[name]
  if (!val) throw new Error(`Missing encryption key ${name}`)
  return val
}

/** Encrypt a plaintext code with the current active key version. */
export async function encryptCode(plaintext: string, env: Env['Bindings']): Promise<EncryptedCode> {
  const keyVersion = Number(env.VOUCHER_KEY_VERSION)
  const keyB64 = encryptionKeyFor(env, keyVersion)
  const key = await crypto.subtle.importKey('raw', b64ToBytes(keyB64), { name: 'AES-GCM' }, false, ['encrypt'])

  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  const ct = new Uint8Array(ctBuf) // ciphertext + 16-byte tag appended

  return {
    encryptedCode: bytesToB64(ct.subarray(0, ct.length - 16)),
    iv: bytesToB64(iv),
    tag: bytesToB64(ct.subarray(ct.length - 16)),
    keyVersion,
  }
}

/** Decrypt using the key version stored on the row. Throws on tamper/wrong key. */
export async function decryptCode(
  encryptedCode: string,
  iv: string,
  tag: string,
  keyVersion: number,
  env: Env['Bindings'],
): Promise<string> {
  const keyB64 = encryptionKeyFor(env, keyVersion)
  const key = await crypto.subtle.importKey('raw', b64ToBytes(keyB64), { name: 'AES-GCM' }, false, ['decrypt'])

  const codeBytes = b64ToBytes(encryptedCode)
  const tagBytes = b64ToBytes(tag)
  const combined = new Uint8Array(codeBytes.length + tagBytes.length)
  combined.set(codeBytes, 0)
  combined.set(tagBytes, codeBytes.length)

  const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(iv) }, key, combined)
  return dec.decode(ptBuf)
}

/** Keyed HMAC-SHA256 of the plaintext — the lookup-by-code hash. */
export async function hashCode(plaintext: string, env: Env['Bindings']): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    b64ToBytes(env.VOUCHER_HASH_KEY_V1),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(plaintext))
  return bytesToB64(new Uint8Array(sig))
}
