/**
 * WeCom (企业微信) AES-256-CBC cryptography and SHA1 signature verification.
 *
 * WeCom callback protocol requires:
 *   - SHA1 signature: `sha1(sort(token, timestamp, nonce, encrypt))`
 *   - AES-256-CBC decryption of the Encrypt field
 *   - The decrypted payload has format: random(16B) + msgLen(4B BE) + msg + corpid
 *
 * @module @deepseek-ai/dsh-webhook-wecom
 */

import { createDecipheriv, createHash, timingSafeEqual } from 'node:crypto'

/** WeCom uses 256-bit AES key (43-char base64 encoded by WeCom, decoded to 32 bytes). */
const AES_KEY_LENGTH = 32
/** AES-256-CBC requires a 16-byte IV taken from the first 16 bytes of the key. */
const AES_IV_LENGTH = 16
/** Random prefix length prepended before the message length field. */
const RANDOM_PREFIX_LENGTH = 16
/** Message length field: 4 bytes big-endian unsigned int. */
const MSG_LENGTH_BYTES = 4

/**
 * WeCom crypto error carrying no secret-sensitive detail for the caller.
 */
export class WecomCryptoError extends Error {
  override readonly name = 'WecomCryptoError'

  constructor(message: string) {
    super(message)
  }
}

/**
 * Decode the WeCom-issued Base64 encoding key. WeCom issues keys as a 43-character
 * Base64 string that decodes to 32 bytes; the extra padding '=' is appended by WeCom.
 *
 * @param encodingAesKey - the Base64-encoded AES key from WeCom admin panel.
 * @returns 32-byte raw AES key.
 * @throws {WecomCryptoError} when the key is not valid Base64 or has wrong length.
 */
function decodeAesKey(encodingAesKey: string): Buffer {
  const key = Buffer.from(encodingAesKey + '=', 'base64')
  if (key.length !== AES_KEY_LENGTH) {
    throw new WecomCryptoError(
      `AES key must decode to ${AES_KEY_LENGTH} bytes, got ${key.length}`,
    )
  }
  return key
}

/**
 * Verify the WeCom SHA1 signature.
 *
 * @param token - the Token configured in WeCom admin panel.
 * @param timestamp - the timestamp from the callback query string.
 * @param nonce - the nonce from the callback query string.
 * @param encrypt - the encrypted message from the XML body.
 * @param signature - the msg_signature from the callback query string.
 * @returns true when the signature matches.
 */
export function verifyWecomSignature(
  token: string,
  timestamp: string,
  nonce: string,
  encrypt: string,
  signature: string,
): boolean {
  const sorted = [token, timestamp, nonce, encrypt].sort()
  const hash = createHash('sha1').update(sorted.join('')).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

/**
 * Decrypt a WeCom-encrypted message body.
 *
 * The encrypted payload is Base64-encoded ciphertext. After AES-256-CBC decryption
 * the plaintext layout is:
 * ```
 * [16 bytes random] [4 bytes msg_len BE] [msg_len bytes XML] [receiver id]
 * ```
 *
 * @param encodingAesKey - the Base64-encoded AES key from WeCom admin panel.
 * @param encrypted - the Base64-encoded ciphertext from the XML Encrypt field.
 * @param receiverId - the CorpId (enterprise) or SuiteId expected in the plaintext trailer.
 * @returns the decrypted XML message body.
 * @throws {WecomCryptoError} on decryption failure, length mismatch, or receiver mismatch.
 */
export function decryptWecomMessage(
  encodingAesKey: string,
  encrypted: string,
  receiverId: string,
): string {
  const key = decodeAesKey(encodingAesKey)
  const iv = key.subarray(0, AES_IV_LENGTH)

  let ciphertext: Buffer
  try {
    ciphertext = Buffer.from(encrypted, 'base64')
  } catch {
    throw new WecomCryptoError('encrypted message is not valid Base64')
  }

  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  decipher.setAutoPadding(true)

  let plaintext: Buffer
  try {
    const decrypted = decipher.update(ciphertext)
    const final = decipher.final()
    plaintext = Buffer.concat([decrypted, final])
  } catch {
    throw new WecomCryptoError('AES decryption failed; check the encoding key and ciphertext')
  }

  if (plaintext.length < RANDOM_PREFIX_LENGTH + MSG_LENGTH_BYTES) {
    throw new WecomCryptoError('decrypted payload is too short')
  }

  const msgLen = plaintext.readUInt32BE(RANDOM_PREFIX_LENGTH)
  const msgStart = RANDOM_PREFIX_LENGTH + MSG_LENGTH_BYTES
  const msgEnd = msgStart + msgLen

  if (msgEnd > plaintext.length) {
    throw new WecomCryptoError(
      `declared message length ${msgLen} exceeds decrypted payload (${plaintext.length - msgStart} available)`,
    )
  }

  const message = plaintext.subarray(msgStart, msgEnd).toString('utf-8')
  const actualReceiver = plaintext.subarray(msgEnd).toString('utf-8')

  if (actualReceiver !== receiverId) {
    throw new WecomCryptoError(
      `receiver id mismatch: expected ${receiverId}, got ${actualReceiver}`,
    )
  }

  return message
}

/**
 * Process the WeCom URL verification challenge (GET request with echostr).
 *
 * Verifies the signature, then decrypts echostr to prove URL ownership.
 *
 * @param encodingAesKey - the Base64-encoded AES key.
 * @param token - the Token configured in WeCom admin panel.
 * @param receiverId - the CorpId.
 * @param signature - msg_signature from query string.
 * @param timestamp - timestamp from query string.
 * @param nonce - nonce from query string.
 * @param echostr - the encrypted echostr from query string.
 * @returns the decrypted plaintext echostr to echo back in the response body.
 * @throws {WecomCryptoError} on verification or decryption failure.
 */
export function verifyWecomUrl(
  encodingAesKey: string,
  token: string,
  receiverId: string,
  signature: string,
  timestamp: string,
  nonce: string,
  echostr: string,
): string {
  const valid = verifyWecomSignature(token, timestamp, nonce, echostr, signature)
  if (!valid) {
    throw new WecomCryptoError('URL verification signature mismatch')
  }
  return decryptWecomMessage(encodingAesKey, echostr, receiverId)
}