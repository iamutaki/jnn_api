function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function base64url(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function encodeBase64url(str: string): string {
  return base64url(new TextEncoder().encode(str))
}

async function signRS256(data: string, privateKeyPem: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = pemToArrayBuffer(privateKeyPem)

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    encoder.encode(data),
  )

  return base64url(new Uint8Array(signature))
}

async function getAccessToken(clientEmail: string, privateKey: string): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encodedHeader = encodeBase64url(JSON.stringify(header))
  const encodedClaim = encodeBase64url(JSON.stringify(claim))
  const signingInput = encodedHeader + '.' + encodedClaim
  const signature = await signRS256(signingInput, privateKey)
  const jwt = signingInput + '.' + signature

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data: any = await res.json()
  return { token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) }
}

interface FcmOptions {
  image?: string
  actionUrl?: string
  data?: Record<string, string>
}

/**
 * Fail fast if any Firebase env var is unset. Without this, a missing key
 * produces an opaque chain: empty JWT → OAuth error → `Bearer undefined` →
 * FCM 401, which looks like a token problem instead of a config problem.
 * Throws an Error naming every missing var, matching the voucher-crypto
 * convention (see src/lib/voucher-crypto.ts).
 */
function assertFirebaseConfig(projectId: string, clientEmail: string, privateKey: string): void {
  const missing: string[] = []
  if (!projectId) missing.push('FIREBASE_PROJECT_ID')
  if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL')
  if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY')
  if (missing.length > 0) {
    throw new Error(`Missing Firebase config: ${missing.join(', ')}`)
  }
}

export async function sendFcm(
  projectId: string,
  clientEmail: string,
  privateKey: string,
  fcmTokens: string[],
  title: string,
  body: string,
  options?: FcmOptions,
): Promise<{ success: string[]; failed: string[] }> {
  assertFirebaseConfig(projectId, clientEmail, privateKey)
  const { token } = await getAccessToken(clientEmail, privateKey)

  const success: string[] = []
  const failed: string[] = []

  for (const fcmToken of fcmTokens) {
    const message: any = {
      message: {
        token: fcmToken,
        notification: { title, body },
      },
    }

    if (options?.image) {
      message.message.notification.image = options.image
    }

    if (options?.data || options?.actionUrl) {
      message.message.data = {
        ...(options.data || {}),
        ...(options.actionUrl ? { action_url: options.actionUrl } : {}),
      }
    }

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      },
    )

    if (res.ok) {
      success.push(fcmToken)
    } else {
      const errBody = await res.text()
      console.log(`[fcm] push failed: token=${fcmToken.slice(0, 20)}... status=${res.status} body=${errBody}`)
      failed.push(fcmToken)
    }
  }

  return { success, failed }
}
