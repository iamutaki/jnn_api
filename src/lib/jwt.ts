import { encrypt, decrypt, generateKeys } from 'paseto-ts/v4'

export interface JwtPayload {
  sub: string
  iat: string
  exp: string
}

let ephemeralKey: string | null = null

function resolveKey(key: string): string {
  if (typeof key === 'string' && key.startsWith('k4.local.')) return key
  if (!ephemeralKey) {
    ephemeralKey = generateKeys('local', { format: 'paserk' })
    console.warn('[jwt] JWT_SECRET not configured — generated ephemeral key. Tokens invalid after restart.')
  }
  return ephemeralKey
}

export const jwtUtil = {
  encrypt,
  decrypt,

  signAccess: (payload: { sub: string }, key: string) =>
    encrypt(resolveKey(key), { sub: payload.sub }),

  signRefresh: (payload: { sub: string }, key: string) =>
    encrypt(resolveKey(key), { sub: payload.sub, exp: '7d' }, { addExp: false }),

  verify: (token: string, key: string): JwtPayload => {
    const { payload } = decrypt(resolveKey(key), token)
    return payload as unknown as JwtPayload
  },
}
