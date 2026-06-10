import { encrypt, decrypt, generateKeys } from 'paseto-ts/v4'

export interface TokenPayload {
  sub: string
  userId: string
  iat: string
  exp: string
}

let ephemeralKey: string | null = null

function resolveKey(key: string): string {
  if (typeof key === 'string' && key.startsWith('k4.local.')) return key
  if (!ephemeralKey) {
    ephemeralKey = generateKeys('local', { format: 'paserk' })
    console.warn('[token] TOKEN_SECRET not configured — generated ephemeral key.')
  }
  return ephemeralKey
}

export const tokenUtil = {
  encrypt,
  decrypt,

  signAccess: (payload: { sub: string; userId: string }, key: string) =>
    encrypt(resolveKey(key), { sub: payload.sub, userId: payload.userId, exp: '1h' }, { addExp: false }),

  signRefresh: (payload: { sub: string; userId: string }, key: string) =>
    encrypt(resolveKey(key), { sub: payload.sub, userId: payload.userId, exp: '7d' }, { addExp: false }),

  verify: (token: string, key: string): TokenPayload => {
    const { payload } = decrypt(resolveKey(key), token)
    return payload as unknown as TokenPayload
  },
}
